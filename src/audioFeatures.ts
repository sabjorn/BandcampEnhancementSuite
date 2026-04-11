import { analyze } from 'web-audio-beat-detector';

import Logger from './logger';
import { mousedownCallback } from './utilities.js';

const metadataCache: Map<number, { waveform: number[]; bpm: number }> = new Map();

function logCacheState(log: Logger, context: string): void {
  const cacheEntries = Array.from(metadataCache.keys());
  log.debug(
    `[${context}] Memory cache state: ${metadataCache.size} entries - Track IDs: ${cacheEntries.join(', ') || 'none'}`
  );
}

interface PortMessage {
  onMessage: {
    addListener: (callback: (message: any) => void) => void;
  };
  postMessage: (message: any) => void;
}

interface AudioFeaturesConfig {
  config: {
    displayWaveform: boolean;
  };
}

export function toggleWaveformCanvas(port: PortMessage): void {
  port.postMessage({ toggleWaveformDisplay: {} });
}

export function monitorAudioCanPlay(canvasDisplayToggle: HTMLInputElement, generateAudioFeatures: () => void): void {
  const audio = document.querySelector('audio') as HTMLAudioElement;
  if (audio && !audio.paused && canvasDisplayToggle.checked) {
    generateAudioFeatures();
  }
}

export function monitorAudioTimeupdate(
  e: Event,
  canvas: HTMLCanvasElement,
  waveformOverlayColour: string,
  waveformColour: string
): void {
  const audio = e.target as HTMLAudioElement;
  if (!audio || !audio.duration) return;

  const progress = audio.currentTime / audio.duration;
  drawOverlay(canvas, progress, waveformOverlayColour, waveformColour);
}

export function applyAudioConfig(
  msg: AudioFeaturesConfig,
  canvas: HTMLCanvasElement,
  canvasDisplayToggle: HTMLInputElement,
  log: Logger
): void {
  if (!msg.config) {
    return;
  }
  log.info('config recieved from backend' + JSON.stringify(msg.config));
  canvas.style.display = msg.config.displayWaveform ? 'inherit' : 'none';
  canvasDisplayToggle.checked = msg.config.displayWaveform;
}

function extractTrackId(audioSrc: string): number | null {
  const match = audioSrc.match(/stream\/[^/]+\/[^/]+\/(\d+)/);
  if (!match) return null;

  const trackId = parseInt(match[1], 10);
  return isNaN(trackId) ? null : trackId;
}

export async function generateAudioFeatures(
  canvas: HTMLCanvasElement,
  bpmDisplay: HTMLDivElement,
  waveformColour: string,
  log: Logger,
  currentTarget: { value?: string }
): Promise<void> {
  const datapoints = 100;
  const audio = document.querySelector('audio') as HTMLAudioElement;
  if (!audio) return;
  if (currentTarget.value === audio.src) return;

  currentTarget.value = audio.src;
  bpmDisplay.innerText = '';
  canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);

  const trackId = extractTrackId(audio.src);
  if (!trackId) {
    log.warn('Could not extract track ID from audio source');
  } else {
    const cachedMetadata = await (async () => {
      logCacheState(log, 'Before cache check');
      log.debug(`Checking cache for track ID ${trackId}`);

      const memoryCached = metadataCache.get(trackId);
      if (memoryCached) {
        log.info(`✓ MEMORY CACHE HIT for track ${trackId} - Using cached data`);
        return memoryCached;
      }

      log.debug(`✗ Memory cache miss for track ${trackId} - Fetching from API`);
      const apiMetadata = await chrome.runtime
        .sendMessage({
          contentScriptQuery: 'fetchTrackMetadata',
          trackId: trackId
        })
        .catch((error: Error) => {
          log.warn(`Failed to fetch cached metadata: ${error.message}`);
          return null;
        });

      if (apiMetadata && apiMetadata.waveform && apiMetadata.bpm) {
        metadataCache.set(trackId, apiMetadata);
        log.debug(`Stored track ${trackId} in memory cache for next time`);
      }

      return apiMetadata;
    })();

    if (cachedMetadata && cachedMetadata.waveform && cachedMetadata.bpm) {
      log.info(
        `Displaying waveform for track ${trackId} (BPM: ${cachedMetadata.bpm.toFixed(2)}, ${
          cachedMetadata.waveform.length
        } points)`
      );
      bpmDisplay.innerText = `bpm: ${cachedMetadata.bpm.toFixed(2)}`;

      const max = cachedMetadata.waveform.reduce((a: number, b: number) => Math.max(a, b));
      for (let i = 0; i < cachedMetadata.waveform.length; i++) {
        const amplitude = cachedMetadata.waveform[i] / max;
        fillBar(canvas, amplitude, i, cachedMetadata.waveform.length, waveformColour);
      }
      return;
    }

    log.debug(`No cached metadata available for track ${trackId} - will compute locally`);
  }

  (() => {
    const ctx = new AudioContext();
    const src = audio.src.split('stream/')[1];

    chrome.runtime.sendMessage(
      {
        contentScriptQuery: 'renderBuffer',
        url: src
      },
      audioData => {
        const audioBuffer_ = new Uint8Array(audioData.data).buffer;
        const decodePromise = ctx.decodeAudioData(audioBuffer_);

        const bpmPromise = decodePromise.then(decodedAudio =>
          analyze(decodedAudio)
            .then(bpm => {
              bpmDisplay.innerText = `bpm: ${bpm.toFixed(2)}`;
              return bpm;
            })
            .catch(err => {
              log.error(`error finding bpm for track: ${err}`);
              return null;
            })
        );

        const waveformPromise = decodePromise.then(decodedAudio => {
          log.info('calculating rms');
          const leftChannel = decodedAudio.getChannelData(0);

          const stepSize = Math.round(decodedAudio.length / datapoints);

          const rmsSize = Math.min(stepSize, 128);
          const subStepSize = Math.round(stepSize / rmsSize);
          const rmsBuffer = [];
          for (let i = 0; i < datapoints; i++) {
            let rms = 0.0;
            for (let sample = 0; sample < rmsSize; sample++) {
              const sampleIndex = i * stepSize + sample * subStepSize;
              const audioSample = leftChannel[sampleIndex];
              rms += audioSample ** 2;
            }
            rmsBuffer.push(Math.sqrt(rms / rmsSize));
          }

          log.info('visualizing');
          const max = rmsBuffer.reduce((a, b) => Math.max(a, b));
          for (let i = 0; i < rmsBuffer.length; i++) {
            const amplitude = rmsBuffer[i] / max;
            fillBar(canvas, amplitude, i, datapoints, waveformColour);
          }

          return rmsBuffer;
        });

        Promise.all([bpmPromise, waveformPromise]).then(([bpm, waveform]) => {
          if (trackId && bpm !== null && waveform !== null) {
            chrome.runtime
              .sendMessage({
                contentScriptQuery: 'postTrackMetadata',
                trackId: trackId,
                waveform: waveform,
                bpm: bpm
              })
              .catch((error: Error) => {
                log.warn(`Failed to cache track metadata: ${error.message}`);
              });
          }
        });
      }
    );
  })();
}

