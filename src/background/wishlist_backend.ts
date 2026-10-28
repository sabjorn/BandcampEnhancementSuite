import Logger from '../logger';
import { getCollectionSummary, getCrumbsFromPage } from '../bclient';

const log = new Logger();

const BASE_URL = 'https://bandcamp.com';

const crumbCache = new Map<string, string>();

async function fetchWishlistCrumb(itemUrl: string, path: string): Promise<string | null> {
  const cached = crumbCache.get(path);
  if (cached) return cached;

  const crumb = (await getCrumbsFromPage(itemUrl))[path];
  if (!crumb) {
    log.error(`No ${path} crumb on ${itemUrl}`);
    return null;
  }

  crumbCache.set(path, crumb);
  return crumb;
}

export function resetCrumbCache(): void {
  crumbCache.clear();
}

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

  if (request.contentScriptQuery === 'fetchWishlistCrumb') {
    fetchWishlistCrumb(request.itemUrl, request.path)
      .then(sendResponse)
      .catch(error => {
        log.error(`Failed to read a ${request.path} crumb from ${request.itemUrl}: ${error}`);
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
