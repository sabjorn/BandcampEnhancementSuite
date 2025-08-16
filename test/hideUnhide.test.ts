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

    it('should send unhide message when unhide button is clicked', async () => {
      await initHideUnhide()
      
      const buttons = document.querySelectorAll('a.follow-unfollow.bes-hideUnhide')
      const unhideButton = Array.from(buttons).find(btn => btn.textContent === 'unhide all') as HTMLElement
      
      expect(unhideButton).toBeTruthy()
      unhideButton.click()
      
      expect(mockPort.postMessage).toHaveBeenCalledWith({ 
        unhide: { crumb: null } 
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
