import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { getCollectionSummary, uncollectItem } from '../src/bclient';
import { processRequest, initWishlistBackend, WISHLIST_HEADER_RULE_ID } from '../src/background/wishlist_backend';

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
  uncollectItem: vi.fn()
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
    vi.mocked(uncollectItem).mockResolvedValue(true);
    (globalThis as any).chrome = {
      runtime: { onMessage: { addListener: vi.fn() } },
      declarativeNetRequest: { updateSessionRules: vi.fn().mockResolvedValue(undefined) }
    };
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

  describe('removing a wishlist item', () => {
    const item = { fan_id: 896389, item_type: 't' as const, item_id: 123456, band_id: 857243381 };

    const ask = (sendResponse: any) =>
      processRequest(
        { contentScriptQuery: 'uncollectWishlistItem', item, crumb: 'page_crumb' },
        {} as any,
        sendResponse
      );

    // uncollect_item_cb refuses a band subdomain outright: "request must use the base domain", and
    // a page cannot reach bandcamp.com because x-requested-with forces a preflight it rejects.
    it('should post to the base domain', async () => {
      const sendResponse = vi.fn();

      ask(sendResponse);

      await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true }));
      expect(uncollectItem).toHaveBeenCalledWith(item, 'page_crumb', 'https://bandcamp.com');
    });

    it('should keep the listener alive for the async reply', () => {
      expect(ask(vi.fn())).toBe(true);
    });

    it('should pass the refusal reason back so the star can report it', async () => {
      vi.mocked(uncollectItem).mockRejectedValue(new Error('old or no crumb specified'));
      const sendResponse = vi.fn();

      ask(sendResponse);

      await vi.waitFor(() =>
        expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'old or no crumb specified' })
      );
    });
  });

  // Chrome sends the extension's own origin, which Bandcamp cannot resolve to a band, and drops
  // the referrer the fetch asks for. Neither is fixable in extension code.
  describe('presenting as the base domain', () => {
    it('should strip the extension origin and name a bandcamp referrer', async () => {
      await initWishlistBackend();

      expect(chrome.declarativeNetRequest.updateSessionRules).toHaveBeenCalledWith({
        removeRuleIds: [WISHLIST_HEADER_RULE_ID],
        addRules: [
          {
            id: WISHLIST_HEADER_RULE_ID,
            priority: 1,
            action: {
              type: 'modifyHeaders',
              requestHeaders: [
                { header: 'origin', operation: 'remove' },
                { header: 'referer', operation: 'set', value: 'https://bandcamp.com/' }
              ]
            },
            condition: {
              requestDomains: ['bandcamp.com'],
              urlFilter: 'uncollect_item_cb',
              resourceTypes: ['xmlhttprequest', 'other']
            }
          }
        ]
      });
    });

    it('should still start when the rule cannot be installed', async () => {
      vi.mocked(chrome.declarativeNetRequest.updateSessionRules).mockRejectedValue(new Error('not allowed'));

      await expect(initWishlistBackend()).resolves.toBeUndefined();
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });
  });
});
