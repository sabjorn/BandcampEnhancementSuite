import Logger from '../logger';
import {
  fetchAlbumTrackState as fetchAlbumTrackStateFromAPI,
  postTrackPlayed as postTrackPlayedToAPI,
  getFindMusicToken,
  TrackState
} from '../clients/findmusic';
import { getDB } from '../utilities';

const log = new Logger();

async function playedCachingEnabled(): Promise<boolean> {
  const db = await getDB();
  const config = await db.get('config', 'config');

  return Boolean(config?.enablePlayedCaching);
}

async function fetchAlbumTrackState(albumId: string): Promise<TrackState | null> {
  if (!(await playedCachingEnabled())) {
    log.debug(`Skipping track state fetch for album ${albumId} - played caching disabled`);
    return null;
  }

  const token = await getFindMusicToken();
  if (!token) {
    log.debug(`Skipping track state fetch for album ${albumId} - no token available`);
    return null;
  }

  return fetchAlbumTrackStateFromAPI(albumId, token);
}

async function postTrackPlayed(trackId: number): Promise<boolean> {
  if (!(await playedCachingEnabled())) {
    log.debug(`Skipping play post for track ${trackId} - played caching disabled`);
    return false;
  }

  const token = await getFindMusicToken();
  if (!token) {
    log.debug(`Skipping play post for track ${trackId} - no token available`);
    return false;
  }

  return postTrackPlayedToAPI(trackId, token);
}

export function processRequest(
  request: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  if (request.contentScriptQuery === 'fetchAlbumTrackState') {
    fetchAlbumTrackState(request.albumId)
      .then(sendResponse)
      .catch(error => {
        log.warn(`Unexpected error in fetchAlbumTrackState: ${error.message}`);
        sendResponse(null);
      });
    return true;
  }

  if (request.contentScriptQuery === 'postTrackPlayed') {
    postTrackPlayed(request.trackId)
      .then(recorded => sendResponse({ success: true, recorded }))
      .catch(error => {
        log.warn(`Unexpected error in postTrackPlayed: ${error.message}`);
        sendResponse({ success: false, recorded: false, error: error.message });
      });
    return true;
  }

  return false;
}

export async function initPlayedBackend(): Promise<void> {
  log.info('starting played backend.');
  chrome.runtime.onMessage.addListener(processRequest);
}
