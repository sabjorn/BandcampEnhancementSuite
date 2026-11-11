import Logger from '../logger';
import { Collection, CollectionItemType } from '../collection';
import { starIcon, ownedIcon } from './player/icons';

export const WISHLIST_ICON_SIZES = {
  trackRow: 12,
  albumBuy: 14,
  grid: 18
} as const;

const DEFAULT_ICON_SIZE = WISHLIST_ICON_SIZES.trackRow;
export const MIN_SPINNER_MS = 250;
const CHANGE_EVENT = 'bes-wishlist-change';

export type WishlistButtonState = 'in' | 'out' | 'loading';

const NOUNS: Record<CollectionItemType, string> = {
  t: 'track',
  a: 'album'
};

function titleFor(state: WishlistButtonState, noun: string): string {
  if (state === 'loading') return 'Working…';

  return state === 'in' ? `Remove this ${noun} from your wishlist` : `Add this ${noun} to your wishlist`;
}

function withMinDuration<T>(promise: Promise<T>, ms: number): Promise<T> {
  const elapsed = new Promise<void>(resolve => setTimeout(resolve, ms));
  const settled = promise.then(
    result => () => result,
    error => () => {
      throw error;
    }
  );

  return Promise.all([settled, elapsed]).then(([outcome]) => outcome());
}

export function setWishlistButtonState(button: HTMLElement, state: WishlistButtonState): void {
  const noun = button.dataset.wishlistNoun ?? 'item';
  const size = Number(button.dataset.wishlistSize) || DEFAULT_ICON_SIZE;
  button.dataset.wishlistState = state;
  button.title = titleFor(state, noun);
  button.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
  button.setAttribute('aria-pressed', state === 'in' ? 'true' : 'false');

  button.innerHTML =
    state === 'loading' ? '<span class="bes-wishlist-spinner"></span>' : starIcon(size, state === 'in');
}

const sameItem = (one: HTMLElement, other: HTMLElement): boolean =>
  one.dataset.wishlistType === other.dataset.wishlistType && one.dataset.wishlistId === other.dataset.wishlistId;

let syncListening = false;

function listenForChangesOnce(): void {
  if (syncListening) return;

  document.addEventListener(CHANGE_EVENT, event => {
    const source = event.target as HTMLElement;
    const confirmed = source.dataset.wishlistState as WishlistButtonState;

    document.querySelectorAll<HTMLElement>('.bes-wishlist-button').forEach(button => {
      if (button === source || button.dataset.wishlistState === 'loading') return;
      if (sameItem(button, source)) setWishlistButtonState(button, confirmed);
    });
  });
  syncListening = true;
}

interface CreateWishlistButtonOptions {
  collection: Collection;
  itemType: CollectionItemType;
  itemId: number;
  itemUrl: string;
  log: Logger;
  size?: number;
}

function hostOf(itemUrl: string): string | null {
  if (!itemUrl.trim()) return null;

  try {
    return new URL(itemUrl, window.location.href).origin;
  } catch {
    return null;
  }
}

function ownedIndicator(itemType: CollectionItemType, size: number): HTMLElement {
  const indicator = document.createElement('span');
  indicator.className = 'bes-owned-indicator';
  indicator.title = `You own this ${NOUNS[itemType]}`;
  indicator.innerHTML = ownedIcon(size);

  return indicator;
}

export function createWishlistButton(options: CreateWishlistButtonOptions): HTMLElement | null {
  const { collection, itemType, itemId, itemUrl, log, size = DEFAULT_ICON_SIZE } = options;

  if (!collection.isAvailable()) return null;

  const host = hostOf(itemUrl);
  if (!host || !Number.isFinite(itemId)) return null;

  if (collection.isOwned(itemType, itemId)) return ownedIndicator(itemType, size);

  listenForChangesOnce();

  const button = document.createElement('button');
  button.className = 'bes-wishlist-button';
  button.type = 'button';
  button.dataset.wishlistType = itemType;
  button.dataset.wishlistId = String(itemId);
  button.dataset.wishlistNoun = NOUNS[itemType];
  button.dataset.wishlistSize = String(size);

  setWishlistButtonState(button, collection.isWishlisted(itemType, itemId) ? 'in' : 'out');

  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();

    const previous = button.dataset.wishlistState as WishlistButtonState;
    if (previous === 'loading') return;

    setWishlistButtonState(button, 'loading');

    withMinDuration(collection.toggleWishlisted(itemType, itemId, host), MIN_SPINNER_MS)
      .then(nowWishlisted => {
        setWishlistButtonState(button, nowWishlisted ? 'in' : 'out');
        button.dispatchEvent(new CustomEvent(CHANGE_EVENT, { bubbles: true }));
      })
      .catch(error => {
        log.error(error);
        setWishlistButtonState(button, previous);
      });
  });

  return button;
}
