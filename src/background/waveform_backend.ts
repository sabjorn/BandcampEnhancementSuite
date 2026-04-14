import Logger from '../logger';
import {
  fetchTrackMetadata as fetchTrackMetadataFromAPI,
  postTrackMetadata as postTrackMetadataToAPI,
  getFindMusicToken
} from '../clients/findmusic';
import { getDB } from '../utilities';

const log = new Logger();

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

  const url = 'https://t4.bcbits.com/stream/' + request.url;

  fetch(url)
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => {
      const uint8Array = new Uint8Array(arrayBuffer);
      const jsonResult = {
        type: 'Buffer',
        data: Array.from(uint8Array)
      };
      sendResponse(jsonResult);
    })
    .catch(error => {
      // eslint-disable-next-line no-console
      console.error(error);
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
