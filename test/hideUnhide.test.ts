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
      
      const hideButton = document.getElementById('bes-hide-button')
      const unhideButton = document.getElementById('bes-unhide-button')
      
      expect(hideButton).toBeTruthy()
      expect(hideButton?.textContent).toBe('hide')
      expect(unhideButton).toBeTruthy()
      expect(unhideButton?.textContent).toBe('unhide all')
    })

    it('should insert buttons as first children', async () => {
      await initHideUnhide()
      
      const collectionItemsDiv = document.querySelector('div.collection-items')
      const firstChild = collectionItemsDiv?.firstChild as HTMLElement
      const secondChild = firstChild?.nextSibling as HTMLElement
      
      expect(firstChild.id).toBe('bes-hide-button')
      expect(firstChild.textContent).toBe('hide')
      expect(secondChild.id).toBe('bes-unhide-button')
      expect(secondChild.textContent).toBe('unhide all')
    })

    it('should connect to background script with correct port name', async () => {
      await initHideUnhide()
      
      expect(chrome.runtime.connect).toHaveBeenCalledWith(null, { name: "bandcampenhancementsuite" })
      expect(mockPort.onMessage.addListener).toHaveBeenCalled()
    })

    it('should create status display when unhide state is processing', async () => {
      const crumbsData = {
        'api/collectionowner/1/hide_unhide_item': 'test-crumb'
      }
      createDomNodes(`
        <div id="js-crumbs-data" data-crumbs='${JSON.stringify(crumbsData)}'></div>
      `)
      
      await initHideUnhide()
      
      // Simulate unhide state message
      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0]
      messageHandler({
        unhideState: {
          isProcessing: true,
          processedCount: 5,
          totalCount: 10,
          errors: []
        }
      })
      
      const statusDiv = document.getElementById('bes-unhide-status') as HTMLDivElement
      expect(statusDiv).toBeTruthy()
      expect(statusDiv.style.display).toBe('block')
      expect(statusDiv.innerHTML).toContain('5 completed, 5 remaining')
      expect(statusDiv.innerHTML).toContain('Do not refresh or navigate away')
    })

    it('should hide status display when processing is complete', async () => {
      const crumbsData = {
        'api/collectionowner/1/hide_unhide_item': 'test-crumb'
      }
      createDomNodes(`
        <div id="js-crumbs-data" data-crumbs='${JSON.stringify(crumbsData)}'></div>
      `)
      
      await initHideUnhide()
      
      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0]
      
      // First show processing state
      messageHandler({
        unhideState: {
          isProcessing: true,
          processedCount: 5,
          totalCount: 10,
          errors: []
        }
      })
      
      const statusDiv = document.getElementById('bes-unhide-status') as HTMLDivElement
      expect(statusDiv.style.display).toBe('block')
      
      // Then show completion
      messageHandler({
        unhideComplete: {
          message: 'All items unhidden'
        }
      })
      
      expect(statusDiv.style.display).toBe('none')
    })

    it('should show error count in status display', async () => {
      const crumbsData = {
        'api/collectionowner/1/hide_unhide_item': 'test-crumb'
      }
      createDomNodes(`
        <div id="js-crumbs-data" data-crumbs='${JSON.stringify(crumbsData)}'></div>
      `)
      
      await initHideUnhide()
      
      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0]
      messageHandler({
        unhideState: {
          isProcessing: true,
          processedCount: 3,
          totalCount: 10,
          errors: ['Error 1', 'Error 2']
        }
      })
      
      const statusDiv = document.getElementById('bes-unhide-status') as HTMLDivElement
      expect(statusDiv.innerHTML).toContain('2 errors occurred')
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
      
      const unhideButton = document.getElementById('bes-unhide-button') as HTMLElement
      
      expect(unhideButton).toBeTruthy()
      unhideButton.click()
      
      expect(mockPort.postMessage).toHaveBeenCalledWith({ 
        unhide: { crumb: 'test-crumb-value' } 
      })
    })
  })

  describe('unhide button with crumb extraction', () => {
    it('should extract crumb from page data and send unhide message when button clicked', async () => {
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
      
      const unhideButton = document.getElementById('bes-unhide-button') as HTMLElement
      
      unhideButton.click()
      
      expect(mockPort.postMessage).toHaveBeenCalledWith({ 
        unhide: { crumb: 'extracted-crumb-123' } 
      })
    })

    it('should throw error when crumbs data element is missing', async () => {
      createDomNodes(`
        <div class="collection-items">
          <div class="existing-item">Existing Item</div>
        </div>
      `)
      
      await initHideUnhide()
      
      const unhideButton = document.getElementById('bes-unhide-button') as HTMLElement
      
      // This should throw an error when trying to access the missing element
      expect(() => unhideButton.click()).toThrow()
    })

    it('should throw error when crumbs data contains invalid JSON', async () => {
      createDomNodes(`
        <div class="collection-items">
          <div class="existing-item">Existing Item</div>
        </div>
        <div id="js-crumbs-data" data-crumbs="invalid-json{"></div>
      `)
      
      await initHideUnhide()
      
      const unhideButton = document.getElementById('bes-unhide-button') as HTMLElement
      
      // This should throw an error when trying to parse invalid JSON
      expect(() => unhideButton.click()).toThrow()
    })

    it('should send undefined crumb when specific endpoint is missing', async () => {
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
      
      const unhideButton = document.getElementById('bes-unhide-button') as HTMLElement
      
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
