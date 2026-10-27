import Logger from '../logger';
import { isWishlistAvailable, isWishlisted, toggleWishlist, WishlistItemType } from '../wishlist';
import { starIcon } from './player/icons';

const DEFAULT_ICON_SIZE = 12;
const CHANGE_EVENT = 'bes-wishlist-change';

export type WishlistButtonState = 'in' | 'out' | 'loading';

const NOUNS: Record<WishlistItemType, string> = {
  t: 'track',
  a: 'album'
};

// Bandcamp's own wording for its wishlist star.
function titleFor(state: WishlistButtonState, noun: string): string {
  if (state === 'loading') return 'Working…';

  return state === 'in' ? `Remove this ${noun} from your wishlist` : `Add this ${noun} to your wishlist`;
}

export function setWishlistButtonState(button: HTMLElement, state: WishlistButtonState): void {
  const noun = button.dataset.wishlistNoun ?? 'item';
  const size = Number(button.dataset.wishlistSize) || DEFAULT_ICON_SIZE;

  button.dataset.wishlistState = state;
  button.title = titleFor(state, noun);
  button.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
  button.setAttribute('aria-pressed', state === 'in' ? 'true' : 'false');

  if (state !== 'loading') button.innerHTML = starIcon(size, state === 'in');
}

// Lets a second view of the same item (a row star and the now-playing star) pick up a change made
// through the other one. Mid-request buttons are left alone so we don't fight their own update.
export function refreshWishlistButton(button: HTMLElement): void {
  if (button.dataset.wishlistState === 'loading') return;

  const itemType = button.dataset.wishlistType as WishlistItemType | undefined;
  const itemId = Number(button.dataset.wishlistId);
  if (!itemType || !itemId) return;

  setWishlistButtonState(button, isWishlisted(itemType, itemId) ? 'in' : 'out');
}

let syncListening = false;

// An item can be on screen twice — a tracklist row and the now-playing header. A confirmed change
// through either one refreshes the rest from the shared state.
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
  // The item's own Bandcamp page, which is where a collect crumb can be found when the current
  // page carries none.
  itemUrl: string;
  log: Logger;
  size?: number;
}

export function createWishlistButton(options: CreateWishlistButtonOptions): HTMLButtonElement | null {
  const { itemType, itemId, bandId, itemUrl, log, size = DEFAULT_ICON_SIZE } = options;

  if (!isWishlistAvailable()) return null;

  listenForChangesOnce();

  const button = document.createElement('button');
  button.className = 'bes-wishlist-button';
  button.type = 'button';
  button.dataset.wishlistType = itemType;
  button.dataset.wishlistId = String(itemId);
  button.dataset.wishlistNoun = NOUNS[itemType];
  button.dataset.wishlistSize = String(size);

  setWishlistButtonState(button, isWishlisted(itemType, itemId) ? 'in' : 'out');

  button.addEventListener('click', event => {
    // On the label page grid the star sits inside the album's link, and in the drawer inside a
    // row that starts playback — neither should fire when the star is clicked.
    event.preventDefault();
    event.stopPropagation();

    const previous = button.dataset.wishlistState as WishlistButtonState;
    if (previous === 'loading') return;

    setWishlistButtonState(button, 'loading');

    toggleWishlist(itemType, itemId, bandId, itemUrl)
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
