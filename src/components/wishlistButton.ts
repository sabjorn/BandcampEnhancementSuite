import Logger from '../logger';
import { isWishlistAvailable, isWishlisted, toggleWishlist, WishlistItemType } from '../wishlist';
import { extractBandId } from '../utilities';
import { starIcon } from './player/icons';

const DEFAULT_ICON_SIZE = 12;
const CHANGE_EVENT = 'bes-wishlist-change';

export type WishlistButtonState = 'in' | 'out' | 'loading';

const NOUNS: Record<WishlistItemType, string> = {
  t: 'track',
  a: 'album'
};

function titleFor(state: WishlistButtonState, noun: string, writable: boolean): string {
  if (state === 'loading') return 'Working…';
  if (!writable) return `Wishlist this ${noun} from its own page — this page belongs to another artist`;

  return state === 'in' ? `Remove this ${noun} from your wishlist` : `Add this ${noun} to your wishlist`;
}

function pageOwnsBand(bandId: number): boolean {
  const pageBandId = extractBandId();

  return pageBandId !== null && pageBandId === bandId;
}

export function setWishlistButtonState(button: HTMLElement, state: WishlistButtonState): void {
  const noun = button.dataset.wishlistNoun ?? 'item';
  const size = Number(button.dataset.wishlistSize) || DEFAULT_ICON_SIZE;
  const writable = button.dataset.wishlistWritable !== 'false';

  button.dataset.wishlistState = state;
  button.title = titleFor(state, noun, writable);
  button.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
  button.setAttribute('aria-pressed', state === 'in' ? 'true' : 'false');

  if (state !== 'loading') button.innerHTML = starIcon(size, state === 'in');
}

export function refreshWishlistButton(button: HTMLElement): void {
  if (button.dataset.wishlistState === 'loading') return;

  const itemType = button.dataset.wishlistType as WishlistItemType | undefined;
  const itemId = Number(button.dataset.wishlistId);
  if (!itemType || !itemId) return;

  setWishlistButtonState(button, isWishlisted(itemType, itemId) ? 'in' : 'out');
}

let syncListening = false;

function listenForChangesOnce(): void {
  if (syncListening) return;

  document.addEventListener(CHANGE_EVENT, event => {
    const source = event.target as HTMLElement;

    document.querySelectorAll<HTMLElement>('.bes-wishlist-button').forEach(button => {
      if (button !== source) refreshWishlistButton(button);
    });
  });
  syncListening = true;
}

interface CreateWishlistButtonOptions {
  itemType: WishlistItemType;
  itemId: number;
  bandId: number;
  log: Logger;
  size?: number;
}

export function createWishlistButton(options: CreateWishlistButtonOptions): HTMLButtonElement | null {
  const { itemType, itemId, bandId, log, size = DEFAULT_ICON_SIZE } = options;

  if (!isWishlistAvailable()) return null;

  listenForChangesOnce();

  const writable = pageOwnsBand(bandId);

  const button = document.createElement('button');
  button.className = 'bes-wishlist-button';
  button.type = 'button';
  button.disabled = !writable;
  button.dataset.wishlistType = itemType;
  button.dataset.wishlistId = String(itemId);
  button.dataset.wishlistNoun = NOUNS[itemType];
  button.dataset.wishlistSize = String(size);
  button.dataset.wishlistWritable = String(writable);

  setWishlistButtonState(button, isWishlisted(itemType, itemId) ? 'in' : 'out');

  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();

    if (!writable) return;

    const previous = button.dataset.wishlistState as WishlistButtonState;
    if (previous === 'loading') return;

    setWishlistButtonState(button, 'loading');

    toggleWishlist(itemType, itemId, bandId)
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
