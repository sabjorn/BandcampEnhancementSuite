import Logger from '../logger';
import { getCollectionSummary, getCrumbsFromPage, CollectionSummary } from '../bclient';

const log = new Logger();

// The band subdomains answer /api/fan/2/collection_summary without a tralbum_lookup, so it has to
// be fetched against bandcamp.com. A content script on a band subdomain cannot do that
// cross-origin, so the request lives here — same as the hide/unhide flows.
const BASE_URL = 'https://bandcamp.com';

async function fetchCollectionSummary(): Promise<CollectionSummary | null> {
  try {
    const summary = await getCollectionSummary(BASE_URL);
    log.info(`Collection summary fetched for fan ${summary?.fan_id}`);
    return summary;
  } catch (error) {
    log.error(`Failed to fetch collection summary: ${error}`);
    return null;
  }
}

// A crumb is scoped to a path and a session, not to an item, so one lookup serves every star.
const crumbCache = new Map<string, string>();

async function fetchWishlistCrumb(itemUrl: string, path: string): Promise<string | null> {
  const cached = crumbCache.get(path);
  if (cached) return cached;

  try {
    const crumb = (await getCrumbsFromPage(itemUrl))[path];
    if (!crumb) {
      log.error(`No ${path} crumb on ${itemUrl}`);
      return null;
    }

    crumbCache.set(path, crumb);
    return crumb;
  } catch (error) {
    log.error(`Failed to read a ${path} crumb from ${itemUrl}: ${error}`);
    return null;
  }
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
    fetchCollectionSummary()
      .then(sendResponse)
      .catch(error => {
        log.warn(`Unexpected error in fetchCollectionSummary: ${error.message}`);
        sendResponse(null);
      });
    return true;
  }

  if (request.contentScriptQuery === 'fetchWishlistCrumb') {
    fetchWishlistCrumb(request.itemUrl, request.path)
      .then(sendResponse)
      .catch(error => {
        log.warn(`Unexpected error in fetchWishlistCrumb: ${error.message}`);
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
