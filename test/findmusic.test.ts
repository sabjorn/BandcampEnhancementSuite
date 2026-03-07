import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  }
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

import { exchangeBandcampToken } from '../src/clients/findmusic';

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
});
