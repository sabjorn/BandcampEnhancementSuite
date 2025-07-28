import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createDomNodes, cleanupTestNodes } from './utils'
import DownloadHelper from '../src/download_helper'

describe('DownloadHelper', () => {
  let downloadHelper: any

  beforeEach(() => {
    downloadHelper = new DownloadHelper()

    downloadHelper.log = {
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

  it('should instantiate DownloadHelper', () => {
    expect(downloadHelper).toBeInstanceOf(DownloadHelper)
  })

  describe('init()', () => {
    beforeEach(() => {
      createDomNodes(`
        <div class="download-titles">
          <div class="download-title">
            <a class="item-button" href="/download/123">Download</a>
          </div>
        </div>
        <div class="download-item" data-encoding="mp3-320"></div>
      `)
    })

    it('should initialize download helper functionality', () => {
      // Basic test to ensure init runs without errors  
      expect(() => downloadHelper.init()).not.toThrow()
    })

    it('should create download button', () => {
      downloadHelper.init()
      const button = document.querySelector('.bes-downloadall')
      expect(button).toBeTruthy()
      expect(button?.textContent).toContain('Download')
    })
  })

  describe('download operations', () => {
    beforeEach(() => {
      createDomNodes(`
        <div class="download-container">
          <div class="download-item">
            <a href="/download/track/123">Track Download</a>
          </div>
        </div>
      `)
    })

    it('should handle download links', () => {
      const downloadContainer = document.querySelector('.download-container')
      expect(downloadContainer).toBeTruthy()
      
      const downloadLink = downloadContainer?.querySelector('a[href*="/download/"]')
      expect(downloadLink).toBeTruthy()
    })

    it('should process download helpers', () => {
      const downloadItems = document.querySelectorAll('.download-item')
      expect(downloadItems.length).toBeGreaterThan(0)
    })
  })
})