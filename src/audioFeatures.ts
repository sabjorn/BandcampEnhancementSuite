import { analyze } from 'web-audio-beat-detector';

import Logger from './logger';
import { mousedownCallback, getDB } from './utilities.js';

// In-memory cache for prefetched metadata
const metadataCache: Map<number, { waveform: number[]; bpm: number }> = new Map();

// Debug helper to inspect cache state
function logCacheState(log: Logger, context: string): void {
  const cacheEntries = Array.from(metadataCache.keys());
  log.debug(`[${context}] Memory cache state: ${metadataCache.size} entries - Track IDs: ${cacheEntries.join(', ') || 'none'}`);
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
  // URL format: https://t4.bcbits.com/stream/{hash}/{encoding}/{track_id}?...
  const match = audioSrc.match(/stream\/[^/]+\/[^/]+\/(\d+)/);
  if (!match) return null;

  const trackId = parseInt(match[1], 10);
  return isNaN(trackId) ? null : trackId;
}

function extractAllTrackIdsFromPage(log: Logger): number[] {
  const trackIds: number[] = [];

  // Try to get TralbumData from the page
  const tralbumDataElement = document.querySelector('[data-tralbum]');
  if (!tralbumDataElement) {
    log.warn('No [data-tralbum] element found on page');
    return trackIds;
  }

  const data = tralbumDataElement.getAttribute('data-tralbum');
  if (!data) {
    log.warn('data-tralbum attribute is empty');
    return trackIds;
  }

  try {
    const tralbumData = JSON.parse(
      data
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
    );

    log.debug(`Parsed tralbum data, has trackinfo: ${!!tralbumData.trackinfo}`);

    // Extract track IDs from trackinfo array
    if (tralbumData.trackinfo && Array.isArray(tralbumData.trackinfo)) {
      log.debug(`Found ${tralbumData.trackinfo.length} tracks in trackinfo`);

      tralbumData.trackinfo.forEach((track: any, index: number) => {
        if (track.file && typeof track.file === 'object') {
          // Get any file URL (mp3-128, mp3-v0, etc.)
          const fileUrl = Object.values(track.file)[0];
          if (typeof fileUrl === 'string') {
            const trackId = extractTrackId(fileUrl);
            if (trackId !== null) {
              trackIds.push(trackId);
              log.debug(`Track ${index}: extracted ID ${trackId} from ${fileUrl}`);
            } else {
              log.warn(`Track ${index}: failed to extract ID from ${fileUrl}`);
            }
          } else {
            log.warn(`Track ${index}: file URL is not a string: ${typeof fileUrl}`);
          }
        } else {
          log.debug(`Track ${index}: no file object found`);
        }
      });
    } else {
      log.warn('No trackinfo array found in tralbum data');
    }
  } catch (error) {
    log.error(`Failed to parse tralbum data: ${error}`);
  }

  log.info(`Extracted ${trackIds.length} track IDs from page: ${trackIds.join(', ')}`);
  return trackIds;
}

