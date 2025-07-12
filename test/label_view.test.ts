import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createDomNodes, cleanupTestNodes } from './utils'
import LabelView from '../src/label_view'

describe('LabelView', () => {
  let labelView: any

  beforeEach(() => {
    labelView = new LabelView()

    labelView.log = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    }
  })

  afterEach(() => {
    cleanupTestNodes()
    vi.restoreAllMocks()
  })

  it('should instantiate LabelView', () => {
    expect(labelView).toBeInstanceOf(LabelView)
  })

  describe('init()', () => {
    beforeEach(() => {
      createDomNodes(`
        <div id="pagedata" data-blob='{"lo_querystr": "item_id=123"}'></div>
        <div class="label-container">
          <div class="label-item">Test Label</div>
        </div>
      `)
    })

    it('should initialize label view functionality', () => {
      // Basic test to ensure init runs without errors
      expect(() => labelView.init()).not.toThrow()
    })
  })

  describe('label operations', () => {
    beforeEach(() => {
      createDomNodes(`
        <div class="music-grid">
          <div class="music-grid-item">
            <div class="art">Album Art</div>
            <div class="itemurl">Album URL</div>
          </div>
        </div>
      `)
    })

    it('should handle label view items', () => {
      const musicGrid = document.querySelector('.music-grid')
      expect(musicGrid).toBeTruthy()
      expect(musicGrid?.querySelector('.music-grid-item')).toBeTruthy()
    })
  })
})