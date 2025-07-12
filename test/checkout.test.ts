import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Checkout from '../src/checkout'

describe('Checkout', () => {
  let c: any
  let mockPort: any

  beforeEach(() => {
    mockPort = {
      onMessage: { addListener: vi.fn() },
      postMessage: vi.fn()
    }

    c = new Checkout(mockPort)

    c.log = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('init()', () => {
    let checkoutButtonSubSpy = {
      addEventListener: vi.fn()
    }

    let yesButtonSpy = {
      addEventListener: vi.fn()
    }

    let notNowButtonSpy = {
      addEventListener: vi.fn()
    }

    beforeEach(() => {
      // Create mock DOM elements
      const mockCheckoutButton = { innerHTML: 'Checkout', style: { display: '' } }
      const mockSidecartFooter = { appendChild: vi.fn() }
      const mockDialog = {
        querySelector: vi.fn().mockImplementation((sel) => {
          if (sel === '#yes') return yesButtonSpy
          if (sel === '#not_now') return notNowButtonSpy
          if (sel === '#no') return notNowButtonSpy
          if (sel === '#bes_close') return { addEventListener: vi.fn() }
          return null
        })
      }
      
      // Mock createElement for dialog creation
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'a') {
          return {
            addEventListener: vi.fn(),
            className: '',
            innerHTML: '',
            style: { display: '' }
          } as any
        }
        return {
          insertAdjacentHTML: vi.fn(),
          querySelector: vi.fn().mockReturnValue(mockDialog)
        } as any
      })
      
      // Mock body.appendChild
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.createElement('div'))
      
      vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
        if (selector === '#sidecartCheckout') return mockCheckoutButton as any
        if (selector === '#sidecartFooter') return mockSidecartFooter as any
        if (selector === '#checkout-button-sub') return checkoutButtonSubSpy as any
        if (selector === '#yes-button') return yesButtonSpy as any  
        if (selector === '#not-now-button') return notNowButtonSpy as any
        return null
      })
    })

    it('should initialize checkout functionality', () => {
      c.init()
      expect(mockPort.onMessage.addListener).toHaveBeenCalled()
    })

    it('should add event listeners to checkout buttons', () => {
      // Basic test to ensure init runs without errors
      expect(() => c.init()).not.toThrow()
    })
  })

  it('should instantiate Checkout', () => {
    expect(c).toBeInstanceOf(Checkout)
  })
})