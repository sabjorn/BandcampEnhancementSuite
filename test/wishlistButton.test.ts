import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import Logger from '../src/logger';
import { stubCollection } from './utils';
import { createWishlistButton, setWishlistButtonState } from '../src/components/wishlistButton';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  }
}));

let collection: ReturnType<typeof stubCollection>;

const buildButton = (overrides: Record<string, any> = {}) =>
  createWishlistButton({
    collection,
    itemType: 't',
    itemId: 123456,
    itemUrl: 'https://band.bandcamp.com/track/one',
    log: new Logger(),
    ...overrides
  });

describe('wishlistButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    collection = stubCollection();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createWishlistButton', () => {
    it('should render nothing when the wishlist is unavailable, so logged out pages stay clean', () => {
      collection.isAvailable.mockReturnValue(false);

      expect(buildButton()).toBeNull();
    });

    it('should render a button carrying the bes class and the out state', () => {
      const button = buildButton()!;

      expect(button.tagName).toBe('BUTTON');
      expect(button.classList.contains('bes-wishlist-button')).toBe(true);
      expect(button.dataset.wishlistState).toBe('out');
      expect(button.getAttribute('aria-pressed')).toBe('false');
    });

    it('should start in the in state for an item that is already wishlisted', () => {
      collection.isWishlisted.mockReturnValue(true);

      const button = buildButton()!;

      expect(button.dataset.wishlistState).toBe('in');
      expect(button.getAttribute('aria-pressed')).toBe('true');
    });

    it('should read its initial state for the item it was given', () => {
      buildButton({ itemType: 'a', itemId: 1609998585 });

      expect(collection.isWishlisted).toHaveBeenCalledWith('a', 1609998585);
    });

    it('should hold a filled star when wishlisted and an outlined one when not', () => {
      const outlined = buildButton()!;
      collection.isWishlisted.mockReturnValue(true);
      const filled = buildButton()!;

      expect(outlined.querySelector('svg')?.getAttribute('fill')).toBe('none');
      expect(filled.querySelector('svg')?.getAttribute('fill')).toBe('currentColor');
    });

    it('should render the star at the requested size', () => {
      const button = buildButton({ size: 16 })!;

      expect(button.querySelector('svg')?.getAttribute('width')).toBe('16');
    });

    it('should describe the item in the words Bandcamp uses', () => {
      expect(buildButton()!.title).toBe('Add this track to your wishlist');
      expect(buildButton({ itemType: 'a' })!.title).toBe('Add this album to your wishlist');

      collection.isWishlisted.mockReturnValue(true);
      expect(buildButton()!.title).toBe('Remove this track from your wishlist');
      expect(buildButton({ itemType: 'a' })!.title).toBe('Remove this album from your wishlist');
    });
  });

  describe('clicking', () => {
    it('should toggle the item it was built for', async () => {
      const button = buildButton({
        itemType: 'a',
        itemId: 1609998585,
        itemUrl: 'https://other.bandcamp.com/album/one'
      })!;

      button.click();

      await vi.waitFor(() =>
        expect(collection.toggleWishlisted).toHaveBeenCalledWith('a', 1609998585, 'https://other.bandcamp.com')
      );
    });

    it('should spin while the request is in flight, as the cart button does', async () => {
      collection.toggleWishlisted.mockReturnValue(new Promise(() => {}));

      const button = buildButton()!;
      button.click();

      expect(button.querySelector('.bes-wishlist-spinner')).toBeTruthy();
      expect(button.querySelector('svg')).toBeNull();
    });

    // Without a floor the spinner flashes for a fast response, which reads as a glitch.
    it('should keep spinning for a moment even when the answer is immediate', async () => {
      vi.useFakeTimers();

      try {
        const button = buildButton()!;
        button.click();

        await vi.advanceTimersByTimeAsync(100);
        expect(button.dataset.wishlistState).toBe('loading');

        await vi.advanceTimersByTimeAsync(200);
        expect(button.dataset.wishlistState).toBe('in');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should put the star back once the change settles', async () => {
      const button = buildButton()!;
      button.click();

      await vi.waitFor(() => expect(button.dataset.wishlistState).toBe('in'));
      expect(button.querySelector('.bes-wishlist-spinner')).toBeNull();
      expect(button.querySelector('svg')).toBeTruthy();
    });

    it('should put the star back when the change fails', async () => {
      collection.toggleWishlisted.mockRejectedValue(new Error('nope'));

      const button = buildButton()!;
      button.click();

      await vi.waitFor(() => expect(button.dataset.wishlistState).toBe('out'));
      expect(button.querySelector('.bes-wishlist-spinner')).toBeNull();
      expect(button.querySelector('svg')).toBeTruthy();
    });

    it('should go through a busy state while the request is in flight', async () => {
      let settle: (value: boolean) => void = () => {};
      collection.toggleWishlisted.mockReturnValue(new Promise(resolve => (settle = resolve)));

      const button = buildButton()!;
      button.click();

      expect(button.dataset.wishlistState).toBe('loading');
      expect(button.getAttribute('aria-busy')).toBe('true');

      settle(true);
      await vi.waitFor(() => expect(button.dataset.wishlistState).toBe('in'));
      expect(button.getAttribute('aria-busy')).toBe('false');
    });

    it('should render the state Bandcamp confirmed, not the one we assumed', async () => {
      collection.toggleWishlisted.mockResolvedValue(false);

      const button = buildButton()!;
      button.click();

      await vi.waitFor(() => expect(button.dataset.wishlistState).toBe('out'));
      expect(button.getAttribute('aria-pressed')).toBe('false');
    });

    it('should swap the star for the confirmed state', async () => {
      const button = buildButton()!;
      button.click();

      await vi.waitFor(() => expect(button.querySelector('svg')?.getAttribute('fill')).toBe('currentColor'));
    });

    it('should restore the previous state and log when the change fails', async () => {
      const log = new Logger();
      collection.isWishlisted.mockReturnValue(true);
      collection.toggleWishlisted.mockRejectedValue(new Error('Bandcamp rejected the wishlist change'));

      const button = buildButton({ log })!;
      button.click();

      await vi.waitFor(() => expect(log.error).toHaveBeenCalled());
      expect(button.dataset.wishlistState).toBe('in');
    });

    it('should not let the click reach an enclosing link, which the label page grid wraps it in', () => {
      const link = document.createElement('a');
      link.href = 'https://label.bandcamp.com/album/one';
      const navigated = vi.fn();
      link.addEventListener('click', navigated);
      link.appendChild(buildButton()!);
      document.body.appendChild(link);

      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      link.querySelector('button')!.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(navigated).not.toHaveBeenCalled();
    });

    it('should ignore further clicks while a change is in flight', async () => {
      collection.toggleWishlisted.mockReturnValue(new Promise(() => {}));

      const button = buildButton()!;
      button.click();
      button.click();
      button.click();

      expect(collection.toggleWishlisted).toHaveBeenCalledTimes(1);
    });
  });

  describe('keeping two views of one item in step', () => {
    it('should update a second button for the same item once a change is confirmed', async () => {
      const row = buildButton()!;
      const header = buildButton({ size: 16 })!;
      document.body.append(row, header);

      collection.isWishlisted.mockReturnValue(true);
      row.click();

      await vi.waitFor(() => expect(header.dataset.wishlistState).toBe('in'));
      expect(header.querySelector('svg')?.getAttribute('width')).toBe('16');
    });

    it('should leave a button for a different item alone', async () => {
      const track = buildButton()!;
      const other = buildButton({ itemId: 999 })!;
      document.body.append(track, other);

      collection.isWishlisted.mockImplementation((_type, id) => id === 123456);
      track.click();

      await vi.waitFor(() => expect(track.dataset.wishlistState).toBe('in'));
      expect(other.dataset.wishlistState).toBe('out');
    });

    it('should not resync after a failed change', async () => {
      const row = buildButton()!;
      const header = buildButton()!;
      document.body.append(row, header);

      collection.toggleWishlisted.mockRejectedValue(new Error('nope'));
      collection.isWishlisted.mockReturnValue(true);
      row.click();

      await vi.waitFor(() => expect(row.dataset.wishlistState).toBe('out'));
      expect(header.dataset.wishlistState).toBe('out');
    });
  });

  describe('an item with nothing to route by', () => {
    it('should render nothing without a usable item url', () => {
      expect(buildButton({ itemUrl: '' })).toBeNull();
    });

    it('should render nothing for an unparseable item id', () => {
      expect(buildButton({ itemId: Number('abc') })).toBeNull();
    });

    it('should take the host from a relative url, which a label own release has', () => {
      const button = buildButton({ itemUrl: '/album/same-reason' })!;

      button.click();

      expect(collection.toggleWishlisted).toHaveBeenCalledWith('t', 123456, window.location.origin);
    });
  });

  // Wishlisting something already in the collection is not an action Bandcamp offers, so an owned
  // release shows what it is instead of a star.
  describe('an owned release', () => {
    beforeEach(() => {
      collection.isOwned.mockReturnValue(true);
    });

    it('should show the owned indicator in place of the star', () => {
      const indicator = buildButton()!;

      expect(indicator.classList.contains('bes-owned-indicator')).toBe(true);
      expect(indicator.querySelector('.bes-wishlist-button')).toBeNull();
    });

    it('should not be a control at all', () => {
      const indicator = buildButton()!;

      expect(indicator.tagName).toBe('SPAN');
    });

    it('should say what it is', () => {
      expect(buildButton()!.title).toBe('You own this track');
      expect(buildButton({ itemType: 'a' })!.title).toBe('You own this album');
    });

    it('should carry the owned icon at the requested size', () => {
      const svg = buildButton({ size: 18 })!.querySelector('svg') as SVGElement;

      expect(svg.getAttribute('width')).toBe('18');
    });

    it('should ask about the item it was given', () => {
      buildButton({ itemType: 'a', itemId: 1609998585 });

      expect(collection.isOwned).toHaveBeenCalledWith('a', 1609998585);
    });

    it('should take precedence over a wishlisted state', () => {
      collection.isWishlisted.mockReturnValue(true);

      expect(buildButton()!.classList.contains('bes-owned-indicator')).toBe(true);
    });

    it('should never write', () => {
      buildButton()!.click();

      expect(collection.toggleWishlisted).not.toHaveBeenCalled();
    });

    it('should still render nothing when the wishlist is unavailable', () => {
      collection.isAvailable.mockReturnValue(false);

      expect(buildButton()).toBeNull();
    });
  });

  describe('setWishlistButtonState', () => {
    it('should keep the data attribute, pressed state and title in step', () => {
      const button = buildButton()!;

      setWishlistButtonState(button, 'in');
      expect(button.dataset.wishlistState).toBe('in');
      expect(button.getAttribute('aria-pressed')).toBe('true');
      expect(button.title).toBe('Remove this track from your wishlist');

      setWishlistButtonState(button, 'loading');
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(button.title).toBe('Working…');
    });
  });
});
