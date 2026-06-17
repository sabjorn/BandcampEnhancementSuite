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
  },
  URL: {
    createObjectURL: vi.fn(() => 'blob:test-url'),
    revokeObjectURL: vi.fn()
  },
  atob: vi.fn(str => str),
  Blob: vi.fn()
});

import {
  initDownload,
  createCurlButton,
  createDownloadAllButton,
  createStatusElement,
  mutationCallback,
  generateDownloadList,
  getDownloadPreamble,
  getDownloadPostamble,
  downloadAllFiles
} from '../src/pages/download';
import Logger from '../src/logger';
import { createButton } from '../src/components/buttons';
import {
  showPersistentNotification,
  updatePersistentNotification,
  removePersistentNotification,
  showErrorMessage,
  showSuccessMessage
} from '../src/components/notifications';
import { downloadFile, dateString } from '../src/utilities';

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

    it('should execute curl download when button is clicked', () => {
      createDomNodes('<div class="download-titles"></div>');
      createCurlButton();

      const createButtonCall = vi.mocked(createButton).mock.calls[0][0];
      const buttonClickedCallback = createButtonCall.buttonClicked;

      expect(buttonClickedCallback).toBeDefined();
      buttonClickedCallback!();

      expect(vi.mocked(dateString)).toHaveBeenCalled();
      expect(vi.mocked(downloadFile)).toHaveBeenCalledWith(
        'bandcamp_2023-01-01.txt',
        expect.stringContaining('#!/usr/bin/env bash')
      );
      expect(vi.mocked(downloadFile)).toHaveBeenCalledWith(
        'bandcamp_2023-01-01.txt',
        expect.stringContaining('URLS=(')
      );
    });

    it('should create complete curl script when button is clicked with DOM elements', () => {
      createDomNodes(`
        <div class="download-titles"></div>
        <a class="item-button" href="http://example.com/track1.flac"></a>
        <a class="item-button" href="http://example.com/track2.flac"></a>
      `);

      createCurlButton();

      const createButtonCall = vi.mocked(createButton).mock.calls[0][0];
      const buttonClickedCallback = createButtonCall.buttonClicked;

      buttonClickedCallback!();

      expect(vi.mocked(downloadFile)).toHaveBeenCalledWith('bandcamp_2023-01-01.txt', expect.stringMatching(/^#!/));
      expect(vi.mocked(downloadFile)).toHaveBeenCalledWith(
        'bandcamp_2023-01-01.txt',
        expect.stringContaining('download_file()')
      );
    });

    it('should return undefined when div.download-titles does not exist', () => {
      createDomNodes('<div></div>');
      const button = createCurlButton();

      expect(button).toBeUndefined();
    });
  });

  describe('createDownloadAllButton()', () => {
    it('should create download all files button when div.download-titles exists', () => {
      createDomNodes('<div class="download-titles"></div>');
      const button = createDownloadAllButton();

      expect(button).toBeTruthy();
      expect(createButton).toHaveBeenCalledWith({
        className: 'bes-downloadall-files',
        innerText: 'Download All Files',
        buttonClicked: expect.any(Function)
      });
    });

    it('should execute file download when button is clicked', async () => {
      createDomNodes(`
        <div class="download-titles"></div>
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

      createDownloadAllButton();

      const createButtonCall = vi.mocked(createButton).mock.calls[0][0];
      const buttonClickedCallback = createButtonCall.buttonClicked;

      expect(buttonClickedCallback).toBeDefined();
      const downloadPromise = buttonClickedCallback!();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(global.chrome.runtime.connect).toHaveBeenCalledWith({ name: 'bes' });
      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'downloadFiles',
        urls: ['http://example.com/file1.flac']
      });

      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0];
      await messageListener({ type: 'downloadComplete', success: true, completed: 1, failed: 0 });
      await downloadPromise;
    });

    it('should show error when download all button is clicked with no download links', async () => {
      createDomNodes('<div class="download-titles"></div>');

      createDownloadAllButton();

      const createButtonCall = vi.mocked(createButton).mock.calls[0][0];
      const buttonClickedCallback = createButtonCall.buttonClicked;

      await buttonClickedCallback!();

      expect(vi.mocked(showErrorMessage)).toHaveBeenCalledWith('No download links found');
      expect(global.chrome.runtime.connect).not.toHaveBeenCalled();
    });

    it('should return undefined when div.download-titles does not exist', () => {
      createDomNodes('<div></div>');
      const button = createDownloadAllButton();

      expect(button).toBeUndefined();
    });
  });

  describe('createStatusElement()', () => {
    it('should create status element when div.download-titles exists', () => {
      createDomNodes('<div class="download-titles"></div>');
      const statusElement = createStatusElement();

      expect(statusElement).toBeTruthy();
      expect(statusElement?.className).toBe('bes-download-status');
      expect(statusElement?.textContent).toBe('preparing download...');
      expect(statusElement?.getAttribute('disabled')).toBe('true');
      expect(statusElement?.style.display).toBe('block');
    });

    it('should return undefined when div.download-titles does not exist', () => {
      createDomNodes('<div></div>');
      const statusElement = createStatusElement();

      expect(statusElement).toBeUndefined();
    });
  });

  describe('mutationCallback()', () => {
    let curlButton: any;
    let downloadAllButton: any;
    let statusElement: any;

    beforeEach(() => {
      createDomNodes(`
        <div class="download-titles"></div>
        <div class="download-title">
          <a class="item-button" style="display: none">Link 1</a>
        </div>
        <div class="download-title">
          <a class="item-button" style="display: none">Link 2</a>
        </div>
      `);

      curlButton = { enable: vi.fn(), disable: vi.fn(), style: { display: '' } };
      downloadAllButton = { enable: vi.fn(), disable: vi.fn(), style: { display: '' } };
      statusElement = { style: { display: '' } };
    });

    it('should hide buttons and show status when links are not ready', () => {
      statusElement.style.display = 'none';

      mutationCallback({ curl: curlButton, downloadAll: downloadAllButton }, statusElement);

      expect(curlButton.disable).toHaveBeenCalled();
      expect(downloadAllButton.disable).toHaveBeenCalled();
      expect(curlButton.style.display).toBe('none');
      expect(downloadAllButton.style.display).toBe('none');
      expect(statusElement.style.display).toBe('block');
    });

    it('should show and enable buttons and hide status when all links are ready', () => {
      const links = document.querySelectorAll('.item-button');
      links.forEach(link => {
        (link as HTMLElement).style.display = 'block';
      });

      mutationCallback({ curl: curlButton, downloadAll: downloadAllButton }, statusElement);

      expect(curlButton.enable).toHaveBeenCalled();
      expect(downloadAllButton.enable).toHaveBeenCalled();
      expect(curlButton.style.display).toBe('inline-block');
      expect(downloadAllButton.style.display).toBe('inline-block');
      expect(statusElement.style.display).toBe('none');
    });

    it('should keep buttons hidden and status visible when not all links are ready', () => {
      const link = document.querySelectorAll('.item-button')[0];
      (link as HTMLElement).style.display = 'block';

      mutationCallback({ curl: curlButton, downloadAll: downloadAllButton }, statusElement);

      expect(curlButton.enable).not.toHaveBeenCalled();
      expect(downloadAllButton.enable).not.toHaveBeenCalled();
      expect(curlButton.style.display).toBe('none');
      expect(downloadAllButton.style.display).toBe('none');
      expect(statusElement.style.display).toBe('block');
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
      expect(result.split('file1.flac').length, 'Should deduplicate URLs -- Original + 1 occurrence').toBe(2);
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

  describe('downloadAllFiles()', () => {
    it('should show error when no download links found', async () => {
      createDomNodes('<div class="download-titles"></div>');

      await downloadAllFiles();

      expect(vi.mocked(showErrorMessage)).toHaveBeenCalledWith('No download links found');
      expect(global.chrome.runtime.connect).not.toHaveBeenCalled();
    });

    it('should connect to background script and send download request', async () => {
      createDomNodes(`
        <div class="download-title">
          <a class="item-button" href="http://example.com/file1.flac"></a>
        </div>
        <div class="download-title">
          <a class="item-button" href="http://example.com/file2.flac"></a>
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
        urls: ['http://example.com/file1.flac', 'http://example.com/file2.flac']
      });

      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0];
      await messageListener({ type: 'downloadComplete', success: true, completed: 2, failed: 0 });
      await downloadPromise;
    });

    it('should show progress notification when downloading starts', async () => {
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

      expect(vi.mocked(showPersistentNotification)).toHaveBeenCalledWith({
        id: 'bes-download-progress',
        message: 'Downloading 0 of 1 files...',
        type: 'info'
      });

      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0];
      await messageListener({ type: 'downloadComplete', success: true, completed: 1, failed: 0 });
      await downloadPromise;
    });

    it('should update progress as files are downloaded', async () => {
      createDomNodes(`
        <div class="download-title">
          <a class="item-button" href="http://example.com/file1.flac"></a>
        </div>
        <div class="download-title">
          <a class="item-button" href="http://example.com/file2.flac"></a>
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

      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      await messageListener({
        type: 'fileDownloaded',
        filename: 'file1.flac',
        data: new ArrayBuffer(1024)
      });

      expect(vi.mocked(updatePersistentNotification)).toHaveBeenCalledWith(
        'bes-download-progress',
        'Downloaded 1 of 2 files...'
      );

      await messageListener({ type: 'downloadComplete', success: true, completed: 2, failed: 0 });
      await downloadPromise;
    });

    it('should show success message when all files downloaded', async () => {
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

      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      await messageListener({ type: 'downloadComplete', success: true, completed: 1, failed: 0 });
      await downloadPromise;

      expect(vi.mocked(removePersistentNotification)).toHaveBeenCalledWith('bes-download-progress');
      expect(vi.mocked(showSuccessMessage)).toHaveBeenCalledWith('Successfully downloaded 1 of 1 files');
    });

    it('should show failure count in success message if some files failed', async () => {
      createDomNodes(`
        <div class="download-title">
          <a class="item-button" href="http://example.com/file1.flac"></a>
        </div>
        <div class="download-title">
          <a class="item-button" href="http://example.com/file2.flac"></a>
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

      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      await messageListener({ type: 'downloadComplete', success: true, completed: 1, failed: 1 });
      await downloadPromise;

      expect(vi.mocked(showSuccessMessage)).toHaveBeenCalledWith('Successfully downloaded 1 of 2 files (1 failed)');
    });

    it('should show error message when download fails completely', async () => {
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

      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      await messageListener({ type: 'downloadComplete', success: false, message: 'All files failed' });
      await downloadPromise;

      expect(vi.mocked(removePersistentNotification)).toHaveBeenCalledWith('bes-download-progress');
      expect(vi.mocked(showErrorMessage)).toHaveBeenCalledWith('All files failed');
    });

    it('should disconnect port when download completes', async () => {
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

      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      await messageListener({ type: 'downloadComplete', success: true, completed: 1, failed: 0 });
      await downloadPromise;

      expect(mockPort.disconnect).toHaveBeenCalled();
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

      expect(createButton).toHaveBeenCalledTimes(2); // curl and download all buttons
    });

    it('should set up mutation observers for download links', async () => {
      const observeSpy = vi.spyOn(MutationObserver.prototype, 'observe');

      await initDownload();

      expect(observeSpy).toHaveBeenCalled();
    });
  });
});
