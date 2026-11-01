import Logger from '../logger';
import { getCollectionSummary, uncollectItem } from '../bclient';

const log = new Logger();

const BASE_URL = 'https://bandcamp.com';

export const WISHLIST_HEADER_RULE_ID = 1;

function presentAsBaseDomain(): Promise<void> {
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
            { header: 'referer', operation: 'set', value: `${BASE_URL}/` }
          ]
        },
        condition: {
          requestDomains: ['bandcamp.com'],
          urlFilter: 'uncollect_item_cb',
          resourceTypes: ['xmlhttprequest', 'other']
        }
      }
    ]
  } as chrome.declarativeNetRequest.UpdateRuleOptions);
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

  if (request.contentScriptQuery === 'uncollectWishlistItem') {
    uncollectItem(request.item, request.crumb, BASE_URL)
      .then(() => sendResponse({ ok: true }))
      .catch(error => {
        log.error(`Failed to uncollect wishlist item: ${error}`);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  return false;
}

export async function initWishlistBackend(): Promise<void> {
  log.info('starting wishlist backend.');
  chrome.runtime.onMessage.addListener(processRequest);

  await presentAsBaseDomain().catch(error => log.error(`Could not install the wishlist header rule: ${error}`));
}
