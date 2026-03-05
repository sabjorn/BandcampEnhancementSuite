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
  exchangeBandcampToken: vi.fn()
}));

const mockOnMessageAddListener = vi.fn();
const mockTabsCreate = vi.fn();
const mockGetURL = vi.fn((path: string) => path);
const mockPermissionsContains = vi.fn();

Object.assign(global, {
  chrome: {
    runtime: {
      onMessage: {
        addListener: mockOnMessageAddListener
      },
      getURL: mockGetURL
    },
    tabs: {
      create: mockTabsCreate
    },
    permissions: {
      contains: mockPermissionsContains
    }
  }
});

import { processRequest, initFindMusicBackend } from '../src/background/findmusic_backend';
import { exchangeBandcampToken } from '../src/clients/findmusic';

describe('FindMusic Backend', () => {
  const mockExchangeBandcampToken = vi.mocked(exchangeBandcampToken);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initFindMusicBackend()', () => {
    it('should initialize and add message listener', () => {
      initFindMusicBackend();

      expect(mockOnMessageAddListener).toHaveBeenCalledWith(processRequest);
    });
  });

  describe('processRequest()', () => {
    it('should return false for non-openFindMusic messages', async () => {
      const request = { contentScriptQuery: 'somethingElse' };
      const sender = {} as chrome.runtime.MessageSender;
      const sendResponse = vi.fn();

      const result = await processRequest(request, sender, sendResponse);

      expect(result).toBe(false);
      expect(sendResponse).not.toHaveBeenCalled();
    });

    it('should return true for openFindMusic messages', async () => {
      const request = { contentScriptQuery: 'openFindMusic' };
      const sender = {} as chrome.runtime.MessageSender;
      const sendResponse = vi.fn();

      mockPermissionsContains.mockResolvedValue(true);
      mockExchangeBandcampToken.mockResolvedValue('mock-jwt-token');

      const result = await processRequest(request, sender, sendResponse);

      expect(result).toBe(true);
    });

    it('should open permission page when permissions missing', async () => {
      const request = { contentScriptQuery: 'openFindMusic' };
      const sender = {} as chrome.runtime.MessageSender;
      const sendResponse = vi.fn();

      mockPermissionsContains.mockResolvedValue(false);

      await processRequest(request, sender, sendResponse);

      expect(mockTabsCreate).toHaveBeenCalledWith({
        url: 'html/findmusic_permission.html'
      });
      expect(sendResponse).toHaveBeenCalledWith({ success: true, needsPermission: true });
      expect(mockExchangeBandcampToken).not.toHaveBeenCalled();
    });

    it('should exchange token and open tab when permissions granted', async () => {
      const request = { contentScriptQuery: 'openFindMusic' };
      const sender = {} as chrome.runtime.MessageSender;
      const sendResponse = vi.fn();

      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock';
      mockPermissionsContains.mockResolvedValue(true);
      mockExchangeBandcampToken.mockResolvedValue(mockToken);

      await processRequest(request, sender, sendResponse);

      await vi.waitFor(() => {
        expect(mockExchangeBandcampToken).toHaveBeenCalled();
      });

      await vi.waitFor(() => {
        expect(mockTabsCreate).toHaveBeenCalledWith({
          url: `https://findmusic.club/bes-login?bes_token=${encodeURIComponent(mockToken)}`
        });
      });

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith({ success: true });
      });
    });

    it('should send error response on failure', async () => {
      const request = { contentScriptQuery: 'openFindMusic' };
      const sender = {} as chrome.runtime.MessageSender;
      const sendResponse = vi.fn();

      const errorMessage = 'No Bandcamp identity cookie found';
      mockPermissionsContains.mockResolvedValue(true);
      mockExchangeBandcampToken.mockRejectedValue(new Error(errorMessage));

      await processRequest(request, sender, sendResponse);

      await vi.waitFor(() => {
        expect(mockExchangeBandcampToken).toHaveBeenCalled();
      });

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith({
          success: false,
          error: errorMessage
        });
      });

      expect(mockTabsCreate).not.toHaveBeenCalled();
    });
  });
});
