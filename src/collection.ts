import Logger from './logger';
import { CollectionSummary, WishlistItem } from './bclient';
import { isBandcampLoggedIn } from './utilities';

const log = new Logger();

export type WishlistItemType = 't' | 'a';

const lookupKey = (itemType: WishlistItemType, itemId: number): string => `${itemType}${itemId}`;

let fanId: number | null = null;
let wishlisted: Set<string> | null = null;
let owned: Set<string> | null = null;
let loading: Promise<boolean> | null = null;
const changing = new Set<string>();

type CrumbPath = 'collect_item_cb' | 'uncollect_item_cb';

function readCrumb(path: CrumbPath): string | null {
  const element = document.getElementById('js-crumbs-data');
  if (!element?.dataset.crumbs) return null;

  try {
    return JSON.parse(element.dataset.crumbs)[path] ?? null;
  } catch {
    return null;
  }
}

function writeCrumb(path: CrumbPath): string | null {
  return readCrumb(path) ?? readCrumb(path === 'collect_item_cb' ? 'uncollect_item_cb' : 'collect_item_cb');
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

    if (!summary.tralbum_lookup) {
      log.error('Collection summary arrived without a tralbum_lookup; wishlist is unavailable');
      return false;
    }

    fanId = summary.fan_id;

    const lookup = Object.entries(summary.tralbum_lookup);
    wishlisted = new Set(lookup.filter(([, item]) => !item.purchased).map(([key]) => key));
    owned = new Set(lookup.filter(([, item]) => item.purchased).map(([key]) => key));

    log.info(`Wishlist state loaded: ${wishlisted.size} wishlisted of ${lookup.length} collection entries`);
    return true;
  } catch (error) {
    log.error(error);
    return false;
  }
}

export interface Collection {
  isAvailable(): boolean;
  isWishlisted(itemType: WishlistItemType, itemId: number): boolean;
  isOwned(itemType: WishlistItemType, itemId: number): boolean;
  toggleWishlisted(itemType: WishlistItemType, itemId: number, host: string): Promise<boolean>;
}

const collection: Collection = {
  isAvailable: () => fanId !== null && wishlisted !== null && owned !== null,
  isWishlisted: (itemType, itemId) => wishlisted?.has(lookupKey(itemType, itemId)) ?? false,
  isOwned: (itemType, itemId) => owned?.has(lookupKey(itemType, itemId)) ?? false,
  toggleWishlisted: (itemType, itemId, host) => toggleWishlisted(itemType, itemId, host)
};

export async function initCollectionState(): Promise<Collection> {
  loading = loading ?? loadWishlistState();
  await loading;

  return collection;
}

async function write(action: 'collect' | 'uncollect', item: WishlistItem, host: string): Promise<void> {
  const written = await chrome.runtime.sendMessage({
    contentScriptQuery: 'writeWishlistItem',
    action,
    item,
    host,
    crumb: writeCrumb(action === 'collect' ? 'collect_item_cb' : 'uncollect_item_cb')
  });

  if (!written?.ok) throw new Error(written?.error ?? 'Bandcamp rejected the wishlist change');
}

async function toggleWishlisted(itemType: WishlistItemType, itemId: number, host: string): Promise<boolean> {
  if (fanId === null || wishlisted === null) throw new Error('Wishlist is unavailable');

  const key = lookupKey(itemType, itemId);
  if (changing.has(key)) throw new Error('This item is already changing');

  const adding = !wishlisted.has(key);

  const item: WishlistItem = {
    fan_id: fanId,
    item_type: itemType,
    item_id: itemId,
    ref_token: readReferrerToken()
  };

  changing.add(key);

  try {
    await write(adding ? 'collect' : 'uncollect', item, host);
  } finally {
    changing.delete(key);
  }

  if (adding) wishlisted.add(key);
  else wishlisted.delete(key);

  return adding;
}

export function resetCollectionState(): void {
  fanId = null;
  wishlisted = null;
  owned = null;
  loading = null;
  changing.clear();
}
