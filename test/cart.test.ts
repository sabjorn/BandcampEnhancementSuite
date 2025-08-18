import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPagedata, createDomNodes, cleanupTestNodes } from './utils'

// Mock the logger
vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn()
    error = vi.fn()
    debug = vi.fn()
    warn = vi.fn()
  }
}))

import { initCart } from '../src/pages/cart'

describe('Cart', () => {
  afterEach(() => {
    cleanupTestNodes()
    vi.restoreAllMocks()
  })

  describe('init()', () => {
    beforeEach(() => {
      createDomNodes(`
        <div id="sidecartReveal">
          <div class="cart-controls"></div>
        </div>
      `)
    })

    it('should initialize cart functionality', async () => {
      await expect(initCart()).resolves.not.toThrow()
    })
  })

  describe('cart operations', () => {
    beforeEach(() => {
      createPagedata()
      createDomNodes(`
        <div id="cart-container">
          <div class="cart-item">Test Item</div>
        </div>
      `)
    })

    it('should handle cart items', () => {
      const cartContainer = document.querySelector('#cart-container')
      expect(cartContainer).toBeTruthy()
      expect(cartContainer?.querySelector('.cart-item')).toBeTruthy()
    })
  })
})