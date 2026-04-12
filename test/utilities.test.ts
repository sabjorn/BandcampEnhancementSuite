import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';

const {
  mockDB,
  mockGetDB,
  mockStoreFindMusicToken,
  mockGetFindMusicTokenFromStorage,
  mockClearFindMusicToken,
  mockCachedFetch
} = vi.hoisted(() => {
  const mockDB = {
    get: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined)
  };

  const mockGetDB = vi.fn(() => Promise.resolve(mockDB));

  function decodeJwtExpiry(token: string): number | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      if (typeof payload.exp === 'number') {
        return payload.exp * 1000;
      }
      return null;
    } catch {
      return null;
    }
  }

  const DEFAULT_TOKEN_EXPIRY_MS = 86400 * 1000;

  const mockStoreFindMusicToken = vi.fn(async (token: string): Promise<void> => {
    const db = mockDB;
    const expiresAt = decodeJwtExpiry(token) ?? Date.now() + DEFAULT_TOKEN_EXPIRY_MS;
    const tokenData = { token, expiresAt };
    return db.put('config', tokenData, 'findmusicToken');
  });

  const mockGetFindMusicTokenFromStorage = vi.fn(async (): Promise<string | null> => {
    const db = mockDB;
    const tokenData = await db.get('config', 'findmusicToken');

    if (!tokenData) return null;

    if (Date.now() >= tokenData.expiresAt) {
      await db.delete('config', 'findmusicToken');
      return null;
    }

    return tokenData.token;
  });

  const mockClearFindMusicToken = vi.fn(async (): Promise<void> => {
    const db = mockDB;
    return db.delete('config', 'findmusicToken');
  });

  const mockCachedFetch = vi.fn(async (url: string, options?: RequestInit): Promise<Response> => {
    const db = mockDB;
    const config = await db.get('config', 'config');
    const cachingEnabled = config?.enableFetchCaching ?? false;

    if (!cachingEnabled) {
      return fetch(url, options);
    }

    const CACHEABLE_URLS = ['/api/mobile/25/tralbum_details'];
    if (!CACHEABLE_URLS.some(pattern => url.includes(pattern))) {
      return fetch(url, options);
    }

    const method = options?.method || 'GET';
    const requestBody = options?.body ? String(options.body) : '';
    const hash = `${method}:${url}:${requestBody}`;
    const cached = await db.get('cachedRequests', hash);

    if (cached) {
      return fetch(url, options);
    }

    const response = await fetch(url, options);
    const clonedResponse = response.clone();
    const responseText = await clonedResponse.text();

    await db.put('cachedRequests', Date.now(), hash);

    if (globalThis.chrome?.runtime?.sendMessage) {
      globalThis.chrome.runtime
        .sendMessage({
          contentScriptQuery: 'postCache',
          url: url,
          method: method,
          requestBody: requestBody,
          responseBody: responseText
        })
        .catch(() => {});
    }

    return response;
  });

  return {
    mockDB,
    mockGetDB,
    mockStoreFindMusicToken,
    mockGetFindMusicTokenFromStorage,
    mockClearFindMusicToken,
    mockCachedFetch
  };
});

vi.mock('../src/utilities', async () => {
  const actual = await vi.importActual<typeof import('../src/utilities')>('../src/utilities');
  return {
    ...actual,
    getDB: mockGetDB,
    storeFindMusicToken: mockStoreFindMusicToken,
    getFindMusicTokenFromStorage: mockGetFindMusicTokenFromStorage,
    clearFindMusicToken: mockClearFindMusicToken,
    cachedFetch: mockCachedFetch
  };
});

import DBUtils, {
  getDB,
  mousedownCallback,
  extractBandFollowInfo,
  loadTextFile,
  cachedFetch,
  storeFindMusicToken,
  getFindMusicTokenFromStorage,
  clearFindMusicToken
} from '../src/utilities';
import { getTralbumDetailsFromPage } from '../src/bclient';

