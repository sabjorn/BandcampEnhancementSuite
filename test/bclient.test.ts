import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { addAlbumToCart, getTralbumDetails, getCollectionSummary, hideUnhide, getHiddenItems } from '../src/bclient';

describe('bclient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('addAlbumToCart', () => {
    let fetchSpy: any;

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{"success": true}', { status: 200 }));
    });

    it('should make POST request to cart endpoint with correct parameters', async () => {
      await addAlbumToCart('123', '10.00', 'a');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/cart/cb',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            accept: 'application/json, text/javascript, */*; q=0.01',
            'content-type': 'application/x-www-form-urlencoded',
            'x-requested-with': 'XMLHttpRequest'
          }),
          body: 'req=add&item_type=a&item_id=123&unit_price=10.00&quantity=1&sync_num=1',
          mode: 'cors'
        })
      );
    });

    it('should default item_type to "a"', async () => {
      await addAlbumToCart('789', '20.00');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/cart/cb',
        expect.objectContaining({
          body: 'req=add&item_type=a&item_id=789&unit_price=20.00&quantity=1&sync_num=1'
        })
      );
    });

    it('should return fetch response', async () => {
      const response = await addAlbumToCart('123', '10.00');
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
    });

    it('should use relative URL when baseUrl is null', async () => {
      await addAlbumToCart('123', '10.00', 'a', null);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/cart/cb',
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should use absolute URL when baseUrl is provided', async () => {
      await addAlbumToCart('123', '10.00', 'a', 'https://bandcamp.com');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://bandcamp.com/cart/cb',
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });

  describe('getTralbumDetails', () => {
    let fetchSpy: any;

    beforeEach(() => {
      fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response('{"id": 123, "title": "Test Album"}', { status: 200 }));
    });

    it('should make POST request to tralbum_details endpoint', async () => {
      await getTralbumDetails('456', 't');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/mobile/25/tralbum_details',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            accept: 'application/json',
            'content-type': 'application/json',
            'user-agent': 'Bandcamp/218977 CFNetwork/1399 Darwin/22.1.0'
          }),
          body: JSON.stringify({
            tralbum_type: 't',
            band_id: 12345,
            tralbum_id: '456'
          })
        })
      );
    });

    it('should default item_type to "a"', async () => {
      await getTralbumDetails('789');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/mobile/25/tralbum_details',
        expect.objectContaining({
          body: JSON.stringify({
            tralbum_type: 'a',
            band_id: 12345,
            tralbum_id: '789'
          })
        })
      );
    });

    it('should return fetch response', async () => {
      const response = await getTralbumDetails('123');
      expect(response).toEqual({ id: 123, title: 'Test Album' });
    });

    it('should handle numeric item_id', async () => {
      await getTralbumDetails(999, 'a');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/mobile/25/tralbum_details',
        expect.objectContaining({
          body: JSON.stringify({
            tralbum_type: 'a',
            band_id: 12345,
            tralbum_id: 999
          })
        })
      );
    });

    it('should use relative URL when baseUrl is null', async () => {
      await getTralbumDetails('123', 'a', null);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/mobile/25/tralbum_details',
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should use absolute URL when baseUrl is provided', async () => {
      await getTralbumDetails('123', 'a', 'https://bandcamp.com');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://bandcamp.com/api/mobile/25/tralbum_details',
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });

  describe('getCollectionSummary', () => {
    let fetchSpy: any;

    beforeEach(() => {
      const mockResponseData = {
        fan_id: 896389,
        collection_summary: {
          fan_id: 896389,
          username: 'dataist',
          url: 'https://bandcamp.com/dataist',
          tralbum_lookup: {
            t3872546743: {
              item_type: 't',
              item_id: 3872546743,
              band_id: 1212584164,
              purchased: '07 Aug 2025 03:50:49 GMT'
            }
          },
          follows: {
            following: {
              '1430990': true
            }
          }
        }
      };

      fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify(mockResponseData), { status: 200 }));
    });

    it('should make GET request to collection_summary endpoint', async () => {
      await getCollectionSummary();

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/fan/2/collection_summary',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            accept: 'application/json, text/javascript, */*; q=0.01',
            'content-type': 'application/x-www-form-urlencoded',
            'x-requested-with': 'XMLHttpRequest',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-dest': 'empty'
          }),
          referrer: 'https://halfpastvibe.bandcamp.com/album/vielen-dank',
          referrerPolicy: 'no-referrer-when-downgrade',
          mode: 'cors'
        })
      );
    });

    it('should return collection_summary object from response', async () => {
      const result = await getCollectionSummary();

      expect(result).toEqual({
        fan_id: 896389,
        username: 'dataist',
        url: 'https://bandcamp.com/dataist',
        tralbum_lookup: {
          t3872546743: {
            item_type: 't',
            item_id: 3872546743,
            band_id: 1212584164,
            purchased: '07 Aug 2025 03:50:49 GMT'
          }
        },
        follows: {
          following: {
            '1430990': true
          }
        }
      });
    });

    it('should use relative URL when baseUrl is null', async () => {
      await getCollectionSummary(null);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/fan/2/collection_summary',
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should use absolute URL when baseUrl is provided', async () => {
      await getCollectionSummary('https://bandcamp.com');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://bandcamp.com/api/fan/2/collection_summary',
        expect.objectContaining({
          method: 'GET'
        })
      );
    });
  });

  describe('hideUnhide', () => {
    let fetchSpy: any;

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch');
    });

    it('should make POST request to hide_unhide_item endpoint with correct parameters', async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

      await hideUnhide('hide', 896389, 'track', 123456, 'valid_crumb');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/collectionowner/1/hide_unhide_item',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            accept: 'application/json, text/javascript, */*; q=0.01',
            'content-type': 'application/json',
            'x-requested-with': 'XMLHttpRequest'
          }),
          body: JSON.stringify({
            fan_id: 896389,
            item_type: 'track',
            item_id: 123456,
            action: 'hide',
            crumb: 'valid_crumb',
            collection_index: null
          }),
          mode: 'cors'
        })
      );
    });

    it('should return true when API returns ok: true', async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

      const result = await hideUnhide('unhide', 896389, 'album', 789, 'valid_crumb');
      expect(result).toBe(true);
    });

    it('should return false when API returns ok: false', async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 200 }));

      const result = await hideUnhide('hide', 896389, 'track', 123, 'valid_crumb');
      expect(result).toBe(false);
    });

    it('should handle null crumb parameter', async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

      await hideUnhide('hide', 896389, 'track', 123456);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/collectionowner/1/hide_unhide_item',
        expect.objectContaining({
          body: JSON.stringify({
            fan_id: 896389,
            item_type: 'track',
            item_id: 123456,
            action: 'hide',
            crumb: null,
            collection_index: null
          })
        })
      );
    });

    it('should retry with new crumb when invalid_crumb error is returned', async () => {
      const invalidCrumbResponse = {
        error: 'invalid_crumb',
        crumb: '|api/collectionowner/1/hide_unhide_item|1755307667|z5GoHoaxgXuO2LNi30A625SNbmc='
      };
      const successResponse = { ok: true };

      fetchSpy
        .mockResolvedValueOnce(new Response(JSON.stringify(invalidCrumbResponse), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(successResponse), { status: 200 }));

      const result = await hideUnhide('hide', 896389, 'track', 123456, 'old_crumb');

      expect(fetchSpy).toHaveBeenCalledTimes(2);

      expect(fetchSpy).toHaveBeenNthCalledWith(
        1,
        '/api/collectionowner/1/hide_unhide_item',
        expect.objectContaining({
          body: JSON.stringify({
            fan_id: 896389,
            item_type: 'track',
            item_id: 123456,
            action: 'hide',
            crumb: 'old_crumb',
            collection_index: null
          })
        })
      );

      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        '/api/collectionowner/1/hide_unhide_item',
        expect.objectContaining({
          body: JSON.stringify({
            fan_id: 896389,
            item_type: 'track',
            item_id: 123456,
            action: 'hide',
            crumb: '|api/collectionowner/1/hide_unhide_item|1755307667|z5GoHoaxgXuO2LNi30A625SNbmc=',
            collection_index: null
          })
        })
      );

      expect(result).toBe(true);
    });

    it('should not retry if invalid_crumb error has no crumb field', async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({ error: 'invalid_crumb' }), { status: 200 }));

      const result = await hideUnhide('hide', 896389, 'track', 123456, 'old_crumb');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result).toBe(false);
    });

    it('should use relative URL when baseUrl is null', async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

      await hideUnhide('hide', 896389, 'track', 123456, 'crumb', null);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/collectionowner/1/hide_unhide_item',
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should use absolute URL when baseUrl is provided', async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

      await hideUnhide('hide', 896389, 'track', 123456, 'crumb', 'https://bandcamp.com');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://bandcamp.com/api/collectionowner/1/hide_unhide_item',
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });

  describe('getHiddenItems', () => {
    let fetchSpy: any;

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch');
    });

    it('should make POST request to hidden_items endpoint with correct parameters', async () => {
      const mockResponse = {
        items: [
          {
            fan_id: 896389,
            item_id: 2101898392,
            item_type: 'track',
            band_id: 1165490299,
            added: '05 Jul 2025 00:13:50 GMT',
            updated: '05 Jul 2025 00:13:50 GMT',
            purchased: '05 Jul 2025 00:13:50 GMT',
            sale_item_id: 339188228,
            sale_item_type: 'p',
            tralbum_id: 2101898392,
            tralbum_type: 't',
            featured_track: 2101898392,
            why: null,
            hidden: 1,
            index: null,
            also_collected_count: null,
            url_hints: {
              subdomain: 'alokamusic',
              custom_domain: null,
              custom_domain_verified: null,
              slug: 'stay-on-track',
              item_type: 't'
            },
            item_title: 'Stay On Track',
            item_url: 'https://alokamusic.bandcamp.com/track/stay-on-track',
            item_art_id: 2367515687,
            item_art_url: 'https://f4.bcbits.com/img/a2367515687_9.jpg',
            item_art: {
              url: 'https://f4.bcbits.com/img/a2367515687_9.jpg',
              thumb_url: 'https://f4.bcbits.com/img/a2367515687_3.jpg',
              art_id: 2367515687
            },
            band_name: 'Aloka',
            band_url: 'https://alokamusic.bandcamp.com',
            genre_id: 10,
            featured_track_title: 'Stay On Track',
            featured_track_number: null,
            featured_track_is_custom: false,
            featured_track_duration: 252.444,
            featured_track_url: null,
            featured_track_encodings_id: 3072076279,
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
            listen_in_app_url:
              'https://bandcamp.com/redirect_to_app?fallback_url=https%3A%2F%2Fbandcamp.com%2Fthis_is_an_appstore_url%3Fapp%3Dfan_app&url=x-bandcamp%3A%2F%2Fshow_tralbum%3Ftralbum_type%3Dt%26tralbum_id%3D2101898392%26play%3D1&sig=a4912779ddd86f79e15a00a0381a2111',
            band_location: null,
            band_image_id: null,
            release_count: null,
            message_count: null,
            is_set_price: false,
            price: 1.75,
            has_digital_download: null,
            merch_ids: null,
            merch_sold_out: null,
            currency: 'GBP',
            label: null,
            label_id: null,
            require_email: null,
            item_art_ids: null
          }
        ],
        redownload_urls: {
          p339188228:
            'https://bandcamp.com/download?from=collection&payment_id=3572391420&sig=35df16d6664da995094e73c27a885f8e&sitem_id=339188228'
        },
        item_lookup: {},
        last_token: '1751674430:2101898392:t::',
        similar_gift_ids: {},
        last_token_is_gift: false
      };

      fetchSpy.mockResolvedValue(new Response(JSON.stringify(mockResponse), { status: 200 }));

      await getHiddenItems(896389, '1751674431:3546888505:t::', 15);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/fancollection/1/hidden_items',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            accept: 'application/json, text/javascript, */*; q=0.01',
            'content-type': 'application/json',
            'x-requested-with': 'XMLHttpRequest'
          }),
          body: JSON.stringify({
            fan_id: 896389,
            older_than_token: '1751674431:3546888505:t::',
            dupe_gift_ids: [],
            count: 15
          }),
          mode: 'cors'
        })
      );
    });

    it('should use default count of 20 when not provided', async () => {
      const mockResponse = {
        items: [],
        redownload_urls: {},
        item_lookup: {},
        last_token: '1751674430:2101898392:t::',
        similar_gift_ids: {},
        last_token_is_gift: false
      };

      fetchSpy.mockResolvedValue(new Response(JSON.stringify(mockResponse), { status: 200 }));

      await getHiddenItems(896389, '1751674431:3546888505:t::');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/fancollection/1/hidden_items',
        expect.objectContaining({
          body: JSON.stringify({
            fan_id: 896389,
            older_than_token: '1751674431:3546888505:t::',
            dupe_gift_ids: [],
            count: 20
          })
        })
      );
    });

    it('should return parsed response data', async () => {
      const mockResponse = {
        items: [
          {
            fan_id: 896389,
            item_id: 2101898392,
            item_type: 'track',
            item_title: 'Stay On Track',
            band_name: 'Aloka'
          }
        ],
        redownload_urls: {},
        item_lookup: {},
        last_token: '1751674430:2101898392:t::',
        similar_gift_ids: {},
        last_token_is_gift: false
      };

      fetchSpy.mockResolvedValue(new Response(JSON.stringify(mockResponse), { status: 200 }));

      const result = await getHiddenItems(896389, '1751674431:3546888505:t::');

      expect(result).toEqual(mockResponse);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].item_title).toBe('Stay On Track');
      expect(result.last_token).toBe('1751674430:2101898392:t::');
      expect(result.last_token_is_gift).toBe(false);
    });

    it('should use relative URL when baseUrl is null', async () => {
      const mockResponse = {
        items: [],
        redownload_urls: {},
        item_lookup: {},
        last_token: 'token',
        similar_gift_ids: {},
        last_token_is_gift: false
      };

      fetchSpy.mockResolvedValue(new Response(JSON.stringify(mockResponse), { status: 200 }));

      await getHiddenItems(896389, 'token', 20, null);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/fancollection/1/hidden_items',
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should use absolute URL when baseUrl is provided', async () => {
      const mockResponse = {
        items: [],
        redownload_urls: {},
        item_lookup: {},
        last_token: 'token',
        similar_gift_ids: {},
        last_token_is_gift: false
      };

      fetchSpy.mockResolvedValue(new Response(JSON.stringify(mockResponse), { status: 200 }));

      await getHiddenItems(896389, 'token', 20, 'https://bandcamp.com');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://bandcamp.com/api/fancollection/1/hidden_items',
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });
});
