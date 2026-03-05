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
const mockNotificationsCreate = vi.fn();
const mockGetURL = vi.fn((path: string) => path);

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
    notifications: {
      create: mockNotificationsCreate
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
    it('should return false for non-openFindMusic messages', () => {
      const request = { contentScriptQuery: 'somethingElse' };
      const sender = {} as chrome.runtime.MessageSender;
      const sendResponse = vi.fn();

      const result = processRequest(request, sender, sendResponse);

      expect(result).toBe(false);
      expect(sendResponse).not.toHaveBeenCalled();
    });

    it('should return true for openFindMusic messages', () => {
      const request = { contentScriptQuery: 'openFindMusic' };
      const sender = {} as chrome.runtime.MessageSender;
      const sendResponse = vi.fn();

      mockExchangeBandcampToken.mockResolvedValue('mock-jwt-token');

      const result = processRequest(request, sender, sendResponse);

      expect(result).toBe(true);
    });

    it('should exchange token and open tab on success', async () => {
      const request = { contentScriptQuery: 'openFindMusic' };
      const sender = {} as chrome.runtime.MessageSender;
      const sendResponse = vi.fn();

      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock';
      mockExchangeBandcampToken.mockResolvedValue(mockToken);

      processRequest(request, sender, sendResponse);

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

    it('should show notification and send error response on failure', async () => {
      const request = { contentScriptQuery: 'openFindMusic' };
      const sender = {} as chrome.runtime.MessageSender;
      const sendResponse = vi.fn();

      const errorMessage = 'No Bandcamp identity cookie found';
      mockExchangeBandcampToken.mockRejectedValue(new Error(errorMessage));

      processRequest(request, sender, sendResponse);

      await vi.waitFor(() => {
        expect(mockExchangeBandcampToken).toHaveBeenCalled();
      });

      await vi.waitFor(() => {
        expect(mockNotificationsCreate).toHaveBeenCalledWith({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'FindMusic.club Login Failed',
          message: errorMessage
        });
      });

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith({
          success: false,
          error: errorMessage
        });
      });

      expect(mockTabsCreate).not.toHaveBeenCalled();
    });

    it('should handle permission denied errors', async () => {
      const request = { contentScriptQuery: 'openFindMusic' };
      const sender = {} as chrome.runtime.MessageSender;
      const sendResponse = vi.fn();

      const errorMessage =
        'Permission denied. To use FindMusic.club, please allow access to Bandcamp cookies when prompted.';
      mockExchangeBandcampToken.mockRejectedValue(new Error(errorMessage));

      processRequest(request, sender, sendResponse);

      await vi.waitFor(() => {
        expect(mockNotificationsCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'FindMusic.club Login Failed',
            message: errorMessage
          })
        );
      });

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith({
          success: false,
          error: errorMessage
        });
      });
    });

    it('should use default error message when error has no message', async () => {
      const request = { contentScriptQuery: 'openFindMusic' };
      const sender = {} as chrome.runtime.MessageSender;
      const sendResponse = vi.fn();

      mockExchangeBandcampToken.mockRejectedValue(new Error());

      processRequest(request, sender, sendResponse);

      await vi.waitFor(() => {
        expect(mockNotificationsCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Could not log in to FindMusic.club. Please make sure you are logged in to Bandcamp.'
          })
        );
      });
    });
  });
});
