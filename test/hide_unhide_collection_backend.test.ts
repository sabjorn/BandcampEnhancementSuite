import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { connectionListenerCallback, portListenerCallback } from '../src/background/hide_unhide_collection_backend';

vi.mock('../src/bclient', () => ({
  getCollectionSummary: vi.fn(),
  getHiddenItemsRateLimited: vi.fn(),
  hideUnhideRateLimited: vi.fn()
}));

vi.mock('../src/logger', () => ({
  default: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }))
}));

import { getCollectionSummary, getHiddenItemsRateLimited, hideUnhideRateLimited } from '../src/bclient';

describe('unhide_backend', () => {
  let mockPort: any;
  let portState: { port?: chrome.runtime.Port };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPort = {
      name: 'bes',
      postMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn()
      }
    };

    portState = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('connectionListenerCallback', () => {
    it('should handle valid port connection', () => {
      connectionListenerCallback(mockPort, portState);

      expect(portState.port).toBe(mockPort);
      expect(mockPort.onMessage.addListener).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should reject invalid port name', () => {
      const invalidPort = { ...mockPort, name: 'invalidport' };

      connectionListenerCallback(invalidPort, portState);

      expect(portState.port).toBeUndefined();
      expect(invalidPort.onMessage.addListener).not.toHaveBeenCalled();
    });
  });

  describe('portListenerCallback', () => {
    beforeEach(() => {
      portState.port = mockPort;
      connectionListenerCallback(mockPort, portState);
    });

    it('should handle unhide message', async () => {
      const mockCollectionSummary = {
        fan_id: 123456,
        username: 'testuser',
        url: 'https://bandcamp.com/testuser',
        tralbum_lookup: {},
        follows: { following: {} }
      };

      const mockHiddenItemsResponse = {
        items: [
          {
            fan_id: 123456,
            item_id: 789,
            item_type: 'track',
            band_id: 1,
            added: '2025-01-01',
            updated: '2025-01-01',
            purchased: '2025-01-01',
            sale_item_id: 1,
            sale_item_type: 'p',
            tralbum_id: 789,
            tralbum_type: 't',
            featured_track: 789,
            why: null,
            hidden: 1,
            index: null,
            also_collected_count: null,
            url_hints: {
              subdomain: 'test',
              custom_domain: null,
              custom_domain_verified: null,
              slug: 'test-track',
              item_type: 't'
            },
            item_title: 'Test Track',
            item_url: 'https://test.bandcamp.com/track/test-track',
            item_art_id: 1,
            item_art_url: 'https://test.com/art.jpg',
            item_art: {
              url: 'https://test.com/art.jpg',
              thumb_url: 'https://test.com/art_thumb.jpg',
              art_id: 1
            },
            band_name: 'Test Band',
            band_url: 'https://test.bandcamp.com',
            genre_id: 1,
            featured_track_title: 'Test Track',
            featured_track_number: null,
            featured_track_is_custom: false,
            featured_track_duration: 180,
            featured_track_url: null,
            featured_track_encodings_id: 1,
            package_details: null,
            num_streamable_tracks: 1,
            is_purchasable: true,
            is_private: false,
            is_preorder: false,
            is_giftable: true,
            is_subscriber_only: false,
            is_subscription_item: false,
            service_name: null,
            service_url_fragment: null,
            gift_sender_name: null,
            gift_sender_note: null,
            gift_id: null,
            gift_recipient_name: null,
            album_id: null,
            album_title: null,
            listen_in_app_url: 'https://test.com/app',
            band_location: null,
            band_image_id: null,
            release_count: null,
            message_count: null,
            is_set_price: false,
            price: 1.0,
            has_digital_download: null,
            merch_ids: null,
            merch_sold_out: null,
            currency: 'USD',
            label: null,
            label_id: null,
            require_email: null,
            item_art_ids: null
          }
        ],
        redownload_urls: {},
        item_lookup: {},
        last_token: '',
        similar_gift_ids: {},
        last_token_is_gift: false
      };

      vi.mocked(getCollectionSummary).mockResolvedValue(mockCollectionSummary);
      vi.mocked(getHiddenItemsRateLimited).mockResolvedValue(mockHiddenItemsResponse);
      vi.mocked(hideUnhideRateLimited).mockResolvedValue(true);

      const message = {
        unhide: {
          crumb: 'test-crumb'
        }
      };

      await portListenerCallback(message, portState);

      expect(getCollectionSummary).toHaveBeenCalledWith('https://bandcamp.com');
      expect(getHiddenItemsRateLimited).toHaveBeenCalledWith(
        123456,
        expect.stringMatching(/^\d+:999999999:t::$/),
        100,
        'https://bandcamp.com'
      );

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        unhideComplete: { message: 'Successfully unhidden 1 items' }
      });
    });

    it('should handle getUnhideState message', async () => {
      const message = { getUnhideState: true };

      await portListenerCallback(message, portState);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        unhideState: expect.objectContaining({
          isProcessing: expect.any(Boolean),
          processedCount: expect.any(Number),
          totalCount: expect.any(Number),
          errors: expect.any(Array),
          action: expect.any(String)
        })
      });
    });

    it('should handle empty token in pagination', async () => {
      const mockCollectionSummary = {
        fan_id: 123456,
        username: 'testuser',
        url: 'https://bandcamp.com/testuser',
        tralbum_lookup: {},
        follows: { following: {} }
      };

      const mockHiddenItemsResponse = {
        items: [],
        redownload_urls: {},
        item_lookup: {},
        last_token: '',
        similar_gift_ids: {},
        last_token_is_gift: false
      };

      vi.mocked(getCollectionSummary).mockResolvedValue(mockCollectionSummary);
      vi.mocked(getHiddenItemsRateLimited).mockResolvedValue(mockHiddenItemsResponse);

      const message = {
        unhide: {
          crumb: 'test-crumb'
        }
      };

      await portListenerCallback(message, portState);

      expect(getCollectionSummary).toHaveBeenCalledWith('https://bandcamp.com');
      expect(getHiddenItemsRateLimited).toHaveBeenCalledWith(
        123456,
        expect.stringMatching(/^\d+:999999999:t::$/),
        100,
        'https://bandcamp.com'
      );
      expect(mockPort.postMessage).toHaveBeenCalledWith({
        unhideComplete: { message: 'No hidden items found' }
      });
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(getCollectionSummary).mockRejectedValue(new Error('API Error'));

      const message = {
        unhide: {
          crumb: 'test-crumb'
        }
      };

      await portListenerCallback(message, portState);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        unhideError: { message: 'Failed to get collection summary: Error: API Error' }
      });
    });

    it('should handle hide message', async () => {
      const mockCollectionSummary = {
        fan_id: 123456,
        username: 'testuser',
        url: 'https://bandcamp.com/testuser',
        tralbum_lookup: {
          t789: {
            item_id: 789,
            item_type: 'track',
            band_id: 1,
            purchased: '2023-01-01'
          },
          a790: {
            item_id: 790,
            item_type: 'album',
            band_id: 2,
            purchased: '2023-01-01'
          }
        },
        follows: { following: {} }
      };

      const mockHiddenItemsResponse = {
        items: [
          {
            fan_id: 123456,
            item_id: 790,
            item_type: 'album',
            band_id: 2,
            added: '2025-01-02',
            updated: '2025-01-02',
            purchased: '2025-01-02',
            sale_item_id: 2,
            sale_item_type: 'p',
            tralbum_id: 790,
            tralbum_type: 'a',
            featured_track: 790,
            why: null,
            hidden: 1,
            index: null,
            also_collected_count: 50,
            url_hints: {
              subdomain: 'test2',
              custom_domain: null,
              custom_domain_verified: null,
              slug: 'test-album',
              item_type: 'a'
            },
            item_title: 'Test Album',
            item_url: 'https://test2.bandcamp.com/album/test-album',
            item_art_id: 2,
            item_art_url: 'https://test2.com/art.jpg',
            item_art: {
              url: 'https://test2.com/art.jpg',
              thumb_url: 'https://test2.com/art_thumb.jpg',
              art_id: 2
            },
            band_name: 'Test Band 2',
            band_url: 'https://test2.bandcamp.com',
            genre_id: 2,
            featured_track_title: 'Test Album',
            featured_track_number: 1,
            featured_track_is_custom: false,
            featured_track_duration: 200,
            featured_track_url: null,
            featured_track_encodings_id: 2,
            package_details: null,
            num_streamable_tracks: 5,
            is_purchasable: true,
            is_private: false,
            is_preorder: false,
            is_giftable: true,
            is_subscriber_only: false,
            is_subscription_item: false,
            service_name: null,
            service_url_fragment: null,
            gift_sender_name: null,
            gift_sender_note: null,
            gift_id: null,
            gift_recipient_name: null,
            album_id: 200,
            album_title: 'Test Album',
            listen_in_app_url: 'https://test2.com/app',
            band_location: null,
            band_image_id: null,
            release_count: null,
            message_count: null,
            is_set_price: false,
            price: 5.0,
            has_digital_download: true,
            merch_ids: [],
            merch_sold_out: false,
            currency: 'USD',
            label: null,
            label_id: null,
            require_email: null,
            item_art_ids: null,
            releases: null,
            discount: null,
            token: 'test-token-2',
            variant_id: null,
            merch_snapshot: null,
            featured_track_license_id: null,
            licensed_item: null,
            download_available: true
          }
        ],
        more_available: false,
        tracklists: {},
        redownload_urls: {},
        item_lookup: {},
        last_token: 'final-token',
        purchase_infos: {},
        collectors: {},
        similar_gift_ids: {},
        last_token_is_gift: false
      };

      vi.mocked(getCollectionSummary).mockResolvedValue(mockCollectionSummary);
      vi.mocked(getHiddenItemsRateLimited).mockResolvedValue(mockHiddenItemsResponse);
      vi.mocked(hideUnhideRateLimited).mockResolvedValue(true);

      const message = {
        hide: {
          crumb: 'test-crumb'
        }
      };

      await portListenerCallback(message, portState);

      expect(getCollectionSummary).toHaveBeenCalledWith('https://bandcamp.com');
      expect(getHiddenItemsRateLimited).toHaveBeenCalledWith(
        123456,
        expect.stringMatching(/^\d+:999999999:t::$/),
        100,
        'https://bandcamp.com'
      );

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(hideUnhideRateLimited).toHaveBeenCalledWith(
        'hide',
        123456,
        'track',
        789,
        'test-crumb',
        'https://bandcamp.com'
      );
      expect(hideUnhideRateLimited).not.toHaveBeenCalledWith(
        'hide',
        123456,
        'album',
        790,
        expect.anything(),
        expect.anything()
      );

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        hideComplete: { message: 'Successfully hidden 1 items' }
      });
    });

    it('should handle hide message with no visible items', async () => {
      const mockCollectionSummary = {
        fan_id: 123456,
        username: 'testuser',
        url: 'https://bandcamp.com/testuser',
        tralbum_lookup: {},
        follows: { following: {} }
      };

      const mockHiddenItemsResponse = {
        items: [],
        redownload_urls: {},
        item_lookup: {},
        last_token: '',
        similar_gift_ids: {},
        last_token_is_gift: false
      };

      vi.mocked(getCollectionSummary).mockResolvedValue(mockCollectionSummary);
      vi.mocked(getHiddenItemsRateLimited).mockResolvedValue(mockHiddenItemsResponse);

      const message = {
        hide: {
          crumb: 'test-crumb'
        }
      };

      await portListenerCallback(message, portState);

      expect(getCollectionSummary).toHaveBeenCalledWith('https://bandcamp.com');
      expect(getHiddenItemsRateLimited).toHaveBeenCalledWith(
        123456,
        expect.stringMatching(/^\d+:999999999:t::$/),
        100,
        'https://bandcamp.com'
      );
      expect(mockPort.postMessage).toHaveBeenCalledWith({
        hideComplete: { message: 'No visible items found' }
      });
    });

    it('should handle hide API errors gracefully', async () => {
      vi.mocked(getCollectionSummary).mockRejectedValue(new Error('Collection API Error'));

      const message = {
        hide: {
          crumb: 'test-crumb'
        }
      };

      await portListenerCallback(message, portState);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        hideError: { message: 'Failed to get collection summary: Error: Collection API Error' }
      });
    });

    it('should handle getUnhideState message for hide operation', async () => {
      const mockCollectionSummary = {
        fan_id: 123456,
        username: 'testuser',
        url: 'https://bandcamp.com/testuser',
        tralbum_lookup: {},
        follows: { following: {} }
      };

      const mockHiddenItemsResponse = {
        items: [
          {
            fan_id: 123456,
            item_id: 789,
            item_type: 'track',
            hidden: null,
            band_id: 1,
            added: '2025-01-01',
            updated: '2025-01-01',
            purchased: '2025-01-01',
            sale_item_id: 1,
            sale_item_type: 'p',
            tralbum_id: 789,
            tralbum_type: 't',
            featured_track: 789,
            why: null,
            index: null,
            also_collected_count: 100,
            url_hints: {
              subdomain: 'test',
              custom_domain: null,
              custom_domain_verified: null,
              slug: 'test-track',
              item_type: 't'
            },
            item_title: 'Test Track',
            item_url: 'https://test.bandcamp.com/track/test-track',
            item_art_id: 1,
            item_art_url: 'https://test.com/art.jpg',
            item_art: {
              url: 'https://test.com/art.jpg',
              thumb_url: 'https://test.com/art_thumb.jpg',
              art_id: 1
            },
            band_name: 'Test Band',
            band_url: 'https://test.bandcamp.com',
            genre_id: 1,
            featured_track_title: 'Test Track',
            featured_track_number: 1,
            featured_track_is_custom: false,
            featured_track_duration: 180,
            featured_track_url: null,
            featured_track_encodings_id: 1,
            package_details: null,
            num_streamable_tracks: 1,
            is_purchasable: true,
            is_private: false,
            is_preorder: false,
            is_giftable: true,
            is_subscriber_only: false,
            is_subscription_item: false,
            service_name: null,
            service_url_fragment: null,
            gift_sender_name: null,
            gift_sender_note: null,
            gift_id: null,
            gift_recipient_name: null,
            album_id: 100,
            album_title: 'Test Album',
            listen_in_app_url: 'https://test.com/app',
            band_location: null,
            band_image_id: null,
            release_count: null,
            message_count: null,
            is_set_price: false,
            price: 1.0,
            has_digital_download: true,
            merch_ids: [],
            merch_sold_out: false,
            currency: 'USD',
            label: null,
            label_id: null,
            require_email: null,
            item_art_ids: null,
            releases: null,
            discount: null,
            token: 'test-token',
            variant_id: null,
            merch_snapshot: null,
            featured_track_license_id: null,
            licensed_item: null,
            download_available: true
          }
        ],
        more_available: false,
        tracklists: {},
        redownload_urls: {},
        item_lookup: {},
        last_token: 'final-token',
        purchase_infos: {},
        collectors: {},
        similar_gift_ids: {},
        last_token_is_gift: false
      };

      vi.mocked(getCollectionSummary).mockResolvedValue(mockCollectionSummary);
      vi.mocked(getHiddenItemsRateLimited).mockResolvedValue(mockHiddenItemsResponse);
      vi.mocked(hideUnhideRateLimited).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(true), 100))
      );

      const hideMessage = {
        hide: {
          crumb: 'test-crumb'
        }
      };

      const hidePromise = portListenerCallback(hideMessage, portState);

      await new Promise(resolve => setTimeout(resolve, 10));

      const stateMessage = { getUnhideState: true };
      await portListenerCallback(stateMessage, portState);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        hideState: expect.objectContaining({
          isProcessing: expect.any(Boolean),
          processedCount: expect.any(Number),
          totalCount: expect.any(Number),
          errors: expect.any(Array),
          action: 'hide'
        })
      });

      await hidePromise;
    });

    it('should filter out already hidden items from hide operation', async () => {
      const mockCollectionSummary = {
        fan_id: 123456,
        username: 'testuser',
        url: 'https://bandcamp.com/testuser',
        tralbum_lookup: {},
        follows: { following: {} }
      };

      const mockHiddenItemsResponse = {
        items: [
          {
            fan_id: 123456,
            item_id: 789,
            item_type: 'track',
            hidden: 1,
            band_id: 1,
            added: '2025-01-01',
            updated: '2025-01-01',
            purchased: '2025-01-01',
            sale_item_id: 1,
            sale_item_type: 'p',
            tralbum_id: 789,
            tralbum_type: 't',
            featured_track: 789,
            why: null,
            index: null,
            also_collected_count: 100,
            url_hints: {
              subdomain: 'test',
              custom_domain: null,
              custom_domain_verified: null,
              slug: 'test-track',
              item_type: 't'
            },
            item_title: 'Test Track',
            item_url: 'https://test.bandcamp.com/track/test-track',
            item_art_id: 1,
            item_art_url: 'https://test.com/art.jpg',
            item_art: {
              url: 'https://test.com/art.jpg',
              thumb_url: 'https://test.com/art_thumb.jpg',
              art_id: 1
            },
            band_name: 'Test Band',
            band_url: 'https://test.bandcamp.com',
            genre_id: 1,
            featured_track_title: 'Test Track',
            featured_track_number: 1,
            featured_track_is_custom: false,
            featured_track_duration: 180,
            featured_track_url: null,
            featured_track_encodings_id: 1,
            package_details: null,
            num_streamable_tracks: 1,
            is_purchasable: true,
            is_private: false,
            is_preorder: false,
            is_giftable: true,
            is_subscriber_only: false,
            is_subscription_item: false,
            service_name: null,
            service_url_fragment: null,
            gift_sender_name: null,
            gift_sender_note: null,
            gift_id: null,
            gift_recipient_name: null,
            album_id: 100,
            album_title: 'Test Album',
            listen_in_app_url: 'https://test.com/app',
            band_location: null,
            band_image_id: null,
            release_count: null,
            message_count: null,
            is_set_price: false,
            price: 1.0,
            has_digital_download: true,
            merch_ids: [],
            merch_sold_out: false,
            currency: 'USD',
            label: null,
            label_id: null,
            require_email: null,
            item_art_ids: null,
            releases: null,
            discount: null,
            token: 'test-token',
            variant_id: null,
            merch_snapshot: null,
            featured_track_license_id: null,
            licensed_item: null,
            download_available: true
          }
        ],
        more_available: false,
        tracklists: {},
        redownload_urls: {},
        item_lookup: {},
        last_token: 'final-token',
        purchase_infos: {},
        collectors: {},
        similar_gift_ids: {},
        last_token_is_gift: false
      };

      vi.mocked(getCollectionSummary).mockResolvedValue(mockCollectionSummary);
      vi.mocked(getHiddenItemsRateLimited).mockResolvedValue(mockHiddenItemsResponse);

      const message = {
        hide: {
          crumb: 'test-crumb'
        }
      };

      await portListenerCallback(message, portState);

      expect(getCollectionSummary).toHaveBeenCalledWith('https://bandcamp.com');
      expect(getHiddenItemsRateLimited).toHaveBeenCalledWith(
        123456,
        expect.stringMatching(/^\d+:999999999:t::$/),
        100,
        'https://bandcamp.com'
      );

      expect(hideUnhideRateLimited).not.toHaveBeenCalled();

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        hideComplete: { message: 'No visible items found' }
      });
    });
  });
});
