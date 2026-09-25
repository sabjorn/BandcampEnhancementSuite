import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  })
}));

const mockSendMessage = vi.fn(() => Promise.reject(new Error('Receiving end does not exist')));
const mockStorageGet = vi.fn(() => Promise.resolve({} as Record<string, string>));

(globalThis as any).chrome = {
  runtime: { sendMessage: mockSendMessage },
  storage: { local: { get: mockStorageGet, set: vi.fn(() => Promise.resolve()) } }
};

const mockReplace = vi.fn();

const setLocation = (search: string, hash: string = '') => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      origin: 'https://bandcamp.com',
      pathname: '/album/some-album',
      search,
      hash,
      replace: mockReplace
    }
  });
};

const runDocumentStart = async () => {
  vi.resetModules();
  await import('../src/document_start');
};

describe('document_start service worker warm-up', () => {
  beforeEach(() => {
    mockSendMessage.mockClear();
  });

  it('pings the service worker so it boots ahead of document_end', async () => {
    setLocation('');

    await runDocumentStart();

    expect(mockSendMessage).toHaveBeenCalledWith({ contentScriptQuery: 'warmup' });
  });

  it('survives the ping going unanswered', async () => {
    setLocation('');

    await expect(runDocumentStart()).resolves.not.toThrow();
  });
});

describe('document_start bes_cart capture', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockReplace.mockClear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('stores the bes_cart parameter and redirects to a clean URL', async () => {
    setLocation('?bes_cart=abc123');

    await runDocumentStart();

    expect(sessionStorage.getItem('bes_url_cart_param')).toBe('abc123');
    expect(mockReplace).toHaveBeenCalledWith('/album/some-album');
  });

  it('preserves other query parameters and the hash', async () => {
    setLocation('?from=embed&bes_cart=abc123&action=buy', '#track');

    await runDocumentStart();

    expect(sessionStorage.getItem('bes_url_cart_param')).toBe('abc123');
    expect(mockReplace).toHaveBeenCalledWith('/album/some-album?from=embed&action=buy#track');
  });

  it('does nothing when the parameter is absent', async () => {
    setLocation('?from=embed');

    await runDocumentStart();

    expect(sessionStorage.getItem('bes_url_cart_param')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('document_start theming', () => {
  beforeEach(() => {
    mockStorageGet.mockReset();
    mockStorageGet.mockResolvedValue({});
    document.documentElement.removeAttribute('data-bes-theme');
    document.documentElement.removeAttribute('style');
    setLocation('');
  });

  /*
   * The whole point of reading the mirror here rather than over the config port is to beat first
   * paint, so what matters is that the attribute and tokens land without waiting on the worker.
   */
  it('applies the mirrored dark theme before the page paints', async () => {
    mockStorageGet.mockResolvedValue({ besThemeName: 'dark' });

    await runDocumentStart();
    await vi.waitFor(() => expect(document.documentElement.getAttribute('data-bes-theme')).toBe('dark'));

    expect(document.documentElement.getAttribute('style')).toContain('--bes-surface-0: #121212');
  });

  it('falls back to the light theme when nothing is mirrored yet', async () => {
    await runDocumentStart();
    await vi.waitFor(() => expect(document.documentElement.getAttribute('data-bes-theme')).toBe('light'));
  });

  it('does not read the theme over the service worker port', async () => {
    mockStorageGet.mockResolvedValue({ besThemeName: 'dark' });

    await runDocumentStart();
    await vi.waitFor(() => expect(document.documentElement.getAttribute('data-bes-theme')).toBe('dark'));

    expect(mockSendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ requestConfig: {} }));
  });

  it('still warms the worker when the theme lookup fails', async () => {
    mockStorageGet.mockRejectedValue(new Error('no storage'));

    await runDocumentStart();

    expect(mockSendMessage).toHaveBeenCalledWith({ contentScriptQuery: 'warmup' });
  });
});
