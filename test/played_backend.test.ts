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
  fetchAlbumTrackState: vi.fn(),
  postTrackPlayed: vi.fn(),
  getFindMusicToken: vi.fn()
}));

vi.mock('../src/utilities', () => ({
  getDB: vi.fn()
}));

import { processRequest } from '../src/background/played_backend';
import { fetchAlbumTrackState, postTrackPlayed, getFindMusicToken } from '../src/clients/findmusic';
import { getDB } from '../src/utilities';

const setConfig = (config: Record<string, unknown>) => {
  vi.mocked(getDB).mockResolvedValue({ get: vi.fn().mockResolvedValue(config) } as any);
};

const send = (request: Record<string, unknown>): Promise<any> =>
  new Promise(resolve => {
    const handled = processRequest(request, {} as any, resolve);
    if (!handled) resolve('not-handled');
  });

describe('Played Backend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setConfig({ enablePlayedCaching: true });
    vi.mocked(getFindMusicToken).mockResolvedValue('mock-jwt-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should ignore messages it does not own', () => {
    expect(processRequest({ contentScriptQuery: 'renderBuffer' }, {} as any, vi.fn())).toBe(false);
  });

  describe('fetchAlbumTrackState', () => {
    it('should return the track state for the album', async () => {
      vi.mocked(fetchAlbumTrackState).mockResolvedValue({ liked: [4011], played: [4012] });

      const response = await send({ contentScriptQuery: 'fetchAlbumTrackState', albumId: '123' });

      expect(fetchAlbumTrackState).toHaveBeenCalledWith('123', 'mock-jwt-token');
      expect(response).toEqual({ liked: [4011], played: [4012] });
    });

    it('should not call FindMusic.club when played caching is disabled', async () => {
      setConfig({ enablePlayedCaching: false });

      const response = await send({ contentScriptQuery: 'fetchAlbumTrackState', albumId: '123' });

      expect(fetchAlbumTrackState).not.toHaveBeenCalled();
      expect(response).toBeNull();
    });

    it('should not call FindMusic.club without a token', async () => {
      vi.mocked(getFindMusicToken).mockResolvedValue(null);

      const response = await send({ contentScriptQuery: 'fetchAlbumTrackState', albumId: '123' });

      expect(fetchAlbumTrackState).not.toHaveBeenCalled();
      expect(response).toBeNull();
    });

    it('should respond with null when the client throws', async () => {
      vi.mocked(fetchAlbumTrackState).mockRejectedValue(new Error('boom'));

      const response = await send({ contentScriptQuery: 'fetchAlbumTrackState', albumId: '123' });

      expect(response).toBeNull();
    });
  });

  describe('postTrackPlayed', () => {
    it('should report the play to FindMusic.club', async () => {
      vi.mocked(postTrackPlayed).mockResolvedValue(true);

      const response = await send({ contentScriptQuery: 'postTrackPlayed', trackId: 4012 });

      expect(postTrackPlayed).toHaveBeenCalledWith(4012, 'mock-jwt-token');
      expect(response).toEqual({ success: true, recorded: true });
    });

    it('should say the play was not recorded when played caching is disabled', async () => {
      setConfig({ enablePlayedCaching: false });

      const response = await send({ contentScriptQuery: 'postTrackPlayed', trackId: 4012 });

      expect(postTrackPlayed).not.toHaveBeenCalled();
      expect(response).toEqual({ success: true, recorded: false });
    });

    it('should say the play was not recorded without a token', async () => {
      vi.mocked(getFindMusicToken).mockResolvedValue(null);

      const response = await send({ contentScriptQuery: 'postTrackPlayed', trackId: 4012 });

      expect(postTrackPlayed).not.toHaveBeenCalled();
      expect(response).toEqual({ success: true, recorded: false });
    });

    it('should pass on a play the service rejected', async () => {
      vi.mocked(postTrackPlayed).mockResolvedValue(false);

      const response = await send({ contentScriptQuery: 'postTrackPlayed', trackId: 4012 });

      expect(response).toEqual({ success: true, recorded: false });
    });

    it('should respond with a failure when the client throws', async () => {
      vi.mocked(postTrackPlayed).mockRejectedValue(new Error('boom'));

      const response = await send({ contentScriptQuery: 'postTrackPlayed', trackId: 4012 });

      expect(response).toEqual({ success: false, recorded: false, error: 'boom' });
    });
  });
});