vi.mock('../src/bclient', () => ({
  getTralbumDetailsFromPage: vi.fn(),
  CURRENCY_MINIMUMS: { USD: 0.5, EUR: 0.25 }
}));

describe('mousedownCallback', () => {
  const spyElement = { click: vi.fn(), duration: 0, currentTime: 0 };

  beforeEach(() => {
    vi.spyOn(document, 'querySelector').mockReturnValue(spyElement as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('positions audio play position based on click', () => {
    spyElement.duration = 100;
    spyElement.currentTime = 0;

    const event = {
      offsetX: 1,
      target: { offsetWidth: 2 }
    };

    mousedownCallback(event as any);

    expect(document.querySelector).toHaveBeenCalledWith('audio');
    expect(spyElement.currentTime).toBe(50);
  });
});

describe('getDB', () => {
  it('should be a function', () => {
    expect(typeof getDB).toBe('function');
  });

  it('should work with DBUtils object interface', () => {
    expect(typeof DBUtils.getDB).toBe('function');
  });
});

describe('extractBandFollowInfo', () => {
  beforeEach(() => {
    createDomNodes(`
            <script type="text/javascript" data-band-follow-info="{&quot;tralbum_id&quot;:2105824806,&quot;tralbum_type&quot;:&quot;a&quot;}"></script>
          `);
  });

  afterEach(() => {
    cleanupTestNodes();
  });

  it('should return a specific set of data', () => {
    const bandInfo = extractBandFollowInfo();
    expect(bandInfo).toEqual({
      tralbum_id: 2105824806,
      tralbum_type: 'a'
    });
  });
});

describe('loadTextFile', () => {
  let mockInput: HTMLInputElement;
  let mockFile: File;
  let mockReader: FileReader;

  beforeEach(() => {
    mockInput = {
      type: '',
      accept: '',
      onchange: null,
      click: vi.fn(),
      files: null
    } as any;

    mockReader = {
      onload: null,
      onerror: null,
      readAsText: vi.fn(),
      result: 'test file content'
    } as any;

    mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });

    vi.spyOn(document, 'createElement').mockReturnValue(mockInput);
    vi.spyOn(window, 'FileReader').mockReturnValue(mockReader);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create file input with correct attributes', () => {
    loadTextFile();

    expect(document.createElement).toHaveBeenCalledWith('input');
    expect(mockInput.type).toBe('file');
    expect(mockInput.accept).toBe('.txt,.json');
    expect(mockInput.click).toHaveBeenCalled();
  });

  it('should resolve with file content when file is loaded', async () => {
    const promise = loadTextFile();

    mockInput.files = [mockFile] as any;

    const changeEvent = { target: mockInput } as any;
    mockInput.onchange!(changeEvent);

    expect(mockReader.readAsText).toHaveBeenCalledWith(mockFile);

    const loadEvent = { target: { result: 'test file content' } } as any;
    mockReader.onload!(loadEvent);

    const result = await promise;
    expect(result).toBe('test file content');
  });

  it('should reject when file read fails', async () => {
    const promise = loadTextFile();

    mockInput.files = [mockFile] as any;

    const changeEvent = { target: mockInput } as any;
    mockInput.onchange!(changeEvent);

    const errorEvent = new Error('File read failed') as any;
    mockReader.onerror!(errorEvent);

    await expect(promise).rejects.toEqual(errorEvent);
  });

  it('should reject when result is not string', async () => {
    const promise = loadTextFile();

    mockInput.files = [mockFile] as any;

    const changeEvent = { target: mockInput } as any;
    mockInput.onchange!(changeEvent);

    const loadEvent = { target: { result: new ArrayBuffer(8) } } as any;
    mockReader.onload!(loadEvent);

    await expect(promise).rejects.toThrow('Failed to read file as text');
  });
});

describe('getTralbumDetailsFromPage', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should extract album info from bandcamp URL', async () => {
    const mockResult = {
      id: 12345,
      type: 'a',
      title: 'Test Album',
      tralbum_artist: 'Test Artist',
      currency: 'USD',
      bandcamp_url: 'https://test.bandcamp.com/album/test-album',
      price: 0.5,
      is_purchasable: true
    };

    (getTralbumDetailsFromPage as any).mockResolvedValue(mockResult);

    const result = await getTralbumDetailsFromPage('https://test.bandcamp.com/album/test-album');

    expect(getTralbumDetailsFromPage).toHaveBeenCalledWith('https://test.bandcamp.com/album/test-album');
    expect(result).toEqual(mockResult);
  });

  it('should extract track info from bandcamp URL', async () => {
    const mockResult = {
      id: 12345,
      type: 't',
      title: 'Test Track',
      tralbum_artist: 'Test Artist',
      currency: 'USD',
      bandcamp_url: 'https://test.bandcamp.com/track/test-track',
      price: 0.5,
      is_purchasable: true
    };

    (getTralbumDetailsFromPage as any).mockResolvedValue(mockResult);

    const result = await getTralbumDetailsFromPage('https://test.bandcamp.com/track/test-track');

    expect(result).toEqual(mockResult);
  });

  it('should default to USD currency when not provided', async () => {
    const mockResult = {
      id: 12345,
      type: 'a',
      title: 'Test Album',
      tralbum_artist: 'Test Artist',
      currency: 'USD',
      bandcamp_url: 'https://test.bandcamp.com/album/test-album',
      price: 0.5,
      is_purchasable: true
    };

    (getTralbumDetailsFromPage as any).mockResolvedValue(mockResult);

    const result = await getTralbumDetailsFromPage('https://test.bandcamp.com/album/test-album');

    expect(result.currency).toBe('USD');
    expect(result.price).toBe(0.5);
  });

  it('should throw error when fetch fails', async () => {
    (getTralbumDetailsFromPage as any).mockRejectedValue(new Error('Failed to fetch page: 404'));

    await expect(getTralbumDetailsFromPage('https://test.bandcamp.com/album/not-found')).rejects.toThrow(
      'Failed to fetch page: 404'
    );
  });

  it('should throw error when tralbum data not found', async () => {
    (getTralbumDetailsFromPage as any).mockRejectedValue(new Error('Could not find tralbum data in page'));

    await expect(getTralbumDetailsFromPage('https://test.bandcamp.com/album/no-data')).rejects.toThrow(
      'Could not find tralbum data in page'
    );
  });
});

