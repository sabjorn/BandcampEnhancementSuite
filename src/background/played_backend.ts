import Logger from '../logger';
import {
  fetchAlbumTrackState as fetchAlbumTrackStateFromAPI,
  postTrackPlayed as postTrackPlayedToAPI,
  getFindMusicToken,
  TrackState
} from '../clients/findmusic';
import { getDB } from '../utilities';

const log = new Logger();

async function tokenWhenPlayedCachingEnabled(): Promise<string | null> {
  const db = await getDB();
  const config = await db.get('config', 'config');

  if (!config?.enablePlayedCaching) {
    log.debug('Played caching disabled');
    return null;
  }

  const token = await getFindMusicToken();
  if (!token) log.debug('No FindMusic.club token available');

  return token;
}

async function fetchAlbumTrackState(albumId: string): Promise<TrackState | null> {
  const token = await tokenWhenPlayedCachingEnabled();
  if (!token) return null;

  return fetchAlbumTrackStateFromAPI(albumId, token);
}

async function postTrackPlayed(trackId: number): Promise<void> {
  const token = await tokenWhenPlayedCachingEnabled();
  if (!token) return;

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
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        log.warn(`Unexpected error in postTrackPlayed: ${error.message}`);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  return false;
}

export async function initPlayedBackend(): Promise<void> {
  log.info('starting played backend.');
  chrome.runtime.onMessage.addListener(processRequest);
}
