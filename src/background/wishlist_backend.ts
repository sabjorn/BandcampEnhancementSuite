import Logger from '../logger';
import { getCollectionSummary, collectItem, uncollectItem, getBandDetails, WishlistItem } from '../bclient';

const log = new Logger();

const BASE_URL = 'https://bandcamp.com';

export const WISHLIST_HEADER_RULE_ID = 1;

const bandHosts = new Map<number, string>();

export function resetBandHostCache(): void {
  bandHosts.clear();
}

async function bandHost(bandId: number): Promise<string> {
  const cached = bandHosts.get(bandId);
  if (cached) return cached;

  const { bandcamp_url } = await getBandDetails(bandId, BASE_URL);
  bandHosts.set(bandId, bandcamp_url);

  return bandcamp_url;
}

function presentAsHost(host: string): Promise<void> {
  return chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [WISHLIST_HEADER_RULE_ID],
    addRules: [
      {
        id: WISHLIST_HEADER_RULE_ID,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'origin', operation: 'remove' },
            { header: 'referer', operation: 'set', value: `${host}/` }
          ]
        },
        condition: {
          requestDomains: ['bandcamp.com'],
          urlFilter: 'collect_item_cb',
          resourceTypes: ['xmlhttprequest', 'other'],
          tabIds: [chrome.tabs.TAB_ID_NONE]
        }
      }
    ]
  } as chrome.declarativeNetRequest.UpdateRuleOptions);
}

function stopPresenting(): Promise<void> {
  return chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [WISHLIST_HEADER_RULE_ID] });
}

async function postAsHost(host: string, post: () => Promise<boolean>): Promise<boolean> {
  await presentAsHost(host);

  try {
    return await post();
  } finally {
    await stopPresenting().catch(error => log.error(`Could not remove the wishlist header rule: ${error}`));
  }
}

async function collect(item: WishlistItem, crumb: string | null): Promise<boolean> {
  const host = await bandHost(item.band_id);

  return postAsHost(host, () => collectItem(item, crumb, host));
}

function uncollect(item: WishlistItem, crumb: string | null): Promise<boolean> {
  return postAsHost(BASE_URL, () => uncollectItem(item, crumb, BASE_URL));
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

  if (request.contentScriptQuery === 'writeWishlistItem') {
    const write = request.action === 'collect' ? collect : uncollect;

    write(request.item, request.crumb)
      .then(() => sendResponse({ ok: true }))
      .catch(error => {
        log.error(`Failed to ${request.action} wishlist item: ${error}`);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  return false;
}

export async function initWishlistBackend(): Promise<void> {
  log.info('starting wishlist backend.');
  chrome.runtime.onMessage.addListener(processRequest);
}
