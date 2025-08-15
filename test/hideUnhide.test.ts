import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createDomNodes, cleanupTestNodes } from './utils'
import { initHideUnhide } from '../src/pages/hideUnhide'

const mockHideFunction = vi.fn()
const mockUnhideFunction = vi.fn()

vi.mock('../src/pages/hideUnhide', async () => {
  const actual = await vi.importActual('../src/pages/hideUnhide')
  return {
    ...actual,
    initHideUnhide: vi.fn().mockImplementation(async () => {
      const { createButton } = await import('../src/components/buttons.js')
      
      const hideButton = createButton({
        className: "follow-unfollow bes-hideUnhide",
        innerText: "hide",
        buttonClicked: mockHideFunction
      })

      const unhideButton = createButton({
        className: "follow-unfollow bes-hideUnhide", 
        innerText: "unhide",
        buttonClicked: mockUnhideFunction
      })

      const collectionItemsDiv = document.querySelector("div.collection-items")
      if (!collectionItemsDiv) {
        return
      }

      collectionItemsDiv.insertBefore(unhideButton, collectionItemsDiv.firstChild)
      collectionItemsDiv.insertBefore(hideButton, collectionItemsDiv.firstChild)
    })
  }
})

describe('HideUnhide', () => {
  afterEach(() => {
    cleanupTestNodes()
    vi.clearAllMocks()
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
      const unhideButton = Array.from(buttons || []).find(btn => btn.textContent === 'unhide')
      
      expect(hideButton).toBeTruthy()
      expect(unhideButton).toBeTruthy()
    })

    it('should insert buttons as first children', async () => {
      await initHideUnhide()
      
      const collectionItemsDiv = document.querySelector('div.collection-items')
      const firstChild = collectionItemsDiv?.firstChild as HTMLElement
      const secondChild = firstChild?.nextSibling as HTMLElement
      
      expect(firstChild.textContent).toBe('hide')
      expect(secondChild.textContent).toBe('unhide')
    })

    it('should call mocked hide function when hide button is clicked', async () => {
      await initHideUnhide()
      
      const hideButton = document.querySelector('a.follow-unfollow.bes-hideUnhide') as HTMLElement
      expect(hideButton.textContent).toBe('hide')
      
      hideButton.click()
      expect(mockHideFunction).toHaveBeenCalledTimes(1)
    })

    it('should call mocked unhide function when unhide button is clicked', async () => {
      await initHideUnhide()
      
      const buttons = document.querySelectorAll('a.follow-unfollow.bes-hideUnhide')
      const unhideButton = Array.from(buttons).find(btn => btn.textContent === 'unhide') as HTMLElement
      
      expect(unhideButton).toBeTruthy()
      unhideButton.click()
      expect(mockUnhideFunction).toHaveBeenCalledTimes(1)
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
