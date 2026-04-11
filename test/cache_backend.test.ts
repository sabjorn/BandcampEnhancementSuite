import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  }
}));

vi.mock('../src/clients/findmusic', () => ({
  getFindMusicToken: vi.fn(),
  hasFindMusicPermissions: vi.fn()
}));

import { processRequest, initCacheBackend } from '../src/background/cache_backend';
import { getFindMusicToken, hasFindMusicPermissions } from '../src/clients/findmusic';

describe('Cache Backend', () => {
  let mockSendResponse: any;
  let mockFetch: any;

  beforeEach(() => {
    mockSendResponse = vi.fn();
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    globalThis.chrome = {
      runtime: {
        onMessage: {
          addListener: vi.fn()
        }
      }
    } as any;

    process.env.FINDMUSIC_BASE_URL = 'https://findmusic.club';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if ('chrome' in globalThis) {
      (globalThis as any).chrome = undefined;
    }
  });

  describe('processRequest', () => {
    it('should return false for non-cache requests', () => {
      const request = { contentScriptQuery: 'otherQuery' };
      const result = processRequest(request, {} as any, mockSendResponse);

      expect(result).toBe(false);
      expect(mockSendResponse).not.toHaveBeenCalled();
    });

    it('should handle cache request with permissions', async () => {
      vi.mocked(hasFindMusicPermissions).mockResolvedValue(true);
      vi.mocked(getFindMusicToken).mockResolvedValue('test-token');
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('Success')
      });

      const request = {
        contentScriptQuery: 'postCache',
        url: '/api/test',
        method: 'POST',
        requestBody: '{"test":true}',
        responseBody: '{"result":"ok"}'
      };

      const result = processRequest(request, {} as any, mockSendResponse);

      expect(result).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(hasFindMusicPermissions).toHaveBeenCalled();
      expect(getFindMusicToken).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://findmusic.club/api/cache',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token'
          }),
          body: JSON.stringify({
            url: '/api/test',
            method: 'POST',
            body: '{"test":true}',
            rawResponse: '{"result":"ok"}'
          })
        })
      );
    });

    it('should skip cache when no permissions', async () => {
      vi.mocked(hasFindMusicPermissions).mockResolvedValue(false);

      const request = {
        contentScriptQuery: 'postCache',
        url: '/api/test',
        method: 'POST',
        requestBody: '',
        responseBody: ''
      };

      processRequest(request, {} as any, mockSendResponse);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(hasFindMusicPermissions).toHaveBeenCalled();
      expect(getFindMusicToken).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should skip cache when no token available', async () => {
      vi.mocked(hasFindMusicPermissions).mockResolvedValue(true);
      vi.mocked(getFindMusicToken).mockResolvedValue(null);

      const request = {
        contentScriptQuery: 'postCache',
        url: '/api/test',
        method: 'POST',
        requestBody: '',
        responseBody: ''
      };

      processRequest(request, {} as any, mockSendResponse);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(getFindMusicToken).toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(hasFindMusicPermissions).mockResolvedValue(true);
      vi.mocked(getFindMusicToken).mockResolvedValue('test-token');
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error')
      });

      const request = {
        contentScriptQuery: 'postCache',
        url: '/api/test',
        method: 'POST',
        requestBody: '',
        responseBody: ''
      };

      processRequest(request, {} as any, mockSendResponse);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockFetch).toHaveBeenCalled();
      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
    });
  });

  describe('initCacheBackend', () => {
    it('should register message listener', async () => {
      await initCacheBackend();

      expect(globalThis.chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });
  });
});
