import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { addAlbumToCart, getTralbumDetails, getCollectionSummary, hideUnhide } from '../src/bclient'

describe('bclient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('addAlbumToCart', () => {
    let fetchSpy: any

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('{"success": true}', { status: 200 })
      )
    })

    it('should make POST request to cart endpoint with correct parameters', async () => {
      await addAlbumToCart('123', '10.00', 'a')

      expect(fetchSpy).toHaveBeenCalledWith(
        '/cart/cb',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'accept': 'application/json, text/javascript, */*; q=0.01',
            'content-type': 'application/x-www-form-urlencoded',
            'x-requested-with': 'XMLHttpRequest'
          }),
          body: 'req=add&item_type=a&item_id=123&unit_price=10.00&quantity=1&sync_num=1',
          mode: 'cors'
        })
      )
    })


    it('should default item_type to "a"', async () => {
      await addAlbumToCart('789', '20.00')

      expect(fetchSpy).toHaveBeenCalledWith(
        '/cart/cb',
        expect.objectContaining({
          body: 'req=add&item_type=a&item_id=789&unit_price=20.00&quantity=1&sync_num=1'
        })
      )
    })

    it('should return fetch response', async () => {
      const response = await addAlbumToCart('123', '10.00')
      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(200)
    })
  })

  describe('getTralbumDetails', () => {
    let fetchSpy: any

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('{"id": 123, "title": "Test Album"}', { status: 200 })
      )
    })

    it('should make POST request to tralbum_details endpoint', async () => {
      await getTralbumDetails('456', 't')

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/mobile/25/tralbum_details',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'accept': 'application/json',
            'content-type': 'application/json',
            'user-agent': 'Bandcamp/218977 CFNetwork/1399 Darwin/22.1.0'
          }),
          body: JSON.stringify({
            tralbum_type: 't',
            band_id: 12345,
            tralbum_id: '456'
          })
        })
      )
    })

    it('should default item_type to "a"', async () => {
      await getTralbumDetails('789')

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/mobile/25/tralbum_details',
        expect.objectContaining({
          body: JSON.stringify({
            tralbum_type: 'a',
            band_id: 12345,
            tralbum_id: '789'
          })
        })
      )
    })

    it('should return fetch response', async () => {
      const response = await getTralbumDetails('123')
      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(200)
    })

    it('should handle numeric item_id', async () => {
      await getTralbumDetails(999, 'a')

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/mobile/25/tralbum_details',
        expect.objectContaining({
          body: JSON.stringify({
            tralbum_type: 'a',
            band_id: 12345,
            tralbum_id: 999
          })
        })
      )
    })
  })

  describe('getCollectionSummary', () => {
    let fetchSpy: any

    beforeEach(() => {
      const mockResponseData = {
        fan_id: 896389,
        collection_summary: {
          fan_id: 896389,
          username: "dataist",
          url: "https://bandcamp.com/dataist",
          tralbum_lookup: {
            "t3872546743": {
              item_type: "t",
              item_id: 3872546743,
              band_id: 1212584164,
              purchased: "07 Aug 2025 03:50:49 GMT"
            }
          },
          follows: {
            following: {
              "1430990": true
            }
          }
        }
      }
      
      fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockResponseData), { status: 200 })
      )
    })

    it('should make GET request to collection_summary endpoint', async () => {
      await getCollectionSummary()

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/fan/2/collection_summary',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'accept': 'application/json, text/javascript, */*; q=0.01',
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
      )
    })

    it('should return collection_summary object from response', async () => {
      const result = await getCollectionSummary()
      
      expect(result).toEqual({
        fan_id: 896389,
        username: "dataist",
        url: "https://bandcamp.com/dataist",
        tralbum_lookup: {
          "t3872546743": {
            item_type: "t",
            item_id: 3872546743,
            band_id: 1212584164,
            purchased: "07 Aug 2025 03:50:49 GMT"
          }
        },
        follows: {
          following: {
            "1430990": true
          }
        }
      })
    })

    it('should handle response data correctly', async () => {
      const result = await getCollectionSummary()
      expect(result.fan_id).toBe(896389)
      expect(result.username).toBe("dataist")
      expect(result.tralbum_lookup).toBeDefined()
      expect(result.follows).toBeDefined()
    })
  })

  describe('hideUnhide', () => {
    let fetchSpy: any

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch')
    })

    it('should make POST request to hide_unhide_item endpoint with correct parameters', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      )

      await hideUnhide('hide', '896389', 'track', 123456, 'valid_crumb')

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/collectionowner/1/hide_unhide_item',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'accept': 'application/json, text/javascript, */*; q=0.01',
            'content-type': 'application/json',
            'x-requested-with': 'XMLHttpRequest'
          }),
          body: JSON.stringify({
            fan_id: '896389',
            item_type: 'track',
            item_id: 123456,
            action: 'hide',
            crumb: 'valid_crumb',
            collection_index: null
          }),
          mode: 'cors'
        })
      )
    })

    it('should return true when API returns ok: true', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      )

      const result = await hideUnhide('unhide', '896389', 'album', 789, 'valid_crumb')
      expect(result).toBe(true)
    })

    it('should return false when API returns ok: false', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ ok: false }), { status: 200 })
      )

      const result = await hideUnhide('hide', '896389', 'track', 123, 'valid_crumb')
      expect(result).toBe(false)
    })

    it('should handle null crumb parameter', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      )

      await hideUnhide('hide', '896389', 'track', 123456)

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/collectionowner/1/hide_unhide_item',
        expect.objectContaining({
          body: JSON.stringify({
            fan_id: '896389',
            item_type: 'track',
            item_id: 123456,
            action: 'hide',
            crumb: null,
            collection_index: null
          })
        })
      )
    })

    it('should retry with new crumb when invalid_crumb error is returned', async () => {
      const invalidCrumbResponse = {
        error: 'invalid_crumb',
        crumb: '|api/collectionowner/1/hide_unhide_item|1755307667|z5GoHoaxgXuO2LNi30A625SNbmc='
      }
      const successResponse = { ok: true }

      fetchSpy
        .mockResolvedValueOnce(
          new Response(JSON.stringify(invalidCrumbResponse), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(successResponse), { status: 200 })
        )

      const result = await hideUnhide('hide', '896389', 'track', 123456, 'old_crumb')

      expect(fetchSpy).toHaveBeenCalledTimes(2)
      
      // First call with old crumb
      expect(fetchSpy).toHaveBeenNthCalledWith(1,
        '/api/collectionowner/1/hide_unhide_item',
        expect.objectContaining({
          body: JSON.stringify({
            fan_id: '896389',
            item_type: 'track',
            item_id: 123456,
            action: 'hide',
            crumb: 'old_crumb',
            collection_index: null
          })
        })
      )

      // Second call with new crumb
      expect(fetchSpy).toHaveBeenNthCalledWith(2,
        '/api/collectionowner/1/hide_unhide_item',
        expect.objectContaining({
          body: JSON.stringify({
            fan_id: '896389',
            item_type: 'track',
            item_id: 123456,
            action: 'hide',
            crumb: '|api/collectionowner/1/hide_unhide_item|1755307667|z5GoHoaxgXuO2LNi30A625SNbmc=',
            collection_index: null
          })
        })
      )

      expect(result).toBe(true)
    })

    it('should not retry if invalid_crumb error has no crumb field', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ error: 'invalid_crumb' }), { status: 200 })
      )

      const result = await hideUnhide('hide', '896389', 'track', 123456, 'old_crumb')

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(result).toBe(false)
    })
  })
})