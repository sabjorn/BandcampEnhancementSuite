import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import Logger from '../src/logger';
import { isWishlistAvailable, isWishlisted, toggleWishlist } from '../src/wishlist';
import { createWishlistButton, setWishlistButtonState, refreshWishlistButton } from '../src/components/wishlistButton';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  }
}));

vi.mock('../src/wishlist', () => ({
  isWishlistAvailable: vi.fn(),
  isWishlisted: vi.fn(),
  toggleWishlist: vi.fn()
}));

const buildButton = (overrides: Record<string, any> = {}) =>
  createWishlistButton({
    itemType: 't',
    itemId: 123456,
    log: new Logger(),
    ...overrides
  });

describe('wishlistButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    vi.mocked(isWishlistAvailable).mockReturnValue(true);
    vi.mocked(isWishlisted).mockReturnValue(false);
    vi.mocked(toggleWishlist).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createWishlistButton', () => {
    it('should render nothing when the wishlist is unavailable, so logged out pages stay clean', () => {
      vi.mocked(isWishlistAvailable).mockReturnValue(false);

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
      vi.mocked(isWishlisted).mockReturnValue(true);

      const button = buildButton()!;

      expect(button.dataset.wishlistState).toBe('in');
      expect(button.getAttribute('aria-pressed')).toBe('true');
    });

    it('should read its initial state for the item it was given', () => {
      buildButton({ itemType: 'a', itemId: 1609998585 });

      expect(isWishlisted).toHaveBeenCalledWith('a', 1609998585);
    });

    it('should hold a filled star when wishlisted and an outlined one when not', () => {
      const outlined = buildButton()!;
      vi.mocked(isWishlisted).mockReturnValue(true);
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

      vi.mocked(isWishlisted).mockReturnValue(true);
      expect(buildButton()!.title).toBe('Remove this track from your wishlist');
      expect(buildButton({ itemType: 'a' })!.title).toBe('Remove this album from your wishlist');
    });
  });

  describe('clicking', () => {
    it('should toggle the item it was built for', async () => {
      const button = buildButton({ itemType: 'a', itemId: 1609998585 })!;

      button.click();

      await vi.waitFor(() => expect(toggleWishlist).toHaveBeenCalledWith('a', 1609998585));
    });

    it('should go through a busy state while the request is in flight', async () => {
      let settle: (value: boolean) => void = () => {};
      vi.mocked(toggleWishlist).mockReturnValue(new Promise(resolve => (settle = resolve)));

      const button = buildButton()!;
      button.click();

      expect(button.dataset.wishlistState).toBe('loading');
      expect(button.getAttribute('aria-busy')).toBe('true');

      settle(true);
      await vi.waitFor(() => expect(button.dataset.wishlistState).toBe('in'));
      expect(button.getAttribute('aria-busy')).toBe('false');
    });

    it('should render the state Bandcamp confirmed, not the one we assumed', async () => {
      vi.mocked(toggleWishlist).mockResolvedValue(false);

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
      vi.mocked(isWishlisted).mockReturnValue(true);
      vi.mocked(toggleWishlist).mockRejectedValue(new Error('Bandcamp rejected the wishlist change'));

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
      vi.mocked(toggleWishlist).mockReturnValue(new Promise(() => {}));

      const button = buildButton()!;
      button.click();
      button.click();
      button.click();

      expect(toggleWishlist).toHaveBeenCalledTimes(1);
    });
  });

  describe('keeping two views of one item in step', () => {
    it('should update a second button for the same item once a change is confirmed', async () => {
      const row = buildButton()!;
      const header = buildButton({ size: 16 })!;
      document.body.append(row, header);

      vi.mocked(isWishlisted).mockReturnValue(true);
      row.click();

      await vi.waitFor(() => expect(header.dataset.wishlistState).toBe('in'));
      expect(header.querySelector('svg')?.getAttribute('width')).toBe('16');
    });

    it('should leave a button for a different item alone', async () => {
      const track = buildButton()!;
      const other = buildButton({ itemId: 999 })!;
      document.body.append(track, other);

      vi.mocked(isWishlisted).mockImplementation((_type, id) => id === 123456);
      track.click();

      await vi.waitFor(() => expect(track.dataset.wishlistState).toBe('in'));
      expect(other.dataset.wishlistState).toBe('out');
    });

    it('should not resync after a failed change', async () => {
      const row = buildButton()!;
      const header = buildButton()!;
      document.body.append(row, header);

      vi.mocked(toggleWishlist).mockRejectedValue(new Error('nope'));
      vi.mocked(isWishlisted).mockReturnValue(true);
      row.click();

      await vi.waitFor(() => expect(row.dataset.wishlistState).toBe('out'));
      expect(header.dataset.wishlistState).toBe('out');
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

  describe('refreshWishlistButton', () => {
    it('should re-read the shared state, so a change elsewhere on the page shows up here', () => {
      const button = buildButton()!;
      expect(button.dataset.wishlistState).toBe('out');

      vi.mocked(isWishlisted).mockReturnValue(true);
      refreshWishlistButton(button);

      expect(button.dataset.wishlistState).toBe('in');
    });

    it('should leave a button alone while it is mid-request', () => {
      vi.mocked(toggleWishlist).mockReturnValue(new Promise(() => {}));
      const button = buildButton()!;
      button.click();

      vi.mocked(isWishlisted).mockReturnValue(true);
      refreshWishlistButton(button);

      expect(button.dataset.wishlistState).toBe('loading');
    });
  });
});
