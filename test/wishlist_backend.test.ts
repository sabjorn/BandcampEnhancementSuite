import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { getCollectionSummary, getCrumbsFromPage } from '../src/bclient';
import { processRequest, initWishlistBackend, resetCrumbCache } from '../src/background/wishlist_backend';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  }
}));

vi.mock('../src/bclient', () => ({
  getCollectionSummary: vi.fn(),
  getCrumbsFromPage: vi.fn()
}));

const summary = {
  fan_id: 896389,
  username: 'sabjorn',
  url: 'https://bandcamp.com/sabjorn',
  tralbum_lookup: {
    t682169137: { item_type: 'track', item_id: 682169137, band_id: 1, purchased: '05 Apr 2026 02:26:42 GMT' },
    t123456: { item_type: 'track', item_id: 123456, band_id: 1, purchased: null }
  },
  follows: { following: {} }
};

describe('wishlist backend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCollectionSummary).mockResolvedValue(summary as any);
    vi.mocked(getCrumbsFromPage).mockResolvedValue({ collect_item_cb: '|collect_item_cb|1|abc=' });
    resetCrumbCache();
    (globalThis as any).chrome = { runtime: { onMessage: { addListener: vi.fn() } } };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should register a message listener', async () => {
    await initWishlistBackend();

    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(processRequest);
  });

  it('should ignore messages for other backends', () => {
    const sendResponse = vi.fn();

    expect(processRequest({ contentScriptQuery: 'somethingElse' }, {} as any, sendResponse)).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  // The band subdomains answer collection_summary without a tralbum_lookup, so this has to be
  // fetched against bandcamp.com — which only the service worker can reach cross-origin.
  it('should fetch the collection summary against bandcamp.com', async () => {
    const sendResponse = vi.fn();

    processRequest({ contentScriptQuery: 'fetchCollectionSummary' }, {} as any, sendResponse);

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
    expect(getCollectionSummary).toHaveBeenCalledWith('https://bandcamp.com');
  });

  it('should keep the listener alive for the async reply', () => {
    expect(processRequest({ contentScriptQuery: 'fetchCollectionSummary' }, {} as any, vi.fn())).toBe(true);
  });

  it('should pass the summary back to the content script', async () => {
    const sendResponse = vi.fn();

    processRequest({ contentScriptQuery: 'fetchCollectionSummary' }, {} as any, sendResponse);

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(summary));
  });

  it('should answer with null when the request fails rather than hanging the caller', async () => {
    vi.mocked(getCollectionSummary).mockRejectedValue(new Error('must be logged in'));
    const sendResponse = vi.fn();

    processRequest({ contentScriptQuery: 'fetchCollectionSummary' }, {} as any, sendResponse);

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(null));
  });

  describe('serving a wishlist crumb', () => {
    const ask = (sendResponse: any, itemUrl = 'https://label.bandcamp.com/track/one') =>
      processRequest(
        { contentScriptQuery: 'fetchWishlistCrumb', itemUrl, path: 'collect_item_cb' },
        {} as any,
        sendResponse
      );

    it('should read the crumb off the item page', async () => {
      const sendResponse = vi.fn();

      ask(sendResponse);

      await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith('|collect_item_cb|1|abc='));
      expect(getCrumbsFromPage).toHaveBeenCalledWith('https://label.bandcamp.com/track/one');
    });

    it('should keep the listener alive for the async reply', () => {
      expect(ask(vi.fn())).toBe(true);
    });

    it('should fetch the page only once per session, however many stars are clicked', async () => {
      const first = vi.fn();
      const second = vi.fn();

      ask(first);
      await vi.waitFor(() => expect(first).toHaveBeenCalled());
      ask(second, 'https://label.bandcamp.com/track/two');
      await vi.waitFor(() => expect(second).toHaveBeenCalled());

      expect(getCrumbsFromPage).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledWith('|collect_item_cb|1|abc=');
    });

    it('should answer null when the page has no crumb for that path', async () => {
      vi.mocked(getCrumbsFromPage).mockResolvedValue({ something_else: 'x' });
      const sendResponse = vi.fn();

      ask(sendResponse);

      await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(null));
    });

    it('should answer null rather than hanging when the page cannot be read', async () => {
      vi.mocked(getCrumbsFromPage).mockRejectedValue(new Error('404'));
      const sendResponse = vi.fn();

      ask(sendResponse);

      await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(null));
    });

    it('should not cache a failure, so a later click can try again', async () => {
      vi.mocked(getCrumbsFromPage).mockRejectedValueOnce(new Error('404'));
      const first = vi.fn();
      const second = vi.fn();

      ask(first);
      await vi.waitFor(() => expect(first).toHaveBeenCalledWith(null));
      ask(second);

      await vi.waitFor(() => expect(second).toHaveBeenCalledWith('|collect_item_cb|1|abc='));
    });
  });
});
