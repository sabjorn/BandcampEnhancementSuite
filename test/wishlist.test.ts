import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { collectItem, uncollectItem } from '../src/bclient';
import { isBandcampLoggedIn } from '../src/utilities';
import {
  initWishlistState,
  isWishlistAvailable,
  isWishlisted,
  toggleWishlist,
  resetWishlistState
} from '../src/wishlist';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  }
}));

vi.mock('../src/utilities', () => ({
  isBandcampLoggedIn: vi.fn(() => true)
}));

vi.mock('../src/bclient', () => ({
  collectItem: vi.fn(),
  uncollectItem: vi.fn()
}));

// The summary is fetched by the service worker, because the band subdomains omit the lookup.
const sendMessage = vi.fn();

const summary = (tralbum_lookup: Record<string, any>, fan_id: number | null = 896389) => ({
  fan_id,
  username: 'someone',
  url: 'https://bandcamp.com/someone',
  tralbum_lookup,
  follows: { following: {} }
});

const ITEM_URL = 'https://label.bandcamp.com/track/one';

const wishlistedTrack = { item_type: 'track', item_id: 123456, band_id: 857243381, purchased: null };
const ownedAlbum = {
  item_type: 'album',
  item_id: 1609998585,
  band_id: 857243381,
  purchased: '15 Mar 2024 19:03:22 GMT'
};

function setCrumbs(crumbs: Record<string, string>): void {
  const element = document.createElement('div');
  element.id = 'js-crumbs-data';
  element.dataset.crumbs = JSON.stringify(crumbs);
  document.body.appendChild(element);
}

function setReferrerToken(value: unknown): void {
  const script = document.createElement('script');
  script.dataset.referrerToken = JSON.stringify(value);
  document.body.appendChild(script);
}