export function initAudioFeatures(port: PortMessage): void {
  const log = new Logger();
  log.info('Initializing audio features');

  const currentTarget = { value: undefined as string | undefined };

  const canvas = createCanvas();
  canvas.addEventListener('click', mousedownCallback);

  const canvasDisplayToggle = createCanvasDisplayToggle();
  const parentNode = canvasDisplayToggle.parentNode as HTMLElement;
  if (parentNode) {
    parentNode.addEventListener('click', () => toggleWaveformCanvas(port));
  }

  const bpmDisplay = createBpmDisplay();

  let waveformColour: string = 'white';
  let waveformOverlayColour: string = 'black';

  const bg: Element | null = document.querySelector('h2.trackTitle');
  if (bg) {
    waveformColour = window.getComputedStyle(bg, null).getPropertyValue('color');
    waveformOverlayColour = invertColour(waveformColour);
  }

  const audio = document.querySelector('audio');
  if (audio) {
    audio.addEventListener('canplay', () =>
      monitorAudioCanPlay(canvasDisplayToggle, () =>
        generateAudioFeatures(canvas, bpmDisplay, waveformColour, log, currentTarget)
      )
    );
    audio.addEventListener('timeupdate', (e: Event) =>
      monitorAudioTimeupdate(e, canvas, waveformOverlayColour, waveformColour)
    );
  }

  port.onMessage.addListener((msg: AudioFeaturesConfig) => applyAudioConfig(msg, canvas, canvasDisplayToggle, log));
  port.postMessage({ requestConfig: {} });

  log.info('Audio features initialization complete');
}

export function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.style.display = 'none';
  canvas.classList.add('waveform');

  const progbar = document.querySelector('div.progbar');
  if (progbar) {
    progbar.classList.add('waveform');

    const div = document.createElement('div');
    div.append(canvas);
    progbar.prepend(div);
  }
  return canvas;
}

export function createCanvasDisplayToggle(): HTMLInputElement {
  const toggle = document.createElement('input');

  toggle.setAttribute('title', 'toggle waveform display');
  toggle.setAttribute('type', 'checkbox');
  toggle.setAttribute('class', 'bes-toggle');
  toggle.setAttribute('id', 'switch');

  const label = document.createElement('label');
  label.setAttribute('class', 'bes-toggle');
  label.htmlFor = 'switch';
  label.innerHTML = 'Toggle';

  const toggle_div = document.createElement('div');
  toggle_div.append(toggle);
  toggle_div.append(label);

  const inlineplayer = document.querySelector('div.controls');
  if (inlineplayer) {
    inlineplayer.append(toggle_div);
  }

  return toggle;
}

export function createBpmDisplay(): HTMLDivElement {
  const bpmDisplay = document.createElement('div');
  bpmDisplay.setAttribute('class', 'bpm');

  const inlineplayer = document.querySelector('div.progbar');
  if (inlineplayer) {
    inlineplayer.append(bpmDisplay);
  }

  return bpmDisplay;
}

export function fillBar(
  canvas: HTMLCanvasElement,
  amplitude: number,
  index: number,
  numElements: number,
  colour: string = 'white'
): void {
  const ctx = canvas.getContext('2d')!;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = colour;

  const graphHeight = canvas.height * amplitude;
  const barWidth = canvas.width / numElements;
  const position = index * barWidth;
  ctx.fillRect(position, canvas.height, barWidth, -graphHeight);
}

export function drawOverlay(
  canvas: HTMLCanvasElement,
  progress: number,
  colour: string = 'red',
  clearColour: string = 'black'
): void {
  const ctx = canvas.getContext('2d')!;
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = clearColour;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, canvas.width * progress, canvas.height);
}

export function invertColour(colour: string): string {
  const rgb = colour.split('rgb(')[1].split(')')[0].split(',');

  const r = parseInt((255 - parseInt(rgb[0])).toString());
  const g = parseInt((255 - parseInt(rgb[1])).toString());
  const b = parseInt((255 - parseInt(rgb[2])).toString());

  return `rgb(${r},${g},${b})`;
}
