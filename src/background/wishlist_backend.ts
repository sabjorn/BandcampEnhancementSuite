import Logger from '../logger';
import { getCollectionSummary } from '../bclient';

const log = new Logger();

const BASE_URL = 'https://bandcamp.com';

export function processRequest(
  request: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  if (request.contentScriptQuery === 'fetchCollectionSummary') {
    getCollectionSummary(BASE_URL)
      .then(sendResponse)
      .catch(error => {
        log.error(`Failed to fetch collection summary: ${error}`);
        sendResponse(null);
      });
    return true;
  }

  return false;
}

export async function initWishlistBackend(): Promise<void> {
  log.info('starting wishlist backend.');
  chrome.runtime.onMessage.addListener(processRequest);
}