describe('wishlist state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWishlistState();
    document.body.innerHTML = '';
    vi.mocked(isBandcampLoggedIn).mockReturnValue(true);
    (globalThis as any).chrome = { runtime: { sendMessage } };
    sendMessage.mockResolvedValue(summary({ t123456: wishlistedTrack }));
    vi.mocked(collectItem).mockResolvedValue(true);
    vi.mocked(uncollectItem).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initWishlistState', () => {
    it('should fetch the collection summary only once however often it is called', async () => {
      await Promise.all([initWishlistState(), initWishlistState()]);
      await initWishlistState();

      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledWith({ contentScriptQuery: 'fetchCollectionSummary' });
    });

    it('should not re-request after a failed load, so opening the player again is free', async () => {
      sendMessage.mockRejectedValue(new Error('503'));

      await initWishlistState();
      await initWishlistState();
      await initWishlistState();

      expect(sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should report availability when a fan_id comes back', async () => {
      await expect(initWishlistState()).resolves.toBe(true);
      expect(isWishlistAvailable()).toBe(true);
    });

    it('should be unavailable when the request fails', async () => {
      sendMessage.mockRejectedValue(new Error('403'));

      await expect(initWishlistState()).resolves.toBe(false);
      expect(isWishlistAvailable()).toBe(false);
    });

    it('should be unavailable when the service worker has nothing to give', async () => {
      sendMessage.mockResolvedValue(null);

      await expect(initWishlistState()).resolves.toBe(false);
      expect(isWishlistAvailable()).toBe(false);
    });

    it('should be unavailable when the summary arrives without a lookup, rather than showing every star empty', async () => {
      sendMessage.mockResolvedValue({ ...summary({}), tralbum_lookup: undefined });

      await expect(initWishlistState()).resolves.toBe(false);
      expect(isWishlistAvailable()).toBe(false);
    });

    it('should be unavailable when there is no fan_id', async () => {
      sendMessage.mockResolvedValue(summary({}, null));

      await expect(initWishlistState()).resolves.toBe(false);
      expect(isWishlistAvailable()).toBe(false);
    });

    it('should be unavailable before it has been initialised', () => {
      expect(isWishlistAvailable()).toBe(false);
    });

    it('should not ask Bandcamp anything when nobody is logged in', async () => {
      vi.mocked(isBandcampLoggedIn).mockReturnValue(false);

      await expect(initWishlistState()).resolves.toBe(false);

      expect(sendMessage).not.toHaveBeenCalled();
      expect(isWishlistAvailable()).toBe(false);
    });
  });

  describe('isWishlisted', () => {
    it('should be true for a lookup entry with no purchase date', async () => {
      await initWishlistState();

      expect(isWishlisted('t', 123456)).toBe(true);
    });

    it('should be false for an owned item, which is in the collection rather than the wishlist', async () => {
      sendMessage.mockResolvedValue(summary({ a1609998585: ownedAlbum }));
      await initWishlistState();

      expect(isWishlisted('a', 1609998585)).toBe(false);
    });

    it('should be false for an item that is in neither', async () => {
      await initWishlistState();

      expect(isWishlisted('t', 999)).toBe(false);
    });

    it('should not confuse a track and an album sharing an id', async () => {
      sendMessage.mockResolvedValue(summary({ t42: wishlistedTrack }));
      await initWishlistState();

      expect(isWishlisted('t', 42)).toBe(true);
      expect(isWishlisted('a', 42)).toBe(false);
    });

    it('should be false before it has been initialised', () => {
      expect(isWishlisted('t', 123456)).toBe(false);
    });
  });

  describe('toggleWishlist', () => {
    beforeEach(() => {
      setCrumbs({ collect_item_cb: 'add_crumb', uncollect_item_cb: 'remove_crumb' });
    });

    it('should collect an item that is not yet wishlisted', async () => {
      await initWishlistState();

      await expect(toggleWishlist('t', 999, 857243381, ITEM_URL)).resolves.toBe(true);

      expect(collectItem).toHaveBeenCalledWith(
        { fan_id: 896389, item_type: 't', item_id: 999, band_id: 857243381, ref_token: null },
        'add_crumb'
      );
      expect(uncollectItem).not.toHaveBeenCalled();
    });

    it('should uncollect an item that is already wishlisted', async () => {
      await initWishlistState();

      await expect(toggleWishlist('t', 123456, 857243381, ITEM_URL)).resolves.toBe(false);

      expect(uncollectItem).toHaveBeenCalledWith(
        { fan_id: 896389, item_type: 't', item_id: 123456, band_id: 857243381, ref_token: null },
        'remove_crumb'
      );
      expect(collectItem).not.toHaveBeenCalled();
    });

    it('should pass along the page referrer token when there is one', async () => {
      setReferrerToken('ref-abc');
      await initWishlistState();

      await toggleWishlist('t', 999, 857243381, ITEM_URL);

      expect(collectItem).toHaveBeenCalledWith(expect.objectContaining({ ref_token: 'ref-abc' }), 'add_crumb');
    });

    it('should fall back to a crumb from the service worker when the page carries none', async () => {
      document.body.innerHTML = '';
      sendMessage.mockImplementation(async (message: any) =>
        message.contentScriptQuery === 'fetchWishlistCrumb' ? 'fetched_crumb' : summary({ t123456: wishlistedTrack })
      );
      await initWishlistState();

      await toggleWishlist('t', 999, 857243381, ITEM_URL);

      expect(sendMessage).toHaveBeenCalledWith({
        contentScriptQuery: 'fetchWishlistCrumb',
        itemUrl: ITEM_URL,
        path: 'collect_item_cb'
      });
      expect(collectItem).toHaveBeenCalledWith(expect.anything(), 'fetched_crumb');
    });

    it('should not go to the service worker when the page already has the crumb', async () => {
      await initWishlistState();
      sendMessage.mockClear();

      await toggleWishlist('t', 999, 857243381, ITEM_URL);

      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('should send a null crumb when neither the page nor the service worker has one', async () => {
      document.body.innerHTML = '';
      sendMessage.mockImplementation(async (message: any) =>
        message.contentScriptQuery === 'fetchWishlistCrumb' ? null : summary({ t123456: wishlistedTrack })
      );
      await initWishlistState();

      await toggleWishlist('t', 999, 857243381, ITEM_URL);

      expect(collectItem).toHaveBeenCalledWith(expect.anything(), null);
    });

    it('should only record the new state once Bandcamp has confirmed it', async () => {
      await initWishlistState();

      await toggleWishlist('t', 999, 857243381, ITEM_URL);
      expect(isWishlisted('t', 999)).toBe(true);

      await toggleWishlist('t', 999, 857243381, ITEM_URL);
      expect(isWishlisted('t', 999)).toBe(false);
    });

    it('should pass on the reason and leave the state untouched when Bandcamp rejects the change', async () => {
      vi.mocked(collectItem).mockRejectedValue(new Error('old or no crumb specified'));
      await initWishlistState();

      await expect(toggleWishlist('t', 999, 857243381, ITEM_URL)).rejects.toThrow('old or no crumb specified');
      expect(isWishlisted('t', 999)).toBe(false);
    });

    it('should leave the state untouched when the request itself fails', async () => {
      vi.mocked(uncollectItem).mockRejectedValue(new Error('network down'));
      await initWishlistState();

      await expect(toggleWishlist('t', 123456, 857243381, ITEM_URL)).rejects.toThrow('network down');
      expect(isWishlisted('t', 123456)).toBe(true);
    });

    it('should throw when the wishlist is unavailable', async () => {
      sendMessage.mockRejectedValue(new Error('403'));
      await initWishlistState();

      await expect(toggleWishlist('t', 999, 857243381, ITEM_URL)).rejects.toThrow('Wishlist is unavailable');
      expect(collectItem).not.toHaveBeenCalled();
    });
  });
});
