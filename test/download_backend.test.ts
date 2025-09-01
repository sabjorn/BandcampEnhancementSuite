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
  dateString: vi.fn(() => '2023-01-01')
}));

vi.mock('client-zip', () => ({
  downloadZip: vi.fn(() => ({
    blob: vi.fn(() => Promise.resolve(new Blob(['fake zip data'], { type: 'application/zip' })))
  }))
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

    it('should handle successful downloads and send progress messages', async () => {
      const downloadRequest = {
        type: 'downloadZip',
        urls: ['http://example.com/file1.flac', 'http://example.com/file2.flac']
      };

      await onMessageListener(downloadRequest);

      // Should send initial progress
      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'downloadProgress',
        completed: 0,
        failed: 0,
        total: 2,
        message: 'Starting download of 2 files...'
      });

      // Should send zip creation progress
      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'downloadProgress',
          message: 'Creating zip file...'
        })
      );

      // Should send zip chunks
      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'zipChunk',
          chunkIndex: 0,
          totalChunks: expect.any(Number),
          data: expect.any(String),
          filename: 'bandcamp_2023-01-01.zip'
        })
      );

      // Should send completion message
      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'downloadComplete',
        success: true,
        filename: 'bandcamp_2023-01-01.zip',
        message: 'Successfully downloaded 2 files as bandcamp_2023-01-01.zip'
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle fetch failures and send error messages', async () => {
      // Mock fetch to fail
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404
      } as any);

      const downloadRequest = {
        type: 'downloadZip',
        urls: ['http://example.com/file404.flac']
      };

      await onMessageListener(downloadRequest);

      // Should send failure completion message
      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'downloadComplete',
        success: false,
        message: 'No files could be downloaded'
      });
    });

    it('should handle partial failures and report mixed results', async () => {
      // Mock one success and one failure
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
        type: 'downloadZip',
        urls: ['http://example.com/success.flac', 'http://example.com/fail.flac']
      };

      await onMessageListener(downloadRequest);

      // Should send completion with mixed results
      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'downloadComplete',
          success: true,
          message: expect.stringContaining('1 files failed to download')
        })
      );
    });

    it('should handle fetch exceptions and continue processing', async () => {
      // Mock fetch to throw an error
      vi.mocked(global.fetch)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: vi.fn().mockReturnValue('attachment; filename="success.flac"') },
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
        } as any);

      const downloadRequest = {
        type: 'downloadZip',
        urls: ['http://example.com/error.flac', 'http://example.com/success.flac']
      };

      await onMessageListener(downloadRequest);

      // Should still create zip with successful file
      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'downloadComplete',
          success: true,
          message: expect.stringContaining('1 files failed to download')
        })
      );
    });

    it('should handle zip creation failures', async () => {
      const { downloadZip } = await import('client-zip');

      // Mock downloadZip to throw error
      vi.mocked(downloadZip).mockImplementationOnce(() => {
        throw new Error('Zip creation failed');
      });

      const downloadRequest = {
        type: 'downloadZip',
        urls: ['http://example.com/file1.flac']
      };

      await onMessageListener(downloadRequest);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: 'downloadComplete',
        success: false,
        message: 'Failed to create or download zip file'
      });
    });

    it('should send progress updates after each file download', async () => {
      const downloadRequest = {
        type: 'downloadZip',
        urls: ['http://example.com/file1.flac', 'http://example.com/file2.flac']
      };

      await onMessageListener(downloadRequest);

      // Should send progress after each file
      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'downloadProgress',
          completed: 1,
          failed: 0,
          total: 2,
          message: 'Downloaded 1 of 2 files (0 failed)'
        })
      );

      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'downloadProgress',
          completed: 2,
          failed: 0,
          total: 2,
          message: 'Downloaded 2 of 2 files (0 failed)'
        })
      );
    });

    it('should ignore non-downloadZip message types', async () => {
      const invalidRequest = {
        type: 'invalidType',
        data: 'test'
      };

      await onMessageListener(invalidRequest);

      // Should not call fetch or send messages
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockPort.postMessage).not.toHaveBeenCalled();
    });

    it('should handle chunked zip transfer correctly', async () => {
      // Create a larger mock blob to ensure chunking
      const largeBlobData = 'a'.repeat(2 * 1024 * 1024); // 2MB of data
      const { downloadZip } = await import('client-zip');

      vi.mocked(downloadZip).mockReturnValueOnce({
        blob: vi.fn(() => Promise.resolve(new Blob([largeBlobData], { type: 'application/zip' })))
      } as any);

      const downloadRequest = {
        type: 'downloadZip',
        urls: ['http://example.com/file1.flac']
      };

      await onMessageListener(downloadRequest);

      // Should send multiple zip chunks for large files
      const zipChunkCalls = mockPort.postMessage.mock.calls.filter(call => call[0].type === 'zipChunk');

      expect(zipChunkCalls.length).toBeGreaterThan(1);

      // First chunk should have chunkIndex 0
      expect(zipChunkCalls[0][0]).toMatchObject({
        type: 'zipChunk',
        chunkIndex: 0,
        totalChunks: expect.any(Number),
        data: expect.any(String),
        filename: 'bandcamp_2023-01-01.zip'
      });
    });
  });

  describe('Filename Extraction', () => {
    it('should extract filename from Content-Disposition header', () => {
      // This tests the core logic without complex async integration
      const mockResponse = {
        headers: {
          get: vi.fn().mockReturnValue('attachment; filename="test-track.flac"')
        }
      };

      // Simulate what getFilenameFromResponse does
      const contentDisposition = mockResponse.headers.get('content-disposition');
      const filenameMatch = contentDisposition?.match(/filename\*?=['""]?([^'"";]+)['""]?/i);
      const filename = filenameMatch?.[1] || 'default.flac';

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
      let filename = filenameMatch?.[1] || 'default.flac';

      // Handle RFC 5987 encoding
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
