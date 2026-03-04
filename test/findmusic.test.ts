import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  }
}));

const mockPermissionsContains = vi.fn();
const mockPermissionsRequest = vi.fn();
const mockCookiesGet = vi.fn();
const mockNotificationsCreate = vi.fn();

Object.assign(global, {
  chrome: {
    permissions: {
      contains: mockPermissionsContains,
      request: mockPermissionsRequest
    },
    cookies: {
      get: mockCookiesGet
    },
    notifications: {
      create: mockNotificationsCreate
    }
  }
});

global.fetch = vi.fn();

import { exchangeBandcampToken } from '../src/clients/findmusic';

describe('FindMusic Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('exchangeBandcampToken()', () => {
    describe('Permission Handling', () => {
      it('should proceed without requesting permissions if already granted', async () => {
        mockPermissionsContains.mockResolvedValue(true);
        mockCookiesGet.mockResolvedValue({ value: 'mock-bc-token' });
        vi.mocked(global.fetch).mockResolvedValue({
          ok: true,
          json: async () => ({
            token: 'mock-jwt-token',
            user: { id: '123', username: 'testuser' }
          })
        } as any);

        await exchangeBandcampToken();

        expect(mockPermissionsContains).toHaveBeenCalledWith({
          permissions: ['cookies'],
          origins: ['https://bandcamp.com/*', 'https://*.bandcamp.com/*']
        });
        expect(mockPermissionsRequest).not.toHaveBeenCalled();
        expect(mockNotificationsCreate).not.toHaveBeenCalled();
      });

      it('should request permissions and show explanatory notification when not granted', async () => {
        mockPermissionsContains.mockResolvedValue(false);
        mockPermissionsRequest.mockResolvedValue(true);
        mockCookiesGet.mockResolvedValue({ value: 'mock-bc-token' });
        vi.mocked(global.fetch).mockResolvedValue({
          ok: true,
          json: async () => ({
            token: 'mock-jwt-token',
            user: { id: '123', username: 'testuser' }
          })
        } as any);

        const promise = exchangeBandcampToken();

        // Should show notification before requesting permission
        await vi.waitFor(() => {
          expect(mockNotificationsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
              title: 'FindMusic.club Permission Request',
              message: expect.stringContaining('we need to read your Bandcamp cookie')
            })
          );
        });

        // Fast-forward the 1.5 second delay
        await vi.advanceTimersByTimeAsync(1500);

        // Then request permissions
        await vi.waitFor(() => {
          expect(mockPermissionsRequest).toHaveBeenCalledWith({
            permissions: ['cookies'],
            origins: ['https://bandcamp.com/*', 'https://*.bandcamp.com/*', 'https://*.findmusic.club/*']
          });
        });

        await promise;
      });

      it('should show success notification when permissions are granted', async () => {
        mockPermissionsContains.mockResolvedValue(false);
        mockPermissionsRequest.mockResolvedValue(true);
        mockCookiesGet.mockResolvedValue({ value: 'mock-bc-token' });
        vi.mocked(global.fetch).mockResolvedValue({
          ok: true,
          json: async () => ({
            token: 'mock-jwt-token',
            user: { id: '123', username: 'testuser' }
          })
        } as any);

        const promise = exchangeBandcampToken();
        await vi.advanceTimersByTimeAsync(1500);
        await promise;

        expect(mockNotificationsCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'FindMusic.club Connected',
            message: expect.stringContaining('Successfully connected')
          })
        );
      });

      it('should throw error and show notification when permissions are denied', async () => {
        mockPermissionsContains.mockResolvedValue(false);
        mockPermissionsRequest.mockResolvedValue(false);

        const promise = exchangeBandcampToken();

        // Attach empty catch handler to prevent unhandled rejection warning
        promise.catch(() => {});

        // Wait for initial notification
        await vi.waitFor(() => {
          expect(mockNotificationsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
              title: 'FindMusic.club Permission Request'
            })
          );
        });

        // Advance timers
        await vi.advanceTimersByTimeAsync(1500);

        // Expect rejection
        await expect(promise).rejects.toThrow(
          'Permission denied. To use FindMusic.club, please allow access to Bandcamp cookies when prompted.'
        );

        // Verify denial notification was shown
        expect(mockNotificationsCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'FindMusic.club Access Denied',
            message: expect.stringContaining('Permission was denied')
          })
        );
      });
    });

    describe('Cookie Retrieval', () => {
      beforeEach(() => {
        mockPermissionsContains.mockResolvedValue(true);
      });

      it('should retrieve Bandcamp identity cookie', async () => {
        mockCookiesGet.mockResolvedValue({ value: 'mock-bc-token' });
        vi.mocked(global.fetch).mockResolvedValue({
          ok: true,
          json: async () => ({
            token: 'mock-jwt-token',
            user: { id: '123', username: 'testuser' }
          })
        } as any);

        await exchangeBandcampToken();

        expect(mockCookiesGet).toHaveBeenCalledWith({
          url: 'https://bandcamp.com/',
          name: 'identity'
        });
      });

      it('should throw error when no Bandcamp cookie found', async () => {
        mockCookiesGet.mockResolvedValue(null);

        await expect(exchangeBandcampToken()).rejects.toThrow(
          'No Bandcamp identity cookie found. Please log in to Bandcamp first.'
        );
      });

      it('should throw error when Bandcamp cookie has no value', async () => {
        mockCookiesGet.mockResolvedValue({ value: '' });

        await expect(exchangeBandcampToken()).rejects.toThrow(
          'No Bandcamp identity cookie found. Please log in to Bandcamp first.'
        );
      });
    });

    describe('Token Exchange API', () => {
      beforeEach(() => {
        mockPermissionsContains.mockResolvedValue(true);
        mockCookiesGet.mockResolvedValue({ value: 'test-bc-token' });
      });

      it('should send POST request to FindMusic.club API with bc_token', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
          ok: true,
          json: async () => ({
            token: 'mock-jwt-token',
            user: { id: '123', username: 'testuser' }
          })
        } as any);

        await exchangeBandcampToken();

        expect(global.fetch).toHaveBeenCalledWith('https://findmusic.club/api/bctoken', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            bc_token: 'test-bc-token'
          })
        });
      });

      it('should return JWT token on successful exchange', async () => {
        const mockJwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock';
        vi.mocked(global.fetch).mockResolvedValue({
          ok: true,
          json: async () => ({
            token: mockJwtToken,
            user: { id: '123', username: 'testuser' }
          })
        } as any);

        const result = await exchangeBandcampToken();

        expect(result).toBe(mockJwtToken);
      });

      it('should throw error when API returns non-OK status', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          text: async () => 'Invalid token'
        } as any);

        await expect(exchangeBandcampToken()).rejects.toThrow('Failed to exchange token: 401 Unauthorized');
      });

      it('should throw error when API returns 500 error', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: async () => 'Server error'
        } as any);

        await expect(exchangeBandcampToken()).rejects.toThrow('Failed to exchange token: 500 Internal Server Error');
      });

      it('should handle network errors', async () => {
        vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

        await expect(exchangeBandcampToken()).rejects.toThrow('Network error');
      });

      it('should handle non-Error exceptions', async () => {
        vi.mocked(global.fetch).mockRejectedValue('String error');

        await expect(exchangeBandcampToken()).rejects.toThrow('Unknown error occurred while exchanging token');
      });
    });

    describe('Integration Flow', () => {
      it('should complete full flow: no permissions → request → get cookie → exchange → return token', async () => {
        const mockBcToken = 'bandcamp-cookie-value';
        const mockJwtToken = 'jwt-token-value';

        mockPermissionsContains.mockResolvedValue(false);
        mockPermissionsRequest.mockResolvedValue(true);
        mockCookiesGet.mockResolvedValue({ value: mockBcToken });
        vi.mocked(global.fetch).mockResolvedValue({
          ok: true,
          json: async () => ({
            token: mockJwtToken,
            user: { id: '123', username: 'testuser' }
          })
        } as any);

        const promise = exchangeBandcampToken();

        // Wait for permission request notification
        await vi.waitFor(() => {
          expect(mockNotificationsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
              title: 'FindMusic.club Permission Request'
            })
          );
        });

        // Advance through delay
        await vi.advanceTimersByTimeAsync(1500);

        // Wait for permission request
        await vi.waitFor(() => {
          expect(mockPermissionsRequest).toHaveBeenCalled();
        });

        const result = await promise;

        // Verify success notification
        expect(mockNotificationsCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'FindMusic.club Connected'
          })
        );

        // Verify cookie was retrieved
        expect(mockCookiesGet).toHaveBeenCalled();

        // Verify API was called
        expect(global.fetch).toHaveBeenCalledWith(
          'https://findmusic.club/api/bctoken',
          expect.objectContaining({
            body: JSON.stringify({ bc_token: mockBcToken })
          })
        );

        // Verify token was returned
        expect(result).toBe(mockJwtToken);
      });
    });
  });
});
