import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { connectionListenerCallback, portListenerCallback } from '../src/background/unhide_backend'

// Mock the bclient module
vi.mock('../src/bclient', () => ({
  getCollectionSummary: vi.fn(),
  getHiddenItems: vi.fn(),
  hideUnhide: vi.fn()
}))

// Mock the logger
vi.mock('../src/logger', () => ({
  default: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }))
}))

import { getCollectionSummary, getHiddenItems, hideUnhide } from '../src/bclient'

describe('unhide_backend', () => {
  let mockPort: any
  let portState: { port?: chrome.runtime.Port }

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockPort = {
      name: 'bandcampenhancementsuite',
      postMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn()
      }
    }
    
    portState = {}
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('connectionListenerCallback', () => {
    it('should handle valid port connection', () => {
      connectionListenerCallback(mockPort, portState)

      expect(portState.port).toBe(mockPort)
      expect(mockPort.onMessage.addListener).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should reject invalid port name', () => {
      const invalidPort = { ...mockPort, name: 'invalidport' }
      
      connectionListenerCallback(invalidPort, portState)

      // With invalid port name, the function returns early so port is not set
      expect(portState.port).toBeUndefined()
      expect(invalidPort.onMessage.addListener).not.toHaveBeenCalled()
    })
  })

  describe('portListenerCallback', () => {
    beforeEach(() => {
      portState.port = mockPort
      // Establish connection to create the queue
      connectionListenerCallback(mockPort, portState)
    })

    it('should handle unhide message', async () => {
      const mockCollectionSummary = {
        fan_id: 123456,
        username: 'testuser',
        url: 'https://bandcamp.com/testuser',
        tralbum_lookup: {},
        follows: { following: {} }
      }

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
      }

      vi.mocked(getCollectionSummary).mockResolvedValue(mockCollectionSummary)
      vi.mocked(getHiddenItems).mockResolvedValue(mockHiddenItemsResponse)
      vi.mocked(hideUnhide).mockResolvedValue(true)

      const message = {
        unhide: {
          crumb: 'test-crumb'
        }
      }

      await portListenerCallback(message, portState)

      expect(getCollectionSummary).toHaveBeenCalled()
      expect(getHiddenItems).toHaveBeenCalledWith(123456, '', 20)
    })


    it('should handle getUnhideState message', async () => {
      const message = { getUnhideState: true }

      await portListenerCallback(message, portState)

      // The state should have a default structure since queue gets created
      expect(mockPort.postMessage).toHaveBeenCalledWith({ 
        unhideState: expect.objectContaining({
          isProcessing: expect.any(Boolean),
          queue: expect.any(Array),
          processedCount: expect.any(Number),
          totalCount: expect.any(Number),
          errors: expect.any(Array)
        })
      })
    })

    it('should handle empty token in pagination', async () => {
      const mockCollectionSummary = {
        fan_id: 123456,
        username: 'testuser',
        url: 'https://bandcamp.com/testuser',
        tralbum_lookup: {},
        follows: { following: {} }
      }

      const mockHiddenItemsResponse = {
        items: [],
        redownload_urls: {},
        item_lookup: {},
        last_token: '',
        similar_gift_ids: {},
        last_token_is_gift: false
      }

      vi.mocked(getCollectionSummary).mockResolvedValue(mockCollectionSummary)
      vi.mocked(getHiddenItems).mockResolvedValue(mockHiddenItemsResponse)

      const message = {
        unhide: {
          crumb: 'test-crumb'
        }
      }

      await portListenerCallback(message, portState)

      expect(getCollectionSummary).toHaveBeenCalled()
      expect(getHiddenItems).toHaveBeenCalledWith(123456, '', 20)
      expect(mockPort.postMessage).toHaveBeenCalledWith({ 
        unhideComplete: { message: "No hidden items found" } 
      })
    })

    it('should handle API errors gracefully', async () => {
      vi.mocked(getCollectionSummary).mockRejectedValue(new Error('API Error'))

      const message = {
        unhide: {
          crumb: 'test-crumb'
        }
      }

      await portListenerCallback(message, portState)

      expect(mockPort.postMessage).toHaveBeenCalledWith({ 
        unhideError: { message: "Error: Error: API Error" } 
      })
    })
  })
})