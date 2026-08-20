import { analyze } from 'web-audio-beat-detector';

import Logger from './logger';

const metadataCache: Map<number, { waveform: number[]; bpm: number }> = new Map();

export function extractTrackId(audioSrc: string): number | null {
  const match = audioSrc.match(/stream\/[^/]+\/[^/]+\/(\d+)/);
  if (!match) return null;

  const trackId = parseInt(match[1], 10);
  return isNaN(trackId) ? null : trackId;
}

export async function fetchCachedMetadata(
  trackId: number,
  log: Logger
): Promise<{ waveform: number[]; bpm: number } | null> {
  const memoryCached = metadataCache.get(trackId);
  if (memoryCached) {
    return memoryCached;
  }

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
  }

  return apiMetadata;
}

export interface AudioFeatureOptions {
  urlFormatter?: (audioSrc: string) => {
    url?: string;
    stream?: { type: 'direct-path' | 'full-url'; path?: string; url?: string };
  };
  trackId?: number | null;
}

export async function generateAudioFeatures(
  currentAudio: () => HTMLAudioElement | null,
  canvas: HTMLCanvasElement,
  onBpmUpdate: (bpm: number | null) => void,
  waveformColour: string,
  log: Logger,
  currentTarget: { value?: string },
  options: AudioFeatureOptions = {}
): Promise<void> {
  const datapoints = 100;
  const audio = currentAudio();
  if (!audio) return;
  if (currentTarget.value === audio.src) return;

  currentTarget.value = audio.src;
  onBpmUpdate(null);
  canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);

  const trackId = options.trackId ?? extractTrackId(audio.src);
  if (!trackId) {
    log.warn(`Track id unknown for ${audio.src}, metadata will be neither read from nor written to the cache`);
  }

  if (trackId) {
    const cachedMetadata = await fetchCachedMetadata(trackId, log);
    if (cachedMetadata && cachedMetadata.waveform && cachedMetadata.bpm) {
      onBpmUpdate(cachedMetadata.bpm);

      const max = cachedMetadata.waveform.reduce((a: number, b: number) => Math.max(a, b));
      for (let i = 0; i < cachedMetadata.waveform.length; i++) {
        const amplitude = cachedMetadata.waveform[i] / max;
        fillBar(canvas, amplitude, i, cachedMetadata.waveform.length, waveformColour);
      }
      return;
    }
  }

  const ctx = new AudioContext();

  const requestParams = options.urlFormatter
    ? options.urlFormatter(audio.src)
    : { url: audio.src.split('stream/')[1] };

  chrome.runtime.sendMessage(
    {
      contentScriptQuery: 'renderBuffer',
      ...requestParams
    },
    audioData => {
      const audioBuffer_ = new Uint8Array(audioData.data).buffer;
      const decodePromise = ctx.decodeAudioData(audioBuffer_);

      const bpmPromise = decodePromise.then(decodedAudio =>
        analyze(decodedAudio)
          .then(bpm => {
            onBpmUpdate(bpm);
            return bpm;
          })
          .catch(err => {
            log.error(`error finding bpm for track: ${err}`);
            return null;
          })
      );

      const waveformPromise = decodePromise.then(decodedAudio => {
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
