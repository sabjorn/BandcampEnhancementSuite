import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { getCollectionSummary, collectItem, uncollectItem } from '../src/bclient';
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
  collectItem: vi.fn(),
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
    vi.mocked(collectItem).mockResolvedValue(true);
    (globalThis as any).chrome = {
      runtime: { onMessage: { addListener: vi.fn() } },
      tabs: { TAB_ID_NONE: -1 },
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

  describe('writing a wishlist change', () => {
    const item = { fan_id: 896389, item_type: 't' as const, item_id: 123456 };

    const ask = (sendResponse: any, action = 'collect') =>
      processRequest(
        {
          contentScriptQuery: 'writeWishlistItem',
          action,
          item,
          host: 'https://halfpastvibe.bandcamp.com',
          crumb: 'page_crumb'
        },
        {} as any,
        sendResponse
      );

    // collect_item_cb resolves the band from the host it is posted to.
    it('should collect against the host it was given', async () => {
      const sendResponse = vi.fn();

      ask(sendResponse);

      await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true }));
      expect(collectItem).toHaveBeenCalledWith(item, 'page_crumb', 'https://halfpastvibe.bandcamp.com');
    });

    // uncollect_item_cb refuses a band subdomain: "request must use the base domain".
    it('should uncollect against the base domain', async () => {
      const sendResponse = vi.fn();

      ask(sendResponse, 'uncollect');

      await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true }));
      expect(uncollectItem).toHaveBeenCalledWith(item, 'page_crumb', 'https://bandcamp.com');
    });

    it('should keep the listener alive for the async reply', () => {
      expect(ask(vi.fn())).toBe(true);
    });

    it('should pass the refusal reason back so the star can report it', async () => {
      vi.mocked(collectItem).mockRejectedValue(new Error('old or no crumb specified'));
      const sendResponse = vi.fn();

      ask(sendResponse);

      await vi.waitFor(() =>
        expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'old or no crumb specified' })
      );
    });
  });

  // Chrome sends the extension's own origin, which Bandcamp cannot resolve to a band, and drops
  // the referrer the fetch asks for. Neither is fixable in extension code.
  describe('presenting as a bandcamp host', () => {
    const write = (action: string) =>
      processRequest(
        {
          contentScriptQuery: 'writeWishlistItem',
          action,
          item: { fan_id: 1, item_type: 't' as const, item_id: 2 },
          host: 'https://band.bandcamp.com',
          crumb: 'page_crumb'
        },
        {} as any,
        vi.fn()
      );

    const ruleFor = (host: string) => ({
      removeRuleIds: [WISHLIST_HEADER_RULE_ID],
      addRules: [
        {
          id: WISHLIST_HEADER_RULE_ID,
          priority: 1,
          action: {
            type: 'modifyHeaders',
            requestHeaders: [
              { header: 'origin', operation: 'remove' },
              { header: 'referer', operation: 'set', value: `${host}/` }
            ]
          },
          condition: {
            requestDomains: ['bandcamp.com'],
            urlFilter: 'collect_item_cb',
            resourceTypes: ['xmlhttprequest', 'other'],
            tabIds: [-1]
          }
        }
      ]
    });

    it('should name the band host when collecting', async () => {
      write('collect');

      await vi.waitFor(() =>
        expect(chrome.declarativeNetRequest.updateSessionRules).toHaveBeenCalledWith(
          ruleFor('https://band.bandcamp.com')
        )
      );
    });

    it('should name the base domain when uncollecting', async () => {
      write('uncollect');

      await vi.waitFor(() =>
        expect(chrome.declarativeNetRequest.updateSessionRules).toHaveBeenCalledWith(ruleFor('https://bandcamp.com'))
      );
    });

    it('should report the failure when the rule cannot be installed', async () => {
      vi.mocked(chrome.declarativeNetRequest.updateSessionRules).mockRejectedValue(new Error('not allowed'));
      const sendResponse = vi.fn();

      processRequest(
        {
          contentScriptQuery: 'writeWishlistItem',
          action: 'uncollect',
          item: { fan_id: 1, item_type: 't' as const, item_id: 2 },
          host: 'https://band.bandcamp.com',
          crumb: 'page_crumb'
        },
        {} as any,
        sendResponse
      );

      await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'not allowed' }));
      expect(uncollectItem).not.toHaveBeenCalled();
    });

    // Session rules outlive the service worker, so one left installed would keep rewriting headers
    // for the rest of the browser session with none of our code running.
    it('should remove the rule once the write settles', async () => {
      const sendResponse = vi.fn();

      write('uncollect');

      await vi.waitFor(() =>
        expect(chrome.declarativeNetRequest.updateSessionRules).toHaveBeenLastCalledWith({
          removeRuleIds: [WISHLIST_HEADER_RULE_ID]
        })
      );
      expect(sendResponse).not.toHaveBeenCalled();
    });

    it('should remove the rule even when the write fails', async () => {
      vi.mocked(uncollectItem).mockRejectedValue(new Error('nope'));

      write('uncollect');

      await vi.waitFor(() =>
        expect(chrome.declarativeNetRequest.updateSessionRules).toHaveBeenLastCalledWith({
          removeRuleIds: [WISHLIST_HEADER_RULE_ID]
        })
      );
    });

    // Bandcamp's own wishlist buttons must not have their headers rewritten.
    it('should only match requests that belong to no tab', async () => {
      write('uncollect');

      await vi.waitFor(() => expect(chrome.declarativeNetRequest.updateSessionRules).toHaveBeenCalled());

      const [{ addRules }] = vi.mocked(chrome.declarativeNetRequest.updateSessionRules).mock.calls[0] as any;
      expect(addRules[0].condition.tabIds).toEqual([-1]);
    });

    // One shared rule carries the host for the request about to go out, so two writes in flight
    // would otherwise send one request under the other's header.
    it('should not let a second write change the headers under the first', async () => {
      const order: string[] = [];
      let releaseCollect: (value: boolean) => void = () => {};

      vi.mocked(chrome.declarativeNetRequest.updateSessionRules).mockImplementation(async (options: any) => {
        order.push(options.addRules ? `rule:${options.addRules[0].action.requestHeaders[1].value}` : 'rule:off');
      });
      vi.mocked(collectItem).mockImplementation(async () => {
        order.push('collect');
        return new Promise<boolean>(resolve => (releaseCollect = resolve));
      });
      vi.mocked(uncollectItem).mockImplementation(async () => {
        order.push('uncollect');
        return true;
      });

      write('collect');
      write('uncollect');

      await vi.waitFor(() => expect(order).toContain('collect'));
      expect(order).not.toContain('uncollect');

      releaseCollect(true);

      await vi.waitFor(() => expect(order).toContain('uncollect'));
      expect(order).toEqual([
        'rule:https://band.bandcamp.com/',
        'collect',
        'rule:off',
        'rule:https://bandcamp.com/',
        'uncollect',
        'rule:off'
      ]);
    });
  });
});
