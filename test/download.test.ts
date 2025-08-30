import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';

vi.mock('../src/logger', () => {
  const mockLogMethods = {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  };

  return {
    default: vi.fn(() => mockLogMethods),
    mockLogMethods
  };
});

vi.mock('../src/utilities', () => ({
  downloadFile: vi.fn(),
  dateString: vi.fn(() => '2023-01-01')
}));

vi.mock('../src/components/notifications', () => ({
  showErrorMessage: vi.fn(),
  showSuccessMessage: vi.fn(),
  showPersistentNotification: vi.fn(),
  updatePersistentNotification: vi.fn(),
  removePersistentNotification: vi.fn()
}));

vi.mock('../src/components/buttons', () => ({
  createButton: vi.fn(() => ({
    className: '',
    innerText: '',
    title: '',
    style: { marginLeft: '' },
    getAttribute: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    addEventListener: vi.fn()
  }))
}));

// Mock Chrome runtime API
Object.assign(global, {
  chrome: {
    runtime: {
      connect: vi.fn(() => ({
        onMessage: {
          addListener: vi.fn()
        },
        postMessage: vi.fn(),
        disconnect: vi.fn()
      }))
    }
  }
});

import {
  initDownload,
  createCurlButton,
  createZipDownloadButton,
  createStatusElement,
  mutationCallback,
  generateDownloadList,
  getDownloadPreamble,
  getDownloadPostamble,
  downloadAsZip
} from '../src/pages/download';
import Logger from '../src/logger';
import { createButton } from '../src/components/buttons';

