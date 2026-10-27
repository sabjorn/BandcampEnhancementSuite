import Logger from './logger';
import { collectItem, uncollectItem, CollectionSummary, WishlistItem } from './bclient';
import { isBandcampLoggedIn } from './utilities';

const log = new Logger();

export type WishlistItemType = 't' | 'a';

// Bandcamp keys its collection lookup by type-then-id, e.g. `t2206380151`.
const lookupKey = (itemType: WishlistItemType, itemId: number): string => `${itemType}${itemId}`;

let fanId: number | null = null;
let wishlisted: Set<string> | null = null;
let loading: Promise<boolean> | null = null;

type CrumbPath = 'collect_item_cb' | 'uncollect_item_cb';

function readPageCrumb(path: CrumbPath): string | null {
  const element = document.getElementById('js-crumbs-data');
  if (!element?.dataset.crumbs) return null;

  try {
    return JSON.parse(element.dataset.crumbs)[path] ?? null;
  } catch {
    return null;
  }
}

// A label or feed page has no wishlist button of its own, so it carries no collect crumb. The
// item's own track or album page always does, and only the service worker can read it.
async function readCrumb(path: CrumbPath, itemUrl: string): Promise<string | null> {
  const pageCrumb = readPageCrumb(path);
  if (pageCrumb) return pageCrumb;

  log.info(`No ${path} crumb on this page; asking the service worker for one`);

  return chrome.runtime.sendMessage({
    contentScriptQuery: 'fetchWishlistCrumb',
    itemUrl,
    path
  });
}

function readReferrerToken(): string | null {
  const script = document.querySelector<HTMLElement>('script[data-referrer-token]');
  if (!script?.dataset.referrerToken) return null;

  try {
    return JSON.parse(script.dataset.referrerToken) ?? null;
  } catch {
    return null;
  }
}

// One collection_summary call per page, fetched by the service worker because the band subdomains
// answer without a tralbum_lookup. It carries the wishlist and the owned collection together, so
// every star on the page reads its state from memory.
async function loadWishlistState(): Promise<boolean> {
  if (!isBandcampLoggedIn()) {
    log.info('Not logged in; wishlist is unavailable');
    return false;
  }

  try {
    const summary: CollectionSummary | null = await chrome.runtime.sendMessage({
      contentScriptQuery: 'fetchCollectionSummary'
    });

    if (!summary?.fan_id) {
      log.info('No fan_id in the collection summary; wishlist is unavailable');
      return false;
    }

    // Without the lookup we cannot tell wishlisted from owned, and rendering every star empty
    // would be worse than rendering none at all.
    if (!summary.tralbum_lookup) {
      log.error('Collection summary arrived without a tralbum_lookup; wishlist is unavailable');
      return false;
    }

    fanId = summary.fan_id;

    const lookup = Object.entries(summary.tralbum_lookup);
    wishlisted = new Set(lookup.filter(([, item]) => !item.purchased).map(([key]) => key));

    log.info(`Wishlist state loaded: ${wishlisted.size} wishlisted of ${lookup.length} collection entries`);
    return true;
  } catch (error) {
    log.error(error);
    return false;
  }
}

export function initWishlistState(): Promise<boolean> {
  loading = loading ?? loadWishlistState();
  return loading;
}

export function isWishlistAvailable(): boolean {
  return fanId !== null && wishlisted !== null;
}

export function isWishlisted(itemType: WishlistItemType, itemId: number): boolean {
  return wishlisted?.has(lookupKey(itemType, itemId)) ?? false;
}

// The cached value is only updated once Bandcamp has confirmed the change, so the icons can never
// claim a state the server does not agree with.
export async function toggleWishlist(
  itemType: WishlistItemType,
  itemId: number,
  bandId: number,
  itemUrl: string
): Promise<boolean> {
  if (fanId === null || wishlisted === null) throw new Error('Wishlist is unavailable');

  const key = lookupKey(itemType, itemId);
  const adding = !wishlisted.has(key);

  const item: WishlistItem = {
    fan_id: fanId,
    item_type: itemType,
    item_id: itemId,
    band_id: bandId,
    ref_token: readReferrerToken()
  };

  // Throws with Bandcamp's own reason if it refuses, which leaves the cache untouched.
  if (adding) await collectItem(item, await readCrumb('collect_item_cb', itemUrl));
  else await uncollectItem(item, await readCrumb('uncollect_item_cb', itemUrl));

  if (adding) wishlisted.add(key);
  else wishlisted.delete(key);

  return adding;
}

export function resetWishlistState(): void {
  fanId = null;
  wishlisted = null;
  loading = null;
}
