import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createDomNodes, cleanupTestNodes } from './utils'
import { initHideUnhide } from '../src/pages/hideUnhide'

// Mock chrome.runtime
const mockPort = {
  postMessage: vi.fn(),
  onMessage: {
    addListener: vi.fn()
  }
}

global.chrome = {
  runtime: {
    connect: vi.fn().mockReturnValue(mockPort)
  }
} as any

// Mock the logger
vi.mock('../src/logger', () => ({
  default: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }))
}))

describe('HideUnhide', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear any existing crumbs data elements
    document.querySelectorAll('#js-crumbs-data').forEach(el => el.remove())
  })

  afterEach(() => {
    cleanupTestNodes()
  })

  describe('initHideUnhide()', () => {
    beforeEach(() => {
      createDomNodes(`
        <div class="collection-items">
          <div class="existing-item">Existing Item</div>
        </div>
      `)
    })

    it('should initialize hideUnhide functionality', async () => {
      await expect(initHideUnhide()).resolves.not.toThrow()
    })

    it('should add hide and unhide buttons to collection-items div', async () => {
      await initHideUnhide()
      
      const collectionItemsDiv = document.querySelector('div.collection-items')
      expect(collectionItemsDiv).toBeTruthy()
      
      const buttons = collectionItemsDiv?.querySelectorAll('a.follow-unfollow.bes-hideUnhide')
      expect(buttons).toHaveLength(2)
      
      const hideButton = Array.from(buttons || []).find(btn => btn.textContent === 'hide')
      const unhideButton = Array.from(buttons || []).find(btn => btn.textContent === 'unhide all')
      
      expect(hideButton).toBeTruthy()
      expect(unhideButton).toBeTruthy()
    })

    it('should insert buttons as first children', async () => {
      await initHideUnhide()
      
      const collectionItemsDiv = document.querySelector('div.collection-items')
      const firstChild = collectionItemsDiv?.firstChild as HTMLElement
      const secondChild = firstChild?.nextSibling as HTMLElement
      
      expect(firstChild.textContent).toBe('hide')
      expect(secondChild.textContent).toBe('unhide all')
    })

    it('should connect to background script with correct port name', async () => {
      await initHideUnhide()
      
      expect(chrome.runtime.connect).toHaveBeenCalledWith(null, { name: "bandcampenhancementsuite" })
      expect(mockPort.onMessage.addListener).toHaveBeenCalled()
    })

    it('should send unhide message with crumb when unhide button is clicked', async () => {
      // Add the crumbs data element to the DOM using createDomNodes
      const crumbsData = {
        'api/collectionowner/1/hide_unhide_item': 'test-crumb-value'
      }
      createDomNodes(`
        <div id="js-crumbs-data" data-crumbs='${JSON.stringify(crumbsData)}'></div>
      `)
      
      await initHideUnhide()
      
      const buttons = document.querySelectorAll('a.follow-unfollow.bes-hideUnhide')
      const unhideButton = Array.from(buttons).find(btn => btn.textContent === 'unhide all') as HTMLElement
      
      expect(unhideButton).toBeTruthy()
      unhideButton.click()
      
      expect(mockPort.postMessage).toHaveBeenCalledWith({ 
        unhide: { crumb: 'test-crumb-value' } 
      })
    })
  })

  describe('startUnhideProcess', () => {
    it('should extract crumb from page data and send unhide message', async () => {
      const crumbsData = {
        'api/collectionowner/1/hide_unhide_item': 'extracted-crumb-123',
        'other/endpoint': 'other-crumb'
      }
      createDomNodes(`
        <div class="collection-items">
          <div class="existing-item">Existing Item</div>
        </div>
        <div id="js-crumbs-data" data-crumbs='${JSON.stringify(crumbsData)}'></div>
      `)
      
      await initHideUnhide()
      
      const buttons = document.querySelectorAll('a.follow-unfollow.bes-hideUnhide')
      const unhideButton = Array.from(buttons).find(btn => btn.textContent === 'unhide all') as HTMLElement
      
      unhideButton.click()
      
      expect(mockPort.postMessage).toHaveBeenCalledWith({ 
        unhide: { crumb: 'extracted-crumb-123' } 
      })
    })

    it('should handle missing crumbs data element gracefully', async () => {
      createDomNodes(`
        <div class="collection-items">
          <div class="existing-item">Existing Item</div>
        </div>
      `)
      
      await initHideUnhide()
      
      const buttons = document.querySelectorAll('a.follow-unfollow.bes-hideUnhide')
      const unhideButton = Array.from(buttons).find(btn => btn.textContent === 'unhide all') as HTMLElement
      
      // This should throw an error when trying to access the missing element
      expect(() => unhideButton.click()).toThrow()
    })

    it('should handle invalid JSON in crumbs data', async () => {
      createDomNodes(`
        <div class="collection-items">
          <div class="existing-item">Existing Item</div>
        </div>
        <div id="js-crumbs-data" data-crumbs="invalid-json{"></div>
      `)
      
      await initHideUnhide()
      
      const buttons = document.querySelectorAll('a.follow-unfollow.bes-hideUnhide')
      const unhideButton = Array.from(buttons).find(btn => btn.textContent === 'unhide all') as HTMLElement
      
      // This should throw an error when trying to parse invalid JSON
      expect(() => unhideButton.click()).toThrow()
    })

    it('should handle missing specific crumb in data', async () => {
      const crumbsData = {
        'other/endpoint': 'other-crumb'
        // Missing 'api/collectionowner/1/hide_unhide_item'
      }
      createDomNodes(`
        <div class="collection-items">
          <div class="existing-item">Existing Item</div>
        </div>
        <div id="js-crumbs-data" data-crumbs='${JSON.stringify(crumbsData)}'></div>
      `)
      
      await initHideUnhide()
      
      const buttons = document.querySelectorAll('a.follow-unfollow.bes-hideUnhide')
      const unhideButton = Array.from(buttons).find(btn => btn.textContent === 'unhide all') as HTMLElement
      
      unhideButton.click()
      
      expect(mockPort.postMessage).toHaveBeenCalledWith({ 
        unhide: { crumb: undefined } 
      })
    })
  })

  describe('initHideUnhide() without collection-items div', () => {
    beforeEach(() => {
      createDomNodes(`
        <div class="some-other-div">
          <div class="item">Item</div>
        </div>
      `)
    })

    it('should return early when collection-items div is not found', async () => {
      await initHideUnhide()
      
      const buttons = document.querySelectorAll('a.follow-unfollow.bes-hideUnhide')
      expect(buttons).toHaveLength(0)
    })

    it('should not throw when collection-items div is not found', async () => {
      await expect(initHideUnhide()).resolves.not.toThrow()
    })
  })
})
