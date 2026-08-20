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
  storeFindMusicToken: vi.fn(),
  getFindMusicTokenFromStorage: vi.fn(),
  hasFindMusicPermissions: vi.fn(),
  createFetchFunction: vi.fn(() => globalThis.fetch)
}));

const mockCookiesGet = vi.fn();

Object.assign(global, {
  chrome: {
    cookies: {
      get: mockCookiesGet
    }
  }
});

global.fetch = vi.fn();

process.env.FINDMUSIC_BASE_URL = 'https://findmusic.club';

import {
  exchangeBandcampToken,
  getFindMusicToken,
  fetchAlbumTrackState,
  postTrackPlayed
} from '../src/clients/findmusic';
import { storeFindMusicToken, getFindMusicTokenFromStorage, hasFindMusicPermissions } from '../src/utilities';

describe('FindMusic Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exchangeBandcampToken()', () => {
    describe('Cookie Retrieval', () => {
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

      it('should store token after successful exchange', async () => {
        const mockJwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock';
        vi.mocked(global.fetch).mockResolvedValue({
          ok: true,
          json: async () => ({
            token: mockJwtToken,
            user: { id: '123', username: 'testuser' }
          })
        } as any);

        await exchangeBandcampToken();

        expect(storeFindMusicToken).toHaveBeenCalledWith(mockJwtToken);
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
  });

  describe('getFindMusicToken()', () => {
    beforeEach(() => {
      Object.assign(global, {
        chrome: {
          ...global.chrome,
          permissions: {
            contains: vi.fn().mockResolvedValue(true)
          }
        }
      });
    });

    it('should return stored token if valid', async () => {
      const mockStoredToken = 'stored-jwt-token';
      const hasFindMusicPermissionsMock = vi.mocked(hasFindMusicPermissions);
      const getFindMusicTokenFromStorageMock = vi.mocked(getFindMusicTokenFromStorage);
      hasFindMusicPermissionsMock.mockResolvedValue(true);
      getFindMusicTokenFromStorageMock.mockResolvedValue(mockStoredToken);

      const result = await getFindMusicToken();

      expect(result).toBe(mockStoredToken);
      expect(getFindMusicTokenFromStorageMock).toHaveBeenCalled();
      expect(mockCookiesGet).not.toHaveBeenCalled();
    });

    it('should exchange new token if no stored token', async () => {
      const mockJwtToken = 'new-jwt-token';
      const hasFindMusicPermissionsMock = vi.mocked(hasFindMusicPermissions);
      const getFindMusicTokenFromStorageMock = vi.mocked(getFindMusicTokenFromStorage);
      const storeFindMusicTokenMock = vi.mocked(storeFindMusicToken);

      hasFindMusicPermissionsMock.mockResolvedValue(true);
      getFindMusicTokenFromStorageMock.mockResolvedValue(null);
      mockCookiesGet.mockResolvedValue({ value: 'test-bc-token' });
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          token: mockJwtToken
        })
      } as any);

      const result = await getFindMusicToken();

      expect(result).toBe(mockJwtToken);
      expect(getFindMusicTokenFromStorageMock).toHaveBeenCalled();
      expect(mockCookiesGet).toHaveBeenCalled();
      expect(storeFindMusicTokenMock).toHaveBeenCalledWith(mockJwtToken);
    });
  });

  describe('fetchAlbumTrackState()', () => {
    it('should request the album track state with a bearer token', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ liked: [4011], played: [4011, 4012] })
      } as any);

      await fetchAlbumTrackState('123', 'mock-jwt-token');

      expect(global.fetch).toHaveBeenCalledWith('https://findmusic.club/api/track-state?album_id=123', {
        method: 'GET',
        headers: { Authorization: 'Bearer mock-jwt-token' }
      });
    });

    it('should return the liked and played track ids', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ liked: [4011], played: [4011, 4012] })
      } as any);

      const state = await fetchAlbumTrackState('123', 'mock-jwt-token');

      expect(state).toEqual({ liked: [4011], played: [4011, 4012] });
    });

    it('should fall back to empty lists when the response omits them', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({})
      } as any);

      const state = await fetchAlbumTrackState('123', 'mock-jwt-token');

      expect(state).toEqual({ liked: [], played: [] });
    });

    it('should return null when the album has no stored state', async () => {
      vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 404 } as any);

      const state = await fetchAlbumTrackState('123', 'mock-jwt-token');

      expect(state).toBeNull();
    });

    it('should return null on a network error', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('offline'));

      const state = await fetchAlbumTrackState('123', 'mock-jwt-token');

      expect(state).toBeNull();
    });
  });

  describe('postTrackPlayed()', () => {
    it('should post the track id with a bearer token', async () => {
      vi.mocked(global.fetch).mockResolvedValue({ ok: true, status: 200 } as any);

      await postTrackPlayed(4012, 'mock-jwt-token');

      expect(global.fetch).toHaveBeenCalledWith('https://findmusic.club/api/played', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-jwt-token'
        },
        body: JSON.stringify({ track_id: 4012 })
      });
    });

    it('should report that the service accepted the play', async () => {
      vi.mocked(global.fetch).mockResolvedValue({ ok: true, status: 200 } as any);

      await expect(postTrackPlayed(4012, 'mock-jwt-token')).resolves.toBe(true);
    });

    it('should report a rejected play without throwing', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'server error'
      } as any);

      await expect(postTrackPlayed(4012, 'mock-jwt-token')).resolves.toBe(false);
    });

    it('should report a network error without throwing', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('offline'));

      await expect(postTrackPlayed(4012, 'mock-jwt-token')).resolves.toBe(false);
    });
  });
});