describe('DownloadHelper', () => {
  let mockLog: any;

  beforeEach(() => {
    mockLog = vi.mocked(new Logger());
  });

  afterEach(() => {
    cleanupTestNodes();
    vi.restoreAllMocks();
  });

  describe('createCurlButton()', () => {
    it('should create curl download button when div.download-titles exists', () => {
      createDomNodes('<div class="download-titles"></div>');
      const button = createCurlButton();

      expect(button).toBeTruthy();
      expect(createButton).toHaveBeenCalledWith({
        className: 'bes-downloadall',
        innerText: 'Download cURL File',
        buttonClicked: expect.any(Function)
      });
      expect(document.querySelector('.download-titles')).toBeTruthy();
    });

    it('should return undefined when div.download-titles does not exist', () => {
      createDomNodes('<div></div>');
      const button = createCurlButton();

      expect(button).toBeUndefined();
      expect(mockLog.warn).toHaveBeenCalledWith(
        'Cannot create download button: div.download-titles element not found'
      );
    });
  });

  describe('createZipDownloadButton()', () => {
    it('should create zip download button when div.download-titles exists', () => {
      createDomNodes('<div class="download-titles"></div>');
      const button = createZipDownloadButton();

      expect(button).toBeTruthy();
      expect(createButton).toHaveBeenCalledWith({
        className: 'bes-downloadzip',
        innerText: 'Download ZIP',
        buttonClicked: expect.any(Function)
      });
    });

    it('should return undefined when div.download-titles does not exist', () => {
      createDomNodes('<div></div>');
      const button = createZipDownloadButton();

      expect(button).toBeUndefined();
      expect(mockLog.warn).toHaveBeenCalledWith(
        'Cannot create zip download button: div.download-titles element not found'
      );
    });
  });

  describe('createStatusElement()', () => {
    it('should create status element when div.download-titles exists', () => {
      createDomNodes('<div class="download-titles"></div>');
      const statusElement = createStatusElement();

      expect(statusElement).toBeTruthy();
      expect(statusElement?.className).toBe('bes-download-status');
      expect(statusElement?.textContent).toBe('preparing download');
      expect(statusElement?.getAttribute('disabled')).toBe('true');
    });

    it('should return undefined when div.download-titles does not exist', () => {
      createDomNodes('<div></div>');
      const statusElement = createStatusElement();

      expect(statusElement).toBeUndefined();
      expect(mockLog.warn).toHaveBeenCalledWith('Cannot create status element: div.download-titles element not found');
    });
  });

  describe('mutationCallback()', () => {
    let curlButton: any;
    let zipButton: any;
    let statusElement: any;

    beforeEach(() => {
      createDomNodes(`
        <div class="download-titles"></div>
        <div class="download-title">
          <a class="item-button" style="display: none">Link 1</a>
        </div>
        <div class="download-title">
          <a class="item-button" style="display: block">Link 2</a>
        </div>
      `);

      curlButton = { enable: vi.fn(), disable: vi.fn() };
      zipButton = { enable: vi.fn(), disable: vi.fn() };
      statusElement = { style: { display: '' } };
    });

    it('should disable buttons and show status when links are not ready', () => {
      // Start with statusElement hidden
      statusElement.style.display = 'none';

      mutationCallback({ curl: curlButton, zip: zipButton }, statusElement);

      expect(curlButton.disable).toHaveBeenCalled();
      expect(zipButton.disable).toHaveBeenCalled();
      expect(statusElement.style.display).toBe('block');
      expect(mockLog.info).toHaveBeenCalledWith('linksReady: false');
    });

    it('should enable buttons and hide status when all links are ready', () => {
      // Make all links visible
      const links = document.querySelectorAll('.item-button');
      links.forEach(link => {
        (link as HTMLElement).style.display = 'block';
      });

      mutationCallback({ curl: curlButton, zip: zipButton }, statusElement);

      expect(curlButton.enable).toHaveBeenCalled();
      expect(zipButton.enable).toHaveBeenCalled();
      expect(statusElement.style.display).toBe('none');
      expect(mockLog.info).toHaveBeenCalledWith('linksReady: true');
    });
  });

  describe('generateDownloadList()', () => {
    it('should generate bash array with download URLs', () => {
      createDomNodes(`
        <a class="item-button" href="http://example.com/file1.flac"></a>
        <a class="item-button" href="http://example.com/file2.flac"></a>
        <a class="item-button" href="http://example.com/file1.flac"></a>
      `);

      const result = generateDownloadList();

      expect(result).toContain('URLS=(');
      expect(result).toContain('"http://example.com/file1.flac"');
      expect(result).toContain('"http://example.com/file2.flac"');
      // Should deduplicate URLs
      expect(result.split('file1.flac').length).toBe(2); // Original + 1 occurrence
    });

    it('should return empty array when no links found', () => {
      createDomNodes('<div></div>');

      const result = generateDownloadList();

      expect(result).toBe('URLS=()\n');
    });
  });

  describe('getDownloadPreamble() and getDownloadPostamble()', () => {
    it('should return bash script components', () => {
      const preamble = getDownloadPreamble();
      const postamble = getDownloadPostamble();

      expect(preamble).toContain('#!/usr/bin/env bash');
      expect(postamble).toContain('download_file()');
      expect(postamble).toContain('curl -L --fail -OJ');
      expect(postamble).toContain('BATCH_SIZE');
    });
  });

  describe('downloadAsZip()', () => {
    beforeEach(() => {
      createDomNodes(`
        <div id="test-area">
          <a class="item-button" href="http://example.com/file1.flac"></a>
          <a class="item-button" href="http://example.com/file2.flac"></a>
        </div>
      `);
    });

    it('should start zip download process with valid links', async () => {
      const mockPort = {
        onMessage: { addListener: vi.fn() },
        postMessage: vi.fn(),
        disconnect: vi.fn()
      };

      vi.mocked(global.chrome.runtime.connect).mockReturnValue(mockPort as any);

      await downloadAsZip();

      expect(global.chrome.runtime.connect).toHaveBeenCalledWith({ name: 'bes' });
      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'downloadZip',
        urls: ['http://example.com/file1.flac', 'http://example.com/file2.flac']
      });
      expect(mockLog.info).toHaveBeenCalledWith('Starting zip download for 2 files via background script');
    });

    it('should extract URLs from item buttons', () => {
      // Clean up first, then create fresh DOM
      createDomNodes(`
        <div id="test-urls">
          <a class="item-button" href="http://example.com/file1.flac"></a>
          <a class="item-button" href="http://example.com/file2.flac"></a>
          <a class="item-button" href="">Empty href</a>
          <a class="item-button">No href</a>
        </div>
      `);

      const urls = [...document.querySelectorAll('#test-urls a.item-button')]
        .map(item => item.getAttribute('href'))
        .filter((url): url is string => url !== null && url !== '');

      expect(urls).toEqual(['http://example.com/file1.flac', 'http://example.com/file2.flac']);
    });
  });

  describe('initDownload()', () => {
    beforeEach(() => {
      createDomNodes(`
        <div class="download-titles"></div>
        <div class="download-title">
          <a class="item-button" href="/download/123">Download</a>
        </div>
      `);
    });

    it('should initialize download helper functionality', async () => {
      await expect(initDownload()).resolves.not.toThrow();

      expect(createButton).toHaveBeenCalledTimes(2); // curl and zip buttons
    });

    it('should set up mutation observers for download links', async () => {
      const observeSpy = vi.spyOn(MutationObserver.prototype, 'observe');

      await initDownload();

      expect(observeSpy).toHaveBeenCalled();
    });
  });
});
