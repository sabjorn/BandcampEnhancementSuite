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
import {
  showPersistentNotification,
  updatePersistentNotification,
  removePersistentNotification,
  showErrorMessage,
  showSuccessMessage
} from '../src/components/notifications';

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
          <a class="item-button" style="display: none">Link 2</a>
        </div>
      `);

      curlButton = { enable: vi.fn(), disable: vi.fn() };
      zipButton = { enable: vi.fn(), disable: vi.fn() };
      statusElement = { style: { display: '' } };
    });

    it('should disable buttons and show status when links are not ready', () => {
      statusElement.style.display = 'none';

      mutationCallback({ curl: curlButton, zip: zipButton }, statusElement);

      expect(curlButton.disable).toHaveBeenCalled();
      expect(zipButton.disable).toHaveBeenCalled();
      expect(statusElement.style.display).toBe('block');
    });

    it('should enable buttons and hide status when all links are ready', () => {
      const links = document.querySelectorAll('.item-button');
      links.forEach(link => {
        (link as HTMLElement).style.display = 'block';
      });

      mutationCallback({ curl: curlButton, zip: zipButton }, statusElement);

      expect(curlButton.enable).toHaveBeenCalled();
      expect(zipButton.enable).toHaveBeenCalled();
      expect(statusElement.style.display).toBe('none');
    });

    it('should not enable buttons and hide status when not all links are ready', () => {
      const link = document.querySelectorAll('.item-button')[0];
      (link as HTMLElement).style.display = 'block';

      mutationCallback({ curl: curlButton, zip: zipButton }, statusElement);

      expect(curlButton.enable).not.toHaveBeenCalled();
      expect(zipButton.enable).not.toHaveBeenCalled();
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
    });

    it('should handle downloadProgress messages and show notifications', async () => {
      const mockPort = {
        onMessage: { addListener: vi.fn() },
        postMessage: vi.fn(),
        disconnect: vi.fn()
      };

      vi.mocked(global.chrome.runtime.connect).mockReturnValue(mockPort as any);

      const getElementSpy = vi.spyOn(document, 'getElementById').mockReturnValue(null);

      await downloadAsZip();

      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      await messageListener({
        type: 'downloadProgress',
        message: 'Starting download...'
      });

      expect(vi.mocked(showPersistentNotification)).toHaveBeenCalledWith({
        id: 'bes-download-progress',
        message: 'Starting download...',
        type: 'info'
      });

      getElementSpy.mockRestore();
    });

    it('should handle downloadProgress messages and update existing notifications', async () => {
      const mockPort = {
        onMessage: { addListener: vi.fn() },
        postMessage: vi.fn(),
        disconnect: vi.fn()
      };

      vi.mocked(global.chrome.runtime.connect).mockReturnValue(mockPort as any);

      const mockElement = document.createElement('div');
      const getElementSpy = vi.spyOn(document, 'getElementById').mockReturnValue(mockElement);

      await downloadAsZip();

      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      await messageListener({
        type: 'downloadProgress',
        message: 'Downloaded 1 of 3 files...'
      });

      expect(vi.mocked(updatePersistentNotification)).toHaveBeenCalledWith(
        'bes-download-progress',
        'Downloaded 1 of 3 files...'
      );

      getElementSpy.mockRestore();
    });

    it('should handle zipChunk messages and assemble zip file', async () => {
      const mockPort = {
        onMessage: { addListener: vi.fn() },
        postMessage: vi.fn(),
        disconnect: vi.fn()
      };

      vi.mocked(global.chrome.runtime.connect).mockReturnValue(mockPort as any);

      global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
      global.URL.revokeObjectURL = vi.fn();
      global.atob = vi.fn(str => str);

      await downloadAsZip();

      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      await messageListener({
        type: 'zipChunk',
        chunkIndex: 0,
        totalChunks: 2,
        data: 'chunk1data',
        filename: 'test.zip'
      });

      expect(mockLog.info).toHaveBeenCalledWith('Receiving zip in 2 chunks');
      expect(vi.mocked(updatePersistentNotification)).toHaveBeenCalledWith(
        'bes-download-progress',
        'Downloading... 0%'
      );

      await messageListener({
        type: 'zipChunk',
        chunkIndex: 1,
        totalChunks: 2,
        data: 'chunk2data',
        filename: 'test.zip'
      });

      expect(vi.mocked(updatePersistentNotification)).toHaveBeenCalledWith(
        'bes-download-progress',
        'Downloading... 100%'
      );
      expect(mockLog.info).toHaveBeenCalledWith('All chunks received, assembling zip file...');
      expect(vi.mocked(removePersistentNotification)).toHaveBeenCalledWith('bes-download-progress');
      expect(vi.mocked(showSuccessMessage)).toHaveBeenCalledWith('Successfully downloaded test.zip');
    });

    it('should handle zipChunk assembly errors', async () => {
      const mockPort = {
        onMessage: { addListener: vi.fn() },
        postMessage: vi.fn(),
        disconnect: vi.fn()
      };

      vi.mocked(global.chrome.runtime.connect).mockReturnValue(mockPort as any);

      global.atob = vi.fn(() => {
        throw new Error('Invalid base64');
      });

      await downloadAsZip();

      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      await messageListener({
        type: 'zipChunk',
        chunkIndex: 0,
        totalChunks: 1,
        data: 'invalidbase64',
        filename: 'test.zip'
      });

      expect(mockLog.error).toHaveBeenCalledWith('Error assembling zip file: Error: Invalid base64');
      expect(vi.mocked(removePersistentNotification)).toHaveBeenCalledWith('bes-download-progress');
      expect(vi.mocked(showErrorMessage)).toHaveBeenCalledWith('Failed to assemble zip file');
    });

    it('should handle downloadComplete failure messages', async () => {
      const mockPort = {
        onMessage: { addListener: vi.fn() },
        postMessage: vi.fn(),
        disconnect: vi.fn()
      };

      vi.mocked(global.chrome.runtime.connect).mockReturnValue(mockPort as any);

      await downloadAsZip();

      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      await messageListener({
        type: 'downloadComplete',
        success: false,
        message: 'Download failed'
      });

      expect(vi.mocked(removePersistentNotification)).toHaveBeenCalledWith('bes-download-progress');
      expect(vi.mocked(showErrorMessage)).toHaveBeenCalledWith('Download failed');
      expect(mockPort.disconnect).toHaveBeenCalled();
    });

    it('should correctly convert base64 chunks to binary data', async () => {
      const mockPort = {
        onMessage: { addListener: vi.fn() },
        postMessage: vi.fn(),
        disconnect: vi.fn()
      };

      vi.mocked(global.chrome.runtime.connect).mockReturnValue(mockPort as any);

      // Create realistic base64 test data
      const testData1 = 'hello world';
      const testData2 = 'test data';
      const base64Chunk1 = btoa(testData1);
      const base64Chunk2 = btoa(testData2);

      // Mock atob to work with real base64
      global.atob = vi.fn().mockImplementation(str => {
        if (str === base64Chunk1) return testData1;
        if (str === base64Chunk2) return testData2;
        return str;
      });

      // Mock URL and DOM methods
      const mockDownloadUrl = 'blob:test-download-url';
      global.URL.createObjectURL = vi.fn(() => mockDownloadUrl);
      global.URL.revokeObjectURL = vi.fn();

      const mockAnchor = {
        style: {},
        click: vi.fn(),
        href: '',
        download: ''
      };
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(node => node);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(node => node);

      await downloadAsZip();

      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      // Send first chunk
      await messageListener({
        type: 'zipChunk',
        chunkIndex: 0,
        totalChunks: 2,
        data: base64Chunk1,
        filename: 'test.zip'
      });

      // Send second chunk to complete assembly
      await messageListener({
        type: 'zipChunk',
        chunkIndex: 1,
        totalChunks: 2,
        data: base64Chunk2,
        filename: 'test.zip'
      });

      // Verify binary conversion was called correctly
      expect(global.atob).toHaveBeenCalledWith(base64Chunk1);
      expect(global.atob).toHaveBeenCalledWith(base64Chunk2);

      // Verify blob creation with correct size
      expect(global.Blob).toHaveBeenCalledWith([expect.any(Uint8Array)], { type: 'application/zip' });

      // Verify download trigger
      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockAnchor.href).toBe(mockDownloadUrl);
      expect(mockAnchor.download).toBe('test.zip');
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(mockDownloadUrl);

      // Clean up spies
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('should handle missing chunks during assembly', async () => {
      const mockPort = {
        onMessage: { addListener: vi.fn() },
        postMessage: vi.fn(),
        disconnect: vi.fn()
      };

      vi.mocked(global.chrome.runtime.connect).mockReturnValue(mockPort as any);

      await downloadAsZip();

      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      // Send only chunk 0 of 2 total chunks
      await messageListener({
        type: 'zipChunk',
        chunkIndex: 0,
        totalChunks: 2,
        data: btoa('chunk0'),
        filename: 'test.zip'
      });

      // Now artificially trigger completion by saying we have all chunks
      // but chunk 1 will be undefined in the array, causing the error
      // We need to trick the system into thinking all chunks are received

      // The receivedChunks check looks for non-undefined values
      // So let's send chunk 1 as an empty string to trigger the assembly
      // but make the conversion fail
      await messageListener({
        type: 'zipChunk',
        chunkIndex: 1,
        totalChunks: 2,
        data: '', // Empty string will pass the undefined check but fail conversion
        filename: 'test.zip'
      });

      // The assembly should fail because empty string is not valid base64
      expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining('Error assembling zip file:'));
      expect(vi.mocked(showErrorMessage)).toHaveBeenCalledWith('Failed to assemble zip file');
    });

    it('should correctly calculate download percentage during chunk assembly', async () => {
      const mockPort = {
        onMessage: { addListener: vi.fn() },
        postMessage: vi.fn(),
        disconnect: vi.fn()
      };

      vi.mocked(global.chrome.runtime.connect).mockReturnValue(mockPort as any);

      await downloadAsZip();

      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      // Test percentage calculation with 4 chunks
      await messageListener({
        type: 'zipChunk',
        chunkIndex: 0,
        totalChunks: 4,
        data: btoa('chunk1'),
        filename: 'test.zip'
      });

      expect(vi.mocked(updatePersistentNotification)).toHaveBeenCalledWith(
        'bes-download-progress',
        'Downloading... 0%'
      );

      await messageListener({
        type: 'zipChunk',
        chunkIndex: 1,
        totalChunks: 4,
        data: btoa('chunk2'),
        filename: 'test.zip'
      });

      expect(vi.mocked(updatePersistentNotification)).toHaveBeenCalledWith(
        'bes-download-progress',
        'Downloading... 50%'
      );

      await messageListener({
        type: 'zipChunk',
        chunkIndex: 2,
        totalChunks: 4,
        data: btoa('chunk3'),
        filename: 'test.zip'
      });

      expect(vi.mocked(updatePersistentNotification)).toHaveBeenCalledWith(
        'bes-download-progress',
        'Downloading... 75%'
      );
    });
  });

  describe('Zip Assembly Functions', () => {
    beforeEach(() => {
      createDomNodes(`
        <div id="test-area">
          <a class="item-button" href="http://example.com/file1.flac"></a>
          <a class="item-button" href="http://example.com/file2.flac"></a>
        </div>
      `);
    });

    it('should correctly convert and combine multiple base64 chunks into single Uint8Array', async () => {
      const mockPort = {
        onMessage: { addListener: vi.fn() },
        postMessage: vi.fn(),
        disconnect: vi.fn()
      };

      vi.mocked(global.chrome.runtime.connect).mockReturnValue(mockPort as any);

      // Use real btoa/atob for accurate testing
      const originalAtob = global.atob;
      global.atob = (str: string) => {
        // Simulate real base64 decoding for test
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let result = '';
        // Simple mock that returns predictable data
        if (str === 'SGVsbG8=') return 'Hello'; // 'Hello' base64
        if (str === 'V29ybGQ=') return 'World'; // 'World' base64
        return originalAtob ? originalAtob(str) : str;
      };

      // Mock Blob constructor to capture the data
      let capturedBlobData: any = null;
      global.Blob = vi.fn().mockImplementation((data, options) => {
        capturedBlobData = data[0]; // Capture the Uint8Array
        return { size: data[0].length, type: options?.type };
      });

      // Mock DOM methods
      const mockAnchor = {
        style: {},
        click: vi.fn(),
        href: '',
        download: ''
      };
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(node => node);
      vi.spyOn(document.body, 'removeChild').mockImplementation(node => node);

      await downloadAsZip();

      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      // Send chunks that should combine to "HelloWorld"
      await messageListener({
        type: 'zipChunk',
        chunkIndex: 0,
        totalChunks: 2,
        data: 'SGVsbG8=', // 'Hello'
        filename: 'test.zip'
      });

      await messageListener({
        type: 'zipChunk',
        chunkIndex: 1,
        totalChunks: 2,
        data: 'V29ybGQ=', // 'World'
        filename: 'test.zip'
      });

      // Verify the combined binary data
      expect(capturedBlobData).toBeInstanceOf(Uint8Array);
      expect(capturedBlobData.length).toBe(10); // 'HelloWorld' = 10 bytes

      // Convert back to string to verify content
      const resultString = String.fromCharCode(...capturedBlobData);
      expect(resultString).toBe('HelloWorld');

      // Restore
      global.atob = originalAtob;
    });

    it('should handle chunk progress logging correctly', async () => {
      const mockPort = {
        onMessage: { addListener: vi.fn() },
        postMessage: vi.fn(),
        disconnect: vi.fn()
      };

      vi.mocked(global.chrome.runtime.connect).mockReturnValue(mockPort as any);

      // Mock atob to work properly
      global.atob = vi.fn(str => `decoded-${str}`);

      // Mock DOM to prevent errors
      const createElementSpy = vi
        .spyOn(document, 'createElement')
        .mockReturnValue({ style: {}, click: vi.fn() } as any);
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(node => node);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(node => node);

      await downloadAsZip();

      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      // Send 12 chunks to test the "every 10th chunk" logging
      for (let i = 0; i < 12; i++) {
        if (i === 0) {
          await messageListener({
            type: 'zipChunk',
            chunkIndex: i,
            totalChunks: 12,
            data: btoa(`chunk${i}`),
            filename: 'test.zip'
          });
        } else if (i === 11) {
          // Last chunk triggers assembly
          await messageListener({
            type: 'zipChunk',
            chunkIndex: i,
            totalChunks: 12,
            data: btoa(`chunk${i}`),
            filename: 'test.zip'
          });
        } else {
          await messageListener({
            type: 'zipChunk',
            chunkIndex: i,
            totalChunks: 12,
            data: btoa(`chunk${i}`),
            filename: 'test.zip'
          });
        }
      }

      // Should log key assembly steps
      expect(mockLog.info).toHaveBeenCalledWith('Converting base64 chunks to binary...');
      expect(mockLog.info).toHaveBeenCalledWith('Processed chunk 10/12');
      expect(mockLog.info).toHaveBeenCalledWith(
        expect.stringMatching(/Converting 12 chunks to single array \(\d+ bytes\)\.\.\./)
      );

      // Clean up spies
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
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
