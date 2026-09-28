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

(globalThis as any).chrome = {
  runtime: { sendMessage: mockSendMessage }
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

describe('document_start stays free of round trips', () => {
  beforeEach(() => {
    mockSendMessage.mockClear();
    setLocation('');
  });

  it('does not read config', async () => {
    await runDocumentStart();

    expect(mockSendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ requestConfig: expect.anything() }));
    expect((globalThis as any).chrome.runtime.connect).toBeUndefined();
  });

  it('does not theme the page', async () => {
    document.documentElement.removeAttribute('data-bes-theme');

    await runDocumentStart();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(document.documentElement.getAttribute('data-bes-theme')).toBeNull();
  });
});
