import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { isBandcampLoggedIn } from '../src/utilities';
import {
  initCollectionState,
  isCollectionAvailable,
  isWishlisted,
  isOwned,
  toggleWishlist,
  resetCollectionState
} from '../src/collection';

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

// The summary is fetched by the service worker, because the band subdomains omit the lookup.
const sendMessage = vi.fn();

const summary = (tralbum_lookup: Record<string, any>, fan_id: number | null = 896389) => ({
  fan_id,
  username: 'someone',
  url: 'https://bandcamp.com/someone',
  tralbum_lookup,
  follows: { following: {} }
});

const HOST = 'https://band.bandcamp.com';

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

describe('collection state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCollectionState();
    document.body.innerHTML = '';
    vi.mocked(isBandcampLoggedIn).mockReturnValue(true);
    (globalThis as any).chrome = { runtime: { sendMessage } };
    sendMessage.mockResolvedValue(summary({ t123456: wishlistedTrack }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initCollectionState', () => {
    it('should fetch the collection summary only once however often it is called', async () => {
      await Promise.all([initCollectionState(), initCollectionState()]);
      await initCollectionState();

      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledWith({ contentScriptQuery: 'fetchCollectionSummary' });
    });

    it('should not re-request after a failed load, so opening the player again is free', async () => {
      sendMessage.mockRejectedValue(new Error('503'));

      await initCollectionState();
      await initCollectionState();
      await initCollectionState();

      expect(sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should report availability when a fan_id comes back', async () => {
      await expect(initCollectionState()).resolves.toBe(true);
      expect(isCollectionAvailable()).toBe(true);
    });

    it('should be unavailable when the request fails', async () => {
      sendMessage.mockRejectedValue(new Error('403'));

      await expect(initCollectionState()).resolves.toBe(false);
      expect(isCollectionAvailable()).toBe(false);
    });

    it('should be unavailable when the service worker has nothing to give', async () => {
      sendMessage.mockResolvedValue(null);

      await expect(initCollectionState()).resolves.toBe(false);
      expect(isCollectionAvailable()).toBe(false);
    });

    it('should be unavailable when the summary arrives without a lookup, rather than showing every star empty', async () => {
      sendMessage.mockResolvedValue({ ...summary({}), tralbum_lookup: undefined });

      await expect(initCollectionState()).resolves.toBe(false);
      expect(isCollectionAvailable()).toBe(false);
    });

    it('should be unavailable when there is no fan_id', async () => {
      sendMessage.mockResolvedValue(summary({}, null));

      await expect(initCollectionState()).resolves.toBe(false);
      expect(isCollectionAvailable()).toBe(false);
    });

    it('should be unavailable before it has been initialised', () => {
      expect(isCollectionAvailable()).toBe(false);
    });

    it('should not ask Bandcamp anything when nobody is logged in', async () => {
      vi.mocked(isBandcampLoggedIn).mockReturnValue(false);

      await expect(initCollectionState()).resolves.toBe(false);

      expect(sendMessage).not.toHaveBeenCalled();
      expect(isCollectionAvailable()).toBe(false);
    });
  });

  describe('isWishlisted', () => {
    it('should be true for a lookup entry with no purchase date', async () => {
      await initCollectionState();

      expect(isWishlisted('t', 123456)).toBe(true);
    });

    it('should be false for an owned item, which is in the collection rather than the wishlist', async () => {
      sendMessage.mockResolvedValue(summary({ a1609998585: ownedAlbum }));
      await initCollectionState();

      expect(isWishlisted('a', 1609998585)).toBe(false);
    });

    it('should be false for an item that is in neither', async () => {
      await initCollectionState();

      expect(isWishlisted('t', 999)).toBe(false);
    });

    it('should not confuse a track and an album sharing an id', async () => {
      sendMessage.mockResolvedValue(summary({ t42: wishlistedTrack }));
      await initCollectionState();

      expect(isWishlisted('t', 42)).toBe(true);
      expect(isWishlisted('a', 42)).toBe(false);
    });

    it('should be false before it has been initialised', () => {
      expect(isWishlisted('t', 123456)).toBe(false);
    });
  });

  describe('isOwned', () => {
    it('should be true for a lookup entry with a purchase date', async () => {
      sendMessage.mockResolvedValue(summary({ a1609998585: ownedAlbum }));
      await initCollectionState();

      expect(isOwned('a', 1609998585)).toBe(true);
    });

    it('should be false for a wishlisted item, which is not owned', async () => {
      await initCollectionState();

      expect(isOwned('t', 123456)).toBe(false);
    });

    it('should be false for an item in neither', async () => {
      await initCollectionState();

      expect(isOwned('t', 999)).toBe(false);
    });

    it('should not confuse a track and an album sharing an id', async () => {
      sendMessage.mockResolvedValue(summary({ a42: ownedAlbum }));
      await initCollectionState();

      expect(isOwned('a', 42)).toBe(true);
      expect(isOwned('t', 42)).toBe(false);
    });

    it('should be false before it has been initialised', () => {
      expect(isOwned('a', 1609998585)).toBe(false);
    });

    it('should be forgotten on reset', async () => {
      sendMessage.mockResolvedValue(summary({ a1609998585: ownedAlbum }));
      await initCollectionState();

      resetCollectionState();

      expect(isOwned('a', 1609998585)).toBe(false);
    });
  });

  describe('toggleWishlist', () => {
    beforeEach(() => {
      setCrumbs({ collect_item_cb: 'add_crumb', uncollect_item_cb: 'remove_crumb' });
      sendMessage.mockImplementation(async (message: any) =>
        message.contentScriptQuery === 'writeWishlistItem' ? { ok: true } : summary({ t123456: wishlistedTrack })
      );
    });

    it('should collect an item that is not yet wishlisted', async () => {
      await initCollectionState();

      await expect(toggleWishlist('t', 999, HOST)).resolves.toBe(true);

      expect(sendMessage).toHaveBeenCalledWith({
        contentScriptQuery: 'writeWishlistItem',
        action: 'collect',
        item: { fan_id: 896389, item_type: 't', item_id: 999, ref_token: null },
        host: HOST,
        crumb: 'add_crumb'
      });
    });

    it('should uncollect an item that is already wishlisted', async () => {
      await initCollectionState();

      await expect(toggleWishlist('t', 123456, HOST)).resolves.toBe(false);

      expect(sendMessage).toHaveBeenCalledWith({
        contentScriptQuery: 'writeWishlistItem',
        action: 'uncollect',
        item: { fan_id: 896389, item_type: 't', item_id: 123456, ref_token: null },
        host: HOST,
        crumb: 'remove_crumb'
      });
    });

    it('should pass along the page referrer token when there is one', async () => {
      setReferrerToken('ref-abc');
      await initCollectionState();

      await toggleWishlist('t', 999, HOST);

      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ item: expect.objectContaining({ ref_token: 'ref-abc' }) })
      );
    });

    it('should fall back to the other crumb when the page lacks the one for this path', async () => {
      document.body.innerHTML = '';
      setCrumbs({ collect_item_cb: 'add_crumb' });
      await initCollectionState();

      await toggleWishlist('t', 123456, HOST);

      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ action: 'uncollect', crumb: 'add_crumb' }));
    });

    it('should send a null crumb when the page carries none', async () => {
      document.body.innerHTML = '';
      await initCollectionState();

      await toggleWishlist('t', 999, HOST);

      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ crumb: null }));
    });

    it('should only record the new state once Bandcamp has confirmed it', async () => {
      await initCollectionState();

      await toggleWishlist('t', 999, HOST);
      expect(isWishlisted('t', 999)).toBe(true);

      await toggleWishlist('t', 999, HOST);
      expect(isWishlisted('t', 999)).toBe(false);
    });

    it('should pass on the reason and leave the state untouched when Bandcamp rejects the change', async () => {
      await initCollectionState();
      sendMessage.mockImplementation(async (message: any) =>
        message.contentScriptQuery === 'writeWishlistItem'
          ? { ok: false, error: 'old or no crumb specified' }
          : summary({ t123456: wishlistedTrack })
      );

      await expect(toggleWishlist('t', 999, HOST)).rejects.toThrow('old or no crumb specified');
      expect(isWishlisted('t', 999)).toBe(false);
    });

    it('should leave the state untouched when the request itself fails', async () => {
      await initCollectionState();
      sendMessage.mockImplementation(async (message: any) =>
        message.contentScriptQuery === 'writeWishlistItem'
          ? { ok: false, error: 'network down' }
          : summary({ t123456: wishlistedTrack })
      );

      await expect(toggleWishlist('t', 123456, HOST)).rejects.toThrow('network down');
      expect(isWishlisted('t', 123456)).toBe(true);
    });

    it('should throw when the wishlist is unavailable', async () => {
      sendMessage.mockRejectedValue(new Error('403'));
      await initCollectionState();

      await expect(toggleWishlist('t', 999, HOST)).rejects.toThrow('Wishlist is unavailable');
    });

    // A grid star and the drawer's star can both exist for one album, and each only guards its own
    // click, so the direction has to be settled per item rather than per button.
    it('should not send a second write for an item already in flight', async () => {
      await initCollectionState();

      const settlers: Array<(value: unknown) => void> = [];
      sendMessage.mockImplementation(async (message: any) =>
        message.contentScriptQuery === 'writeWishlistItem'
          ? new Promise(resolve => settlers.push(resolve))
          : summary({ t123456: wishlistedTrack })
      );

      const first = toggleWishlist('t', 999, HOST);
      const second = toggleWishlist('t', 999, HOST);

      await expect(second).rejects.toThrow('already changing');
      expect(settlers).toHaveLength(1);

      settlers[0]({ ok: true });
      await expect(first).resolves.toBe(true);
    });

    it('should allow a further change once the first has settled', async () => {
      await initCollectionState();

      await toggleWishlist('t', 999, HOST);
      await expect(toggleWishlist('t', 999, HOST)).resolves.toBe(false);
    });

    it('should not block a different item', async () => {
      await initCollectionState();

      const settlers: Array<(value: unknown) => void> = [];
      sendMessage.mockImplementation(async (message: any) =>
        message.contentScriptQuery === 'writeWishlistItem'
          ? new Promise(resolve => settlers.push(resolve))
          : summary({ t123456: wishlistedTrack })
      );

      const first = toggleWishlist('t', 999, HOST);
      const other = toggleWishlist('t', 888, HOST);

      await vi.waitFor(() => expect(settlers).toHaveLength(2));
      settlers.forEach(settle => settle({ ok: true }));

      await expect(first).resolves.toBe(true);
      await expect(other).resolves.toBe(true);
    });

    it('should release the item after a failure', async () => {
      await initCollectionState();
      sendMessage.mockImplementation(async (message: any) =>
        message.contentScriptQuery === 'writeWishlistItem'
          ? { ok: false, error: 'nope' }
          : summary({ t123456: wishlistedTrack })
      );

      await expect(toggleWishlist('t', 999, HOST)).rejects.toThrow('nope');
      await expect(toggleWishlist('t', 999, HOST)).rejects.toThrow('nope');
    });
  });
});
