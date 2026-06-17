import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initDownloadBackend } from '../src/background/download_backend';

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

globalThis.fetch = vi.fn();
globalThis.btoa = vi.fn(str => Buffer.from(str).toString('base64'));

describe('Download Backend', () => {
  let onConnectListener: any;
  let mockPort: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPort = {
      name: 'bes',
      postMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn()
      }
    };

    globalThis.chrome = {
      runtime: {
        onConnect: {
          addListener: vi.fn(listener => {
            onConnectListener = listener;
          })
        }
      }
    } as any;

    initDownloadBackend();
  });

  describe('File Download Process', () => {
    it('should download files and send them individually', async () => {
      const mockArrayBuffer = new ArrayBuffer(100);
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        headers: new Headers(),
        arrayBuffer: async () => mockArrayBuffer
      } as Response);

      onConnectListener(mockPort);
      const onMessageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      const downloadRequest = {
        type: 'downloadFiles',
        urls: ['http://example.com/file1.flac', 'http://example.com/file2.flac']
      };

      await onMessageListener(downloadRequest);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'fileDownloaded',
        filename: 'file1.flac',
        data: mockArrayBuffer
      });

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'fileDownloaded',
        filename: 'file2.flac',
        data: mockArrayBuffer
      });

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'downloadComplete',
        success: true,
        completed: 2,
        failed: 0,
        message: undefined
      });
    });

    it('should handle fetch failures gracefully', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: false,
        status: 404
      } as Response);

      onConnectListener(mockPort);
      const onMessageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      const downloadRequest = {
        type: 'downloadFiles',
        urls: ['http://example.com/missing.flac']
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

    it('should handle partial failures', async () => {
      const mockArrayBuffer = new ArrayBuffer(100);

      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers(),
          arrayBuffer: async () => mockArrayBuffer
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 404
        } as Response);

      onConnectListener(mockPort);
      const onMessageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      const downloadRequest = {
        type: 'downloadFiles',
        urls: ['http://example.com/file1.flac', 'http://example.com/missing.flac']
      };

      await onMessageListener(downloadRequest);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'fileDownloaded',
        filename: 'file1.flac',
        data: mockArrayBuffer
      });

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'downloadComplete',
        success: true,
        completed: 1,
        failed: 1,
        message: '1 files failed to download'
      });
    });

    it('should skip zero-byte files', async () => {
      const emptyBuffer = new ArrayBuffer(0);
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        headers: new Headers(),
        arrayBuffer: async () => emptyBuffer
      } as Response);

      onConnectListener(mockPort);
      const onMessageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      const downloadRequest = {
        type: 'downloadFiles',
        urls: ['http://example.com/empty.flac']
      };

      await onMessageListener(downloadRequest);

      const fileDownloadedCalls = mockPort.postMessage.mock.calls.filter(
        (call: any) => call[0].type === 'fileDownloaded'
      );

      expect(fileDownloadedCalls).toHaveLength(0);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'downloadComplete',
        success: false,
        completed: 0,
        failed: 1,
        message: '1 files failed to download'
      });
    });

    it('should extract filename from URL when no content-disposition header', async () => {
      const mockArrayBuffer = new ArrayBuffer(100);
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        headers: new Headers(),
        arrayBuffer: async () => mockArrayBuffer
      } as Response);

      onConnectListener(mockPort);
      const onMessageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      const downloadRequest = {
        type: 'downloadFiles',
        urls: ['http://example.com/path/to/myfile.flac']
      };

      await onMessageListener(downloadRequest);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'fileDownloaded',
        filename: 'myfile.flac',
        data: mockArrayBuffer
      });
    });

    it('should add .flac extension when filename has no extension', async () => {
      const mockArrayBuffer = new ArrayBuffer(100);
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        headers: new Headers(),
        arrayBuffer: async () => mockArrayBuffer
      } as Response);

      onConnectListener(mockPort);
      const onMessageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      const downloadRequest = {
        type: 'downloadFiles',
        urls: ['http://example.com/path/to/myfile']
      };

      await onMessageListener(downloadRequest);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'fileDownloaded',
        filename: 'myfile.flac',
        data: mockArrayBuffer
      });
    });
  });

  describe('Filename Extraction', () => {
    it('should extract filename from content-disposition header', async () => {
      const mockArrayBuffer = new ArrayBuffer(100);
      const headers = new Headers();
      headers.set('content-disposition', 'attachment; filename="track-01.flac"');

      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        headers,
        arrayBuffer: async () => mockArrayBuffer
      } as Response);

      onConnectListener(mockPort);
      const onMessageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      const downloadRequest = {
        type: 'downloadFiles',
        urls: ['http://example.com/download/123']
      };

      await onMessageListener(downloadRequest);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'fileDownloaded',
        filename: 'track-01.flac',
        data: mockArrayBuffer
      });
    });

    it('should handle content-disposition with no extension and add .flac', async () => {
      const mockArrayBuffer = new ArrayBuffer(100);
      const headers = new Headers();
      headers.set('content-disposition', 'attachment; filename="track-01"');

      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        headers,
        arrayBuffer: async () => mockArrayBuffer
      } as Response);

      onConnectListener(mockPort);
      const onMessageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      const downloadRequest = {
        type: 'downloadFiles',
        urls: ['http://example.com/download/123']
      };

      await onMessageListener(downloadRequest);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'fileDownloaded',
        filename: 'track-01.flac',
        data: mockArrayBuffer
      });
    });
  });
});
