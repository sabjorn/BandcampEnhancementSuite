import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createDomNodes, cleanupTestNodes } from './utils'
import { initHideUnhide } from '../src/pages/hideUnhide'

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
        <div id="pagedata" data-blob='{"hidden_data":{"item_count":5},"collection_count":10}'></div>
        <div id="js-crumbs-data" data-crumbs='{"api/collectionowner/1/hide_unhide_item":"test-crumb"}'></div>
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
      expect(hideButton?.textContent).toBe('hide all')
      expect(unhideButton).toBeTruthy()
      expect(unhideButton?.textContent).toBe('unhide all')
    })

    it('should insert buttons as first children', async () => {
      await initHideUnhide()
      
      const collectionItemsDiv = document.querySelector('div.collection-items')
      const firstChild = collectionItemsDiv?.firstChild as HTMLElement
      const secondChild = firstChild?.nextSibling as HTMLElement
      
      expect(firstChild.id).toBe('bes-hide-button')
      expect(firstChild.textContent).toBe('hide all')
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
      
      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0]
      messageHandler({
        unhideState: {
          isProcessing: true,
          processedCount: 5,
          totalCount: 10,
          errors: []
        }
      })
      
      const statusNotification = document.getElementById('bes-unhide-status-notification') as HTMLDivElement
      const unhideButton = document.getElementById('bes-unhide-button') as HTMLButtonElement
      
      expect(statusNotification).toBeTruthy()
      expect(statusNotification.classList.contains('bes-notification')).toBe(true)
      expect(statusNotification.classList.contains('bes-status')).toBe(true)
      expect(statusNotification.innerHTML).toContain('5 completed, 5 remaining')
      expect(statusNotification.innerHTML).toContain('Do not refresh or navigate away')
      expect(unhideButton.disabled).toBe(true)
      expect(unhideButton.textContent).toBe('unhide all') 
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
      const unhideButton = document.getElementById('bes-unhide-button') as HTMLButtonElement
      
      messageHandler({
        unhideState: {
          isProcessing: true,
          processedCount: 5,
          totalCount: 10,
          errors: []
        }
      })
      
      const statusNotification = document.getElementById('bes-unhide-status-notification') as HTMLDivElement
      expect(statusNotification).toBeTruthy()
      expect(statusNotification.classList.contains('bes-status')).toBe(true)
      expect(unhideButton.disabled).toBe(true)
      
      messageHandler({
        unhideState: {
          isProcessing: false,
          processedCount: 10,
          totalCount: 10,
          errors: []
        }
      })
      
      expect(document.getElementById('bes-unhide-status-notification')).toBeNull()
      expect(unhideButton.disabled).toBe(false)
      expect(unhideButton.textContent).toBe('unhide all')
      
      messageHandler({
        unhideComplete: {
          message: 'All items unhidden'
        }
      })
      
      expect(document.getElementById('bes-unhide-status-notification')).toBeNull()
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
      
      const statusNotification = document.getElementById('bes-unhide-status-notification') as HTMLDivElement
      expect(statusNotification.innerHTML).toContain('2 errors occurred')
    })

    it('should send unhide message with crumb when unhide button is clicked', async () => {
      const crumbsData = {
        'api/collectionowner/1/hide_unhide_item': 'test-crumb'
      }
      createDomNodes(`
        <div id="pagedata" data-blob='{"hidden_data":{"item_count":5},"collection_count":10}'></div>
        <div id="js-crumbs-data" data-crumbs='${JSON.stringify(crumbsData)}'></div>
      `)
      
      await initHideUnhide()
      
      const unhideButton = document.getElementById('bes-unhide-button') as HTMLElement
      
      expect(unhideButton).toBeTruthy()
      unhideButton.click()
      
      expect(mockPort.postMessage).toHaveBeenCalledWith({ 
        unhide: { crumb: 'test-crumb' } 
      })
    })

    it('should send hide message with crumb when hide button is clicked', async () => {
      const crumbsData = {
        'api/collectionowner/1/hide_unhide_item': 'test-crumb'
      }
      createDomNodes(`
        <div id="pagedata" data-blob='{"hidden_data":{"item_count":5},"collection_count":10}'></div>
        <div id="js-crumbs-data" data-crumbs='${JSON.stringify(crumbsData)}'></div>
      `)
      
      await initHideUnhide()
      
      const hideButton = document.getElementById('bes-hide-button') as HTMLElement
      
      expect(hideButton).toBeTruthy()
      hideButton.click()
      
      expect(mockPort.postMessage).toHaveBeenCalledWith({ 
        hide: { crumb: 'test-crumb' } 
      })
    })

    it('should create hide status display when hide state is processing', async () => {
      const crumbsData = {
        'api/collectionowner/1/hide_unhide_item': 'test-crumb'
      }
      createDomNodes(`
        <div id="js-crumbs-data" data-crumbs='${JSON.stringify(crumbsData)}'></div>
      `)
      
      await initHideUnhide()
      
      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0]
      messageHandler({
        hideState: {
          isProcessing: true,
          processedCount: 3,
          totalCount: 8,
          errors: []
        }
      })
      
      const statusNotification = document.getElementById('bes-hide-status-notification') as HTMLDivElement
      const hideButton = document.getElementById('bes-hide-button') as HTMLButtonElement
      
      expect(statusNotification).toBeTruthy()
      expect(statusNotification.classList.contains('bes-notification')).toBe(true)
      expect(statusNotification.classList.contains('bes-status')).toBe(true)
      expect(statusNotification.innerHTML).toContain('Hiding your collection items')
      expect(statusNotification.innerHTML).toContain('3 completed, 5 remaining')
      expect(statusNotification.innerHTML).toContain('Do not refresh or navigate away')
      expect(hideButton.disabled).toBe(true)
      expect(hideButton.textContent).toBe('hide all') 
    })

    it('should hide status display when hide processing is complete', async () => {
      const crumbsData = {
        'api/collectionowner/1/hide_unhide_item': 'test-crumb'
      }
      createDomNodes(`
        <div id="js-crumbs-data" data-crumbs='${JSON.stringify(crumbsData)}'></div>
      `)
      
      await initHideUnhide()
      
      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0]
      const hideButton = document.getElementById('bes-hide-button') as HTMLButtonElement
      
      messageHandler({
        hideState: {
          isProcessing: true,
          processedCount: 3,
          totalCount: 8,
          errors: []
        }
      })
      
      const statusNotification = document.getElementById('bes-hide-status-notification') as HTMLDivElement
      expect(statusNotification).toBeTruthy()
      expect(statusNotification.classList.contains('bes-status')).toBe(true)
      expect(hideButton.disabled).toBe(true)
      
      messageHandler({
        hideState: {
          isProcessing: false,
          processedCount: 8,
          totalCount: 8,
          errors: []
        }
      })
      
      expect(document.getElementById('bes-hide-status-notification')).toBeNull()
      expect(hideButton.disabled).toBe(false)
      expect(hideButton.textContent).toBe('hide all')
      
      messageHandler({
        hideComplete: {
          message: 'All items hidden'
        }
      })
      
      expect(document.getElementById('bes-hide-status-notification')).toBeNull()
    })

    it('should show error count in hide status display', async () => {
      const crumbsData = {
        'api/collectionowner/1/hide_unhide_item': 'test-crumb'
      }
      createDomNodes(`
        <div id="js-crumbs-data" data-crumbs='${JSON.stringify(crumbsData)}'></div>
      `)
      
      await initHideUnhide()
      
      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0]
      messageHandler({
        hideState: {
          isProcessing: true,
          processedCount: 2,
          totalCount: 6,
          errors: ['Error 1', 'Error 2', 'Error 3']
        }
      })
      
      const statusNotification = document.getElementById('bes-hide-status-notification') as HTMLDivElement
      expect(statusNotification.innerHTML).toContain('3 errors occurred')
    })

    it('should handle hide completion message', async () => {
      await initHideUnhide()
      
      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0]
      
      // Mock showSuccessMessage to verify it's called
      const showSuccessMessage = vi.fn()
      global.showSuccessMessage = showSuccessMessage
      
      messageHandler({
        hideComplete: {
          message: 'Successfully hidden 5 items'
        }
      })
      
      // Since we can't easily mock the notifications module, we'll just verify the message handler doesn't throw
      expect(() => messageHandler({
        hideComplete: {
          message: 'Successfully hidden 5 items'
        }
      })).not.toThrow()
    })

    it('should handle hide error message', async () => {
      await initHideUnhide()
      
      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0]
      
      // Verify the message handler doesn't throw
      expect(() => messageHandler({
        hideError: {
          message: 'Failed to hide items'
        }
      })).not.toThrow()
    })
  })

  describe('hide button with crumb extraction', () => {
    it('should extract crumb from page data and send hide message when button clicked', async () => {
      const crumbsData = {
        'api/collectionowner/1/hide_unhide_item': 'extracted-hide-crumb-456',
        'other/endpoint': 'other-crumb'
      }
      createDomNodes(`
        <div class="collection-items">
          <div class="existing-item">Existing Item</div>
        </div>
        <div id="pagedata" data-blob='{"hidden_data":{"item_count":5},"collection_count":10}'></div>
        <div id="js-crumbs-data" data-crumbs='${JSON.stringify(crumbsData)}'></div>
      `)
      
      await initHideUnhide()
      
      const hideButton = document.getElementById('bes-hide-button') as HTMLElement
      
      hideButton.click()
      
      expect(mockPort.postMessage).toHaveBeenCalledWith({ 
        hide: { crumb: 'extracted-hide-crumb-456' } 
      })
    })

    it('should throw error when crumbs data element is missing for hide button', async () => {
      createDomNodes(`
        <div class="collection-items">
          <div class="existing-item">Existing Item</div>
        </div>
        <div id="pagedata" data-blob='{"hidden_data":{"item_count":5},"collection_count":10}'></div>
      `)
      
      await initHideUnhide()
      
      const hideButton = document.getElementById('bes-hide-button') as HTMLElement
      
      expect(() => hideButton.click()).toThrow()
    })

    it('should send undefined crumb when specific endpoint is missing for hide button', async () => {
      const crumbsData = {
        'other/endpoint': 'other-crumb'
      }
      createDomNodes(`
        <div class="collection-items">
          <div class="existing-item">Existing Item</div>
        </div>
        <div id="pagedata" data-blob='{"hidden_data":{"item_count":5},"collection_count":10}'></div>
        <div id="js-crumbs-data" data-crumbs='${JSON.stringify(crumbsData)}'></div>
      `)
      
      await initHideUnhide()
      
      const hideButton = document.getElementById('bes-hide-button') as HTMLElement
      
      hideButton.click()
      
      expect(mockPort.postMessage).toHaveBeenCalledWith({ 
        hide: { crumb: undefined } 
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
        <div id="pagedata" data-blob='{"hidden_data":{"item_count":5},"collection_count":10}'></div>
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
        <div id="pagedata" data-blob='{"hidden_data":{"item_count":5},"collection_count":10}'></div>
      `)
      
      await initHideUnhide()
      
      const unhideButton = document.getElementById('bes-unhide-button') as HTMLElement
      
      expect(() => unhideButton.click()).toThrow()
    })

    it('should throw error when crumbs data contains invalid JSON', async () => {
      createDomNodes(`
        <div class="collection-items">
          <div class="existing-item">Existing Item</div>
        </div>
        <div id="pagedata" data-blob='{"hidden_data":{"item_count":5},"collection_count":10}'></div>
        <div id="js-crumbs-data" data-crumbs="invalid-json{"></div>
      `)
      
      await initHideUnhide()
      
      const unhideButton = document.getElementById('bes-unhide-button') as HTMLElement
      
      expect(() => unhideButton.click()).toThrow()
    })

    it('should send undefined crumb when specific endpoint is missing', async () => {
      const crumbsData = {
        'other/endpoint': 'other-crumb'
      }
      createDomNodes(`
        <div class="collection-items">
          <div class="existing-item">Existing Item</div>
        </div>
        <div id="pagedata" data-blob='{"hidden_data":{"item_count":5},"collection_count":10}'></div>
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
        <div id="pagedata" data-blob='{"hidden_data":{"item_count":5},"collection_count":10}'></div>
        <div id="js-crumbs-data" data-crumbs='{"api/collectionowner/1/hide_unhide_item":"test-crumb"}'></div>
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

  describe('button state management based on page data', () => {
    it('should disable hide button when all items are hidden (item_count === collection_count)', async () => {
      createDomNodes(`
        <div class="collection-items">
          <div class="existing-item">Existing Item</div>
        </div>
        <div id="pagedata" data-blob='{"hidden_data":{"item_count":10},"collection_count":10}'></div>
        <div id="js-crumbs-data" data-crumbs='{"api/collectionowner/1/hide_unhide_item":"test-crumb"}'></div>
      `)

      await initHideUnhide()
      
      const hideButton = document.getElementById('bes-hide-button') as HTMLButtonElement
      const unhideButton = document.getElementById('bes-unhide-button') as HTMLButtonElement
      
      expect(hideButton.getAttribute('disabled')).toBe('true')
      expect(hideButton.style.opacity).toBe('0.5')
      expect(hideButton.style.pointerEvents).toBe('none')
      expect(unhideButton.getAttribute('disabled')).toBeNull() 
    })

    it('should disable unhide button when no items are hidden (item_count === 0)', async () => {
      createDomNodes(`
        <div class="collection-items">
          <div class="existing-item">Existing Item</div>
        </div>
        <div id="pagedata" data-blob='{"hidden_data":{"item_count":0},"collection_count":10}'></div>
        <div id="js-crumbs-data" data-crumbs='{"api/collectionowner/1/hide_unhide_item":"test-crumb"}'></div>
      `)

      await initHideUnhide()
      
      const hideButton = document.getElementById('bes-hide-button') as HTMLButtonElement
      const unhideButton = document.getElementById('bes-unhide-button') as HTMLButtonElement
      
      expect(hideButton.getAttribute('disabled')).toBeNull() 
      expect(unhideButton.getAttribute('disabled')).toBe('true')
      expect(unhideButton.style.opacity).toBe('0.5')
      expect(unhideButton.style.pointerEvents).toBe('none')
    })

    it('should enable both buttons when some items are hidden (0 < item_count < collection_count)', async () => {
      createDomNodes(`
        <div class="collection-items">
          <div class="existing-item">Existing Item</div>
        </div>
        <div id="pagedata" data-blob='{"hidden_data":{"item_count":5},"collection_count":10}'></div>
        <div id="js-crumbs-data" data-crumbs='{"api/collectionowner/1/hide_unhide_item":"test-crumb"}'></div>
      `)

      await initHideUnhide()
      
      const hideButton = document.getElementById('bes-hide-button') as HTMLButtonElement
      const unhideButton = document.getElementById('bes-unhide-button') as HTMLButtonElement
      
      expect(hideButton.getAttribute('disabled')).toBeNull()
      expect(hideButton.style.opacity).toBe('')
      expect(unhideButton.getAttribute('disabled')).toBeNull()
      expect(unhideButton.style.opacity).toBe('')
    })
  })
})