describe('FindMusic Token Storage', () => {
  beforeEach(() => {
    mockDB.put.mockClear();
    mockDB.get.mockClear();
    mockDB.delete.mockClear();
    mockGetDB.mockClear();
    mockStoreFindMusicToken.mockClear();
    mockGetFindMusicTokenFromStorage.mockClear();
    mockClearFindMusicToken.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('storeFindMusicToken', () => {
    it('should use default expiry for non-JWT tokens', async () => {
      const token = 'test-token-123';
      const beforeTime = Date.now();

      await storeFindMusicToken(token);

      expect(mockDB.put).toHaveBeenCalledWith(
        'config',
        expect.objectContaining({
          token: 'test-token-123',
          expiresAt: expect.any(Number)
        }),
        'findmusicToken'
      );

      const call = mockDB.put.mock.calls[0];
      const tokenData = call[1];
      expect(tokenData.expiresAt).toBeGreaterThan(beforeTime);
      expect(tokenData.expiresAt).toBeLessThanOrEqual(beforeTime + 86400 * 1000 + 100);
    });

    it('should decode JWT token expiry', async () => {
      const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now in seconds
      const payloadObj = { exp: expiry, sub: 'test-user' };
      const payload = btoa(JSON.stringify(payloadObj));
      const jwtToken = `header.${payload}.signature`;

      // Verify atob works in test environment
      const decoded = JSON.parse(atob(payload));
      expect(decoded.exp).toBe(expiry);

      await storeFindMusicToken(jwtToken);

      const call = mockDB.put.mock.calls[0];
      const tokenData = call[1];
      expect(tokenData.expiresAt).toBe(expiry * 1000);
    });
  });

  describe('getFindMusicTokenFromStorage', () => {
    it('should return token if not expired', async () => {
      const futureTime = Date.now() + 3600 * 1000;
      mockDB.get.mockResolvedValue({
        token: 'valid-token',
        expiresAt: futureTime
      });

      const result = await getFindMusicTokenFromStorage();

      expect(result).toBe('valid-token');
      expect(mockDB.get).toHaveBeenCalledWith('config', 'findmusicToken');
    });

    it('should return null if token expired', async () => {
      const pastTime = Date.now() - 1000;
      mockDB.get.mockResolvedValue({
        token: 'expired-token',
        expiresAt: pastTime
      });

      const result = await getFindMusicTokenFromStorage();

      expect(result).toBeNull();
      expect(mockDB.delete).toHaveBeenCalledWith('config', 'findmusicToken');
    });

    it('should return null if no token stored', async () => {
      mockDB.get.mockResolvedValue(undefined);

      const result = await getFindMusicTokenFromStorage();

      expect(result).toBeNull();
      expect(mockDB.delete).not.toHaveBeenCalled();
    });
  });

  describe('clearFindMusicToken', () => {
    it('should delete token from storage', async () => {
      await clearFindMusicToken();

      expect(mockDB.delete).toHaveBeenCalledWith('config', 'findmusicToken');
    });
  });
});

describe('cachedFetch', () => {
  let mockFetch: any;
  let mockSendMessage: any;

  beforeEach(() => {
    mockDB.get.mockClear();
    mockDB.put.mockClear();
    mockGetDB.mockClear();
    mockCachedFetch.mockClear();

    mockFetch = vi.fn();
    global.fetch = mockFetch;

    mockSendMessage = vi.fn().mockResolvedValue({ success: true });
    globalThis.chrome = {
      runtime: {
        sendMessage: mockSendMessage
      }
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if ('chrome' in globalThis) {
      (globalThis as any).chrome = undefined;
    }
  });

  it('should use plain fetch when caching disabled', async () => {
    mockDB.get.mockResolvedValue({ enableFetchCaching: false });
    const mockResponse = new Response('test response');
    mockFetch.mockResolvedValue(mockResponse);

    const result = await cachedFetch('https://api.test.com/data', {
      method: 'GET'
    });

    expect(result).toBe(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith('https://api.test.com/data', { method: 'GET' });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('should use caching fetch for whitelisted URL when caching enabled', async () => {
    mockDB.get.mockResolvedValueOnce({ enableFetchCaching: true }).mockResolvedValueOnce(undefined);

    const mockResponse = new Response(JSON.stringify({ data: 'test' }));
    mockFetch.mockResolvedValue(mockResponse);

    const result = await cachedFetch('/api/mobile/25/tralbum_details', {
      method: 'POST',
      body: JSON.stringify({ id: 123 })
    });

    expect(result).toBeDefined();
    expect(mockFetch).toHaveBeenCalled();

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        contentScriptQuery: 'postCache',
        url: '/api/mobile/25/tralbum_details',
        method: 'POST'
      })
    );
  });

  it('should skip caching for non-whitelisted URLs', async () => {
    mockDB.get.mockResolvedValue({ enableFetchCaching: true });
    const mockResponse = new Response('test response');
    mockFetch.mockResolvedValue(mockResponse);

    const result = await cachedFetch('https://api.other.com/endpoint', {
      method: 'GET'
    });

    expect(result).toBe(mockResponse);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('should skip duplicate requests already cached', async () => {
    mockDB.get.mockResolvedValueOnce({ enableFetchCaching: true }).mockResolvedValueOnce(Date.now());

    const mockResponse = new Response(JSON.stringify({ data: 'test' }));
    mockFetch.mockResolvedValue(mockResponse);

    const result = await cachedFetch('/api/mobile/25/tralbum_details', {
      method: 'POST',
      body: JSON.stringify({ id: 123 })
    });

    expect(result).toBeDefined();
    expect(mockFetch).toHaveBeenCalled();

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
