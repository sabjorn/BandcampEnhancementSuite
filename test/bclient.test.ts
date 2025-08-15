import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getUrl, addAlbumToCart, getTralbumDetails } from '../src/bclient'

describe('bclient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getUrl', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://example.bandcamp.com/album/test'
        },
        writable: true
      })
    })

    it('should extract domain from current URL', () => {
      const result = getUrl()
      expect(result).toBe('example.bandcamp.com')
    })
  })

  describe('addAlbumToCart', () => {
    let fetchSpy: any

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('{"success": true}', { status: 200 })
      )
      
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://test.bandcamp.com/album/example'
        },
        writable: true
      })
    })

    it('should make POST request to cart endpoint with correct parameters', async () => {
      await addAlbumToCart('123', '10.00', 'a')

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://test.bandcamp.com/cart/cb',
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

    it('should use provided URL parameter', async () => {
      await addAlbumToCart('456', '15.00', 't', 'custom.bandcamp.com')

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://custom.bandcamp.com/cart/cb',
        expect.anything()
      )
    })

    it('should default item_type to "a"', async () => {
      await addAlbumToCart('789', '20.00')

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
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
})