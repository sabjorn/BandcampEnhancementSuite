import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';
import {
  createCurlButton,
  createZipDownloadButton,
  createStatusElement,
  mutationCallback,
  initDownload,
  generateDownloadList,
  getDownloadPreamble,
  getDownloadPostamble,
  downloadAllFiles
} from '../src/pages/download';

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
  dateString: vi.fn(() => '2023-01-01'),
  createFetchFunction: vi.fn(() => globalThis.fetch)
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

describe('DownloadHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestNodes();
  });

  describe('createCurlButton()', () => {
    it('should create curl download button when div.download-titles exists', () => {
      createDomNodes('<div class="download-titles"></div>');
      const button = createCurlButton();

      expect(button).toBeDefined();
      expect(button?.className).toBe('');
    });

    it('should return undefined when div.download-titles does not exist', () => {
      createDomNodes('<div></div>');
      const button = createCurlButton();

      expect(button).toBeUndefined();
    });
  });

  describe('createZipDownloadButton()', () => {
    it('should create download all files button when div.download-titles exists', () => {
      createDomNodes('<div class="download-titles"></div>');
      const button = createZipDownloadButton();

      expect(button).toBeDefined();
      expect(button?.className).toBe('');
    });

    it('should return undefined when div.download-titles does not exist', () => {
      createDomNodes('<div></div>');
      const button = createZipDownloadButton();

      expect(button).toBeUndefined();
    });
  });

  describe('createStatusElement()', () => {
    it('should create status element when div.download-titles exists', () => {
      createDomNodes('<div class="download-titles"></div>');
      const statusElement = createStatusElement();

      expect(statusElement).toBeDefined();
      expect(statusElement?.className).toBe('bes-download-status');
    });

    it('should return undefined when div.download-titles does not exist', () => {
      createDomNodes('<div></div>');
      const statusElement = createStatusElement();

      expect(statusElement).toBeUndefined();
    });
  });

  describe('mutationCallback()', () => {
    it('should enable buttons when all links are ready', () => {
      createDomNodes(`
        <div class="download-title">
          <a class="item-button" style="display: block;">Link 1</a>
        </div>
        <div class="download-title">
          <a class="item-button" style="display: block;">Link 2</a>
        </div>
      `);

      const curl = { enable: vi.fn(), disable: vi.fn() } as any;
      const zip = { enable: vi.fn(), disable: vi.fn() } as any;
      const status = { style: { display: '' } } as any;

      mutationCallback({ curl, zip }, status);

      expect(curl.enable).toHaveBeenCalled();
      expect(zip.enable).toHaveBeenCalled();
      expect(status.style.display).toBe('none');
    });

    it('should disable buttons when links are not ready', () => {
      createDomNodes(`
        <div class="download-title">
          <a class="item-button" style="display: none;">Link 1</a>
        </div>
      `);

      const curl = { enable: vi.fn(), disable: vi.fn() } as any;
      const zip = { enable: vi.fn(), disable: vi.fn() } as any;
      const status = { style: { display: '' } } as any;

      mutationCallback({ curl, zip }, status);

      expect(curl.disable).toHaveBeenCalled();
      expect(zip.disable).toHaveBeenCalled();
      expect(status.style.display).toBe('block');
    });
  });

  describe('initDownload()', () => {
    it('should initialize download helper functionality', async () => {
      createDomNodes(`
        <div class="download-titles"></div>
        <div class="download-title">
          <a class="item-button" href="/download/123">Download</a>
        </div>
      `);

      await expect(initDownload()).resolves.not.toThrow();
    });
  });

  describe('generateDownloadList()', () => {
    it('should generate download list from links', () => {
      createDomNodes(`
        <a class="item-button" href="http://example.com/file1.flac"></a>
        <a class="item-button" href="http://example.com/file2.flac"></a>
      `);

      const list = generateDownloadList();

      expect(list).toContain('http://example.com/file1.flac');
      expect(list).toContain('http://example.com/file2.flac');
    });

    it('should return empty URLS array when no links found', () => {
      createDomNodes('<div></div>');

      const list = generateDownloadList();

      expect(list).toBe('URLS=()\n');
    });
  });

  describe('getDownloadPreamble()', () => {
    it('should return bash preamble', () => {
      const preamble = getDownloadPreamble();

      expect(preamble).toContain('#!/usr/bin/env bash');
    });
  });

  describe('getDownloadPostamble()', () => {
    it('should return bash postamble', () => {
      const postamble = getDownloadPostamble();

      expect(postamble).toContain('DEFAULT_BATCH_SIZE');
    });
  });

  describe('downloadAllFiles()', () => {
    it('should show error when no download links found', async () => {
      const { showErrorMessage } = await import('../src/components/notifications');
      createDomNodes('<div></div>');

      await downloadAllFiles();

      expect(showErrorMessage).toHaveBeenCalledWith('No download links found');
    });

    it('should connect to background script and request file downloads', async () => {
      const { showPersistentNotification } = await import('../src/components/notifications');
      createDomNodes(`
        <div class="download-title">
          <a class="item-button" href="http://example.com/file1.flac"></a>
        </div>
      `);

      const mockPort = {
        onMessage: { addListener: vi.fn() },
        postMessage: vi.fn(),
        disconnect: vi.fn()
      };

      vi.mocked(global.chrome.runtime.connect).mockReturnValue(mockPort as any);

      const downloadPromise = downloadAllFiles();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(global.chrome.runtime.connect).toHaveBeenCalledWith({ name: 'bes' });
      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'downloadFiles',
        urls: ['http://example.com/file1.flac']
      });
      expect(showPersistentNotification).toHaveBeenCalledWith({
        id: 'bes-download-progress',
        message: 'Downloading 0 of 1 files...',
        type: 'info'
      });

      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0];
      await messageListener({ type: 'downloadComplete', success: true });
      await downloadPromise;
    });
  });
});