async function prefetchTrackMetadata(log: Logger): Promise<void> {
  log.info('=== Starting prefetch metadata ===');

  try {
    const db = await getDB();
    const config = await db.get('config', 'config');

    log.info(`Config state - displayWaveform: ${config?.displayWaveform}, enableFindMusicCaching: ${config?.enableFindMusicCaching}`);

    // Only prefetch if both waveform display and caching are enabled
    if (!config?.displayWaveform) {
      log.info('Prefetch skipped: waveform display is disabled');
      return;
    }

    if (!config?.enableFindMusicCaching) {
      log.info('Prefetch skipped: FindMusic caching is disabled');
      return;
    }

    const trackIds = extractAllTrackIdsFromPage(log);
    if (trackIds.length === 0) {
      log.warn('No tracks found on page for prefetching');
      return;
    }

    log.info(`Starting prefetch for ${trackIds.length} tracks: ${trackIds.join(', ')}`);

    // Prefetch all track metadata
    const prefetchPromises = trackIds.map(async (trackId, index) => {
      try {
        log.debug(`[${index + 1}/${trackIds.length}] Fetching metadata for track ${trackId}`);

        const metadata = await chrome.runtime.sendMessage({
          contentScriptQuery: 'fetchTrackMetadata',
          trackId: trackId
        });

        if (metadata && metadata.waveform && metadata.bpm) {
          metadataCache.set(trackId, metadata);
          log.info(`✓ Cached metadata for track ${trackId} (BPM: ${metadata.bpm.toFixed(2)}, Waveform: ${metadata.waveform.length} points)`);
          return { trackId, success: true };
        } else {
          log.debug(`✗ No cached metadata available for track ${trackId}`);
          return { trackId, success: false };
        }
      } catch (error) {
        log.debug(`✗ Failed to fetch metadata for track ${trackId}: ${error}`);
        return { trackId, success: false };
      }
    });

    const results = await Promise.all(prefetchPromises);
    const successCount = results.filter(r => r.success).length;

    logCacheState(log, 'After prefetch');
    log.info(`=== Prefetch complete: ${successCount}/${trackIds.length} tracks cached in memory ===`);
  } catch (error) {
    log.error(`Failed to prefetch metadata: ${error}`);
  }
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

  if (currentTarget.value !== audio.src) {
    currentTarget.value = audio.src;

    bpmDisplay.innerText = '';
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);

    const trackId = extractTrackId(audio.src);
    if (!trackId) {
      log.warn('Could not extract track ID from audio source');
    }

    if (trackId) {
      logCacheState(log, 'Before cache check');
      log.debug(`Checking cache for track ID ${trackId}`);

      // Check in-memory cache first (from prefetch)
      let cachedMetadata = metadataCache.get(trackId);

      if (cachedMetadata) {
        log.info(`✓ MEMORY CACHE HIT for track ${trackId} - Using prefetched data`);
      } else {
        log.debug(`✗ Memory cache miss for track ${trackId} - Fetching from API`);

        // If not in memory, try fetching from API
        cachedMetadata = await chrome.runtime
          .sendMessage({
            contentScriptQuery: 'fetchTrackMetadata',
            trackId: trackId
          })
          .catch((error: Error) => {
            log.warn(`Failed to fetch cached metadata: ${error.message}`);
            return null;
          });

        // Store in memory cache for future use
        if (cachedMetadata && cachedMetadata.waveform && cachedMetadata.bpm) {
          metadataCache.set(trackId, cachedMetadata);
          log.debug(`Stored track ${trackId} in memory cache for next time`);
        }
      }

      if (cachedMetadata && cachedMetadata.waveform && cachedMetadata.bpm) {
        log.info(`Displaying waveform for track ${trackId} (BPM: ${cachedMetadata.bpm.toFixed(2)}, ${cachedMetadata.waveform.length} points)`);
        bpmDisplay.innerText = `bpm: ${cachedMetadata.bpm.toFixed(2)}`;

        const max = cachedMetadata.waveform.reduce((a: number, b: number) => Math.max(a, b));
        for (let i = 0; i < cachedMetadata.waveform.length; i++) {
          const amplitude = cachedMetadata.waveform[i] / max;
          fillBar(canvas, amplitude, i, cachedMetadata.waveform.length, waveformColour);
        }
        return;
      } else {
        log.debug(`No cached metadata available for track ${trackId} - will compute locally`);
      }
    }

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

        let computedBpm: number | null = null;
        let computedWaveform: number[] | null = null;

        decodePromise.then(decodedAudio => {
          analyze(decodedAudio)
            .then(bmp => {
              computedBpm = bmp;
              bpmDisplay.innerText = `bpm: ${bmp.toFixed(2)}`;

              if (trackId && computedWaveform !== null) {
                chrome.runtime
                  .sendMessage({
                    contentScriptQuery: 'postTrackMetadata',
                    trackId: trackId,
                    waveform: computedWaveform,
                    bpm: computedBpm
                  })
                  .catch((error: Error) => {
                    log.warn(`Failed to cache track metadata: ${error.message}`);
                  });
              }
            })
            .catch(err => log.error(`error finding bpm for track: ${err}`));
        });

        decodePromise.then(decodedAudio => {
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

          computedWaveform = rmsBuffer;

          log.info('visualizing');
          const max = rmsBuffer.reduce(function (a, b) {
            return Math.max(a, b);
          });
          for (let i = 0; i < rmsBuffer.length; i++) {
            const amplitude = rmsBuffer[i] / max;
            fillBar(canvas, amplitude, i, datapoints, waveformColour);
          }

          if (trackId && computedBpm !== null) {
            chrome.runtime
              .sendMessage({
                contentScriptQuery: 'postTrackMetadata',
                trackId: trackId,
                waveform: computedWaveform,
                bpm: computedBpm
              })
              .catch((error: Error) => {
                log.warn(`Failed to cache track metadata: ${error.message}`);
              });
          }
        });
      }
    );
  }
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

  // Prefetch metadata for all tracks on the page
  log.info('Calling prefetchTrackMetadata()');
  prefetchTrackMetadata(log);
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
  toggle.setAttribute('class', 'waveform');
  toggle.setAttribute('id', 'switch');

  const label = document.createElement('label');
  label.setAttribute('class', 'waveform');
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
