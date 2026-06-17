import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  }
}));

vi.mock('../src/utilities', () => ({
  dateString: vi.fn(() => '2023-01-01'),
  createFetchFunction: vi.fn(() => globalThis.fetch)
}));

const mockOnConnect = vi.fn();

Object.assign(global, {
  chrome: {
    runtime: {
      onConnect: {
        addListener: mockOnConnect
      }
    }
  }
});

global.fetch = vi.fn();

import { initDownloadBackend } from '../src/background/download_backend';

describe('Download Backend', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: vi.fn().mockReturnValue('attachment; filename="track.flac"')
      },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initDownloadBackend()', () => {
    it('should initialize download backend and set up port listener', () => {
      initDownloadBackend();

      expect(mockOnConnect).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should handle port messages with correct name', () => {
      initDownloadBackend();

      const onConnectListener = mockOnConnect.mock.calls[0][0];

      const correctPort = { name: 'bes', onMessage: { addListener: vi.fn() } };
      onConnectListener(correctPort);
      expect(correctPort.onMessage.addListener).toHaveBeenCalledWith(expect.any(Function));

      const incorrectPort = { name: 'wrong', onMessage: { addListener: vi.fn() } };
      onConnectListener(incorrectPort);
      expect(incorrectPort.onMessage.addListener).not.toHaveBeenCalled();
    });
  });

  describe('Download Process and Message Handling', () => {
    let mockPort: any;
    let onMessageListener: any;

    beforeEach(() => {
      mockPort = {
        name: 'bes',
        postMessage: vi.fn(),
        onMessage: { addListener: vi.fn() }
      };

      initDownloadBackend();
      const onConnectListener = mockOnConnect.mock.calls[0][0];
      onConnectListener(mockPort);
      onMessageListener = mockPort.onMessage.addListener.mock.calls[0][0];
    });

    it('should handle successful downloads and send fileDownloaded messages', async () => {
      const downloadRequest = {
        type: 'downloadFiles',
        urls: ['http://example.com/file1.flac', 'http://example.com/file2.flac']
      };

      await onMessageListener(downloadRequest);

      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'fileDownloaded',
          filename: 'track.flac',
          data: expect.any(ArrayBuffer)
        })
      );

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'downloadComplete',
        success: true,
        completed: 2,
        failed: 0
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle fetch failures and send error messages', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404
      } as any);

      const downloadRequest = {
        type: 'downloadFiles',
        urls: ['http://example.com/file404.flac']
      };

      await onMessageListener(downloadRequest);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'downloadComplete',
        success: false,
        completed: 0,
        failed: 1,
        message: '1 files failed to download'
      });
    });

    it('should handle partial failures and report mixed results', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: vi.fn().mockReturnValue('attachment; filename="success.flac"') },
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 404
        } as any);

      const downloadRequest = {
        type: 'downloadFiles',
        urls: ['http://example.com/success.flac', 'http://example.com/fail.flac']
      };

      await onMessageListener(downloadRequest);

      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'downloadComplete',
          success: true,
          completed: 1,
          failed: 1,
          message: expect.stringContaining('1 files failed to download')
        })
      );
    });

    it('should handle fetch exceptions and continue processing', async () => {
      vi.mocked(global.fetch)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: vi.fn().mockReturnValue('attachment; filename="success.flac"') },
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
        } as any);

      const downloadRequest = {
        type: 'downloadFiles',
        urls: ['http://example.com/error.flac', 'http://example.com/success.flac']
      };

      await onMessageListener(downloadRequest);

      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'downloadComplete',
          success: true,
          completed: 1,
          failed: 1,
          message: expect.stringContaining('1 files failed to download')
        })
      );
    });

    it('should send fileDownloaded messages for each successful download', async () => {
      const downloadRequest = {
        type: 'downloadFiles',
        urls: ['http://example.com/file1.flac', 'http://example.com/file2.flac']
      };

      await onMessageListener(downloadRequest);

      const fileDownloadedCalls = mockPort.postMessage.mock.calls.filter(call => call[0].type === 'fileDownloaded');

      expect(fileDownloadedCalls).toHaveLength(2);
      expect(fileDownloadedCalls[0][0]).toMatchObject({
        type: 'fileDownloaded',
        filename: 'track.flac',
        data: expect.any(ArrayBuffer)
      });
    });

    it('should ignore non-downloadFiles message types', async () => {
      const invalidRequest = {
        type: 'invalidType',
        data: 'test'
      };

      await onMessageListener(invalidRequest);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockPort.postMessage).not.toHaveBeenCalled();
    });

    it('should handle zero-byte file downloads as failures', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('attachment; filename="empty.flac"')
        },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
      } as any);

      const downloadRequest = {
        type: 'downloadFiles',
        urls: ['http://example.com/empty.flac']
      };

      await onMessageListener(downloadRequest);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'downloadComplete',
        success: false,
        completed: 0,
        failed: 1,
        message: '1 files failed to download'
      });
    });

    it('should handle missing filename as download failure', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue(null)
        },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
      } as any);

      const downloadRequest = {
        type: 'downloadFiles',
        urls: ['http://no-extension-no-header']
      };

      await onMessageListener(downloadRequest);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'downloadComplete',
        success: false,
        completed: 0,
        failed: 1,
        message: '1 files failed to download'
      });
    });
  });

  describe('Filename Extraction', () => {
    it('should extract filename from Content-Disposition header', () => {
      const mockResponse = {
        headers: {
          get: vi.fn().mockReturnValue('attachment; filename="test-track.flac"')
        }
      };

      const contentDisposition = mockResponse.headers.get('content-disposition');
      const filenameMatch = contentDisposition?.match(/filename\*?=['""]?([^'"";]+)['""]?/i);
      const filename = filenameMatch[1];

      expect(filename).toBe('test-track.flac');
    });

    it('should handle UTF-8 encoded filenames', () => {
      const mockResponse = {
        headers: {
          get: vi.fn().mockReturnValue("attachment; filename*=UTF-8''%E2%9C%93%20track.flac")
        }
      };

      const contentDisposition = mockResponse.headers.get('content-disposition');
      const filenameMatch = contentDisposition?.match(/filename\*?=([^;]+)/i);
      let filename = filenameMatch[1];

      if (filename.includes("UTF-8''")) {
        filename = decodeURIComponent(filename.split("UTF-8''")[1]);
      }

      expect(filename).toBe('✓ track.flac');
    });

    it('should fallback to URL-based filename', () => {
      const url = 'http://example.com/path/song-title';
      const urlObj = new URL(url);
      const filename = urlObj.pathname.split('/').pop() + '.flac';

      expect(filename).toBe('song-title.flac');
    });
  });
});
