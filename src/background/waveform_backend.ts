import Logger from '../logger';
import {
  fetchTrackMetadata as fetchTrackMetadataFromAPI,
  postTrackMetadata as postTrackMetadataToAPI,
  getFindMusicToken
} from '../clients/findmusic';
import { getDB } from '../utilities';

const log = new Logger();

const STREAM_BASE_URL = 'https://t4.bcbits.com/stream';

type StreamUrl = { type: 'direct-path'; path: string } | { type: 'full-url'; url: string };

interface RenderBufferRequest {
  contentScriptQuery: 'renderBuffer';
  stream?: StreamUrl;
  url?: string;
}

export function processRequest(
  request: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  if (request.contentScriptQuery === 'fetchTrackMetadata') {
    fetchTrackMetadata(request.trackId)
      .then(metadata => {
        sendResponse(metadata);
      })
      .catch(error => {
        log.warn(`Unexpected error in fetchTrackMetadata: ${error.message}`);
        sendResponse(null);
      });
    return true;
  }

  if (request.contentScriptQuery === 'postTrackMetadata') {
    postTrackMetadata(request.trackId, request.waveform, request.bpm)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        log.warn(`Unexpected error in postTrackMetadata: ${error.message}`);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.contentScriptQuery !== 'renderBuffer') return false;

  const renderRequest = request as RenderBufferRequest;

  const url = ((): string | undefined => {
    const { stream, url: legacyPath } = renderRequest;

    if (stream) {
      return stream.type === 'direct-path' ? `${STREAM_BASE_URL}/${stream.path}` : stream.url;
    }

    return legacyPath ? `${STREAM_BASE_URL}/${legacyPath}` : undefined;
  })();

  if (!url) {
    log.error('renderBuffer request missing both stream and url parameters');
    sendResponse(null);
    return true;
  }

  log.debug(`Fetching audio buffer from: ${url.substring(0, 60)}...`);

  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.arrayBuffer();
    })
    .then(arrayBuffer => {
      const uint8Array = new Uint8Array(arrayBuffer);
      const jsonResult = {
        type: 'Buffer',
        data: Array.from(uint8Array)
      };
      sendResponse(jsonResult);
    })
    .catch(error => {
      log.error(`Failed to fetch audio buffer: ${error.message}`);
      sendResponse(null);
    });

  return true;
}

async function fetchTrackMetadata(trackId: number): Promise<{ waveform: number[]; bpm: number } | null> {
  const db = await getDB();
  const config = await db.get('config', 'config');

  if (!config?.enableMetadataCaching) {
    log.debug(`Skipping metadata fetch for track ${trackId} - metadata caching disabled`);
    return null;
  }

  const token = await getFindMusicToken();
  if (!token) {
    log.debug(`Skipping metadata fetch for track ${trackId} - no token available`);
    return null;
  }

  return await fetchTrackMetadataFromAPI(trackId, token);
}

async function postTrackMetadata(trackId: number, waveform: number[], bpm: number): Promise<void> {
  const db = await getDB();
  const config = await db.get('config', 'config');

  if (!config?.enableMetadataCaching) {
    log.debug(`Skipping metadata post for track ${trackId} - metadata caching disabled`);
    return;
  }

  const token = await getFindMusicToken();
  if (!token) {
    log.debug(`Skipping metadata post for track ${trackId} - no token available`);
    return;
  }

  return await postTrackMetadataToAPI(trackId, waveform, bpm, token);
}

export async function initWaveformBackend(): Promise<void> {
  log.info('starting waveform backend.');
  chrome.runtime.onMessage.addListener(processRequest);
}
