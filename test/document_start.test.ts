import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  },
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

  it('pings the service worker so it boots ahead of document_idle', async () => {
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
    mockSendMessage.mockClear();
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
