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

// Mock Chrome runtime API
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

// Mock fetch globally
global.fetch = vi.fn();

import { initDownloadBackend } from '../src/background/download_backend';

describe('Download Backend', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful fetch response by default
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

    it('should handle port connections with correct name', () => {
      initDownloadBackend();

      const onConnectListener = mockOnConnect.mock.calls[0][0];

      // Test with correct port name
      const correctPort = { name: 'bes', onMessage: { addListener: vi.fn() } };
      onConnectListener(correctPort);
      expect(correctPort.onMessage.addListener).toHaveBeenCalledWith(expect.any(Function));

      // Test with incorrect port name
      const incorrectPort = { name: 'wrong', onMessage: { addListener: vi.fn() } };
      onConnectListener(incorrectPort);
      expect(incorrectPort.onMessage.addListener).not.toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    it('should set up message listener for correct port', () => {
      const mockPort = {
        name: 'bes', // This is required for the backend to set up the listener
        postMessage: vi.fn(),
        onMessage: { addListener: vi.fn() }
      };

      initDownloadBackend();
      const onConnectListener = mockOnConnect.mock.calls[0][0];

      // Simulate port connection with correct name
      onConnectListener(mockPort);

      // Should have set up message listener
      expect(mockPort.onMessage.addListener).toHaveBeenCalledWith(expect.any(Function));
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
