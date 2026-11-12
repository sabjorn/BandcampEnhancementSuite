import Logger from '../logger';
import { getCollectionSummary, collectItem, uncollectItem, WishlistItem } from '../bclient';
import { WishlistAction, CrumbPath, CRUMB_PATHS } from '../types/wishlist';
import { getDB } from '../utilities';

const log = new Logger();

const BASE_URL = 'https://bandcamp.com';

const CRUMB_STORE = 'config';
const CRUMB_KEY = 'wishlistCrumbs';

let crumbs: Partial<Record<CrumbPath, string>> | null = null;

async function knownCrumbs(): Promise<Partial<Record<CrumbPath, string>>> {
  if (crumbs) return crumbs;

  try {
    const db = await getDB();
    crumbs = (await db.get(CRUMB_STORE, CRUMB_KEY)) ?? {};
  } catch (error) {
    log.error(`Could not read the stored wishlist crumbs: ${error}`);
    crumbs = {};
  }

  return crumbs;
}

async function storeCrumbs(known: Partial<Record<CrumbPath, string>>): Promise<void> {
  try {
    const db = await getDB();
    await db.put(CRUMB_STORE, known, CRUMB_KEY);
  } catch (error) {
    log.error(`Could not store the wishlist crumb: ${error}`);
  }
}

async function rememberCrumb(path: CrumbPath, crumb: string): Promise<void> {
  const known = await knownCrumbs();
  if (known[path] === crumb) return;

  known[path] = crumb;
  await storeCrumbs(known);
}

async function forgetCrumb(path: CrumbPath): Promise<void> {
  const known = await knownCrumbs();
  if (!(path in known)) return;

  delete known[path];
  await storeCrumbs(known);
}

export function resetWishlistCrumbs(): void {
  crumbs = null;
}

export const WISHLIST_HEADER_RULE_ID = 1;

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

let pending: Promise<unknown> = Promise.resolve();

function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const queued = pending.then(task);
  pending = queued.catch(() => undefined);

  return queued;
}

async function postAsHost<T>(host: string, post: () => Promise<T>): Promise<T> {
  await presentAsHost(host);

  try {
    return await post();
  } finally {
    await stopPresenting().catch(error => log.error(`Could not remove the wishlist header rule: ${error}`));
  }
}

function collect(item: WishlistItem, crumb: string | null, host: string): Promise<string | null> {
  return postAsHost(host, () => collectItem(item, crumb, host));
}

function uncollect(item: WishlistItem, crumb: string | null): Promise<string | null> {
  return postAsHost(BASE_URL, () => uncollectItem(item, crumb, BASE_URL));
}

interface WriteRequest {
  action: WishlistAction;
  item: WishlistItem;
  host: string;
  crumb: string | null;
}

async function writeItem(request: WriteRequest): Promise<void> {
  const path = CRUMB_PATHS[request.action];
  const crumb = (await knownCrumbs())[path] ?? request.crumb;

  const accepted = await (request.action === 'collect'
    ? collect(request.item, crumb, request.host)
    : uncollect(request.item, crumb)
  ).catch(async error => {
    await forgetCrumb(path);
    throw error;
  });

  if (accepted) await rememberCrumb(path, accepted);
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
    oneAtATime(() => writeItem(request))
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
