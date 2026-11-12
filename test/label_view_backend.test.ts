import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  }
}));

const db = { get: vi.fn(), put: vi.fn() };

vi.mock('../src/utilities', () => ({
  getDB: vi.fn(async () => db)
}));

import { query, toggle, setTrue, initLabelViewBackend } from '../src/background/label_view_backend';

const mockPort = { postMessage: vi.fn() } as unknown as chrome.runtime.Port;

describe('Label View Backend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('query()', () => {
    it('should seed a release it has never seen with false', async () => {
      db.get.mockResolvedValue(undefined);

      await query('previews', '123', mockPort);

      expect(db.get).toHaveBeenCalledWith('previews', '123');
      expect(db.put).toHaveBeenCalledWith('previews', false, '123');
      expect(mockPort.postMessage).toHaveBeenCalledWith({ id: { key: '123', value: false } });
    });

    it('should report a stored value without rewriting it', async () => {
      db.get.mockResolvedValue(true);

      await query('previews', '123', mockPort);

      expect(db.put).not.toHaveBeenCalled();
      expect(mockPort.postMessage).toHaveBeenCalledWith({ id: { key: '123', value: true } });
    });
  });

  describe('toggle()', () => {
    it('should turn a previewed release off', async () => {
      db.get.mockResolvedValue(true);

      await toggle('previews', '123', mockPort);

      expect(db.put).toHaveBeenCalledWith('previews', false, '123');
      expect(mockPort.postMessage).toHaveBeenCalledWith({ id: { key: '123', value: false } });
    });

    it('should turn an unpreviewed release on', async () => {
      db.get.mockResolvedValue(false);

      await toggle('previews', '123', mockPort);

      expect(db.put).toHaveBeenCalledWith('previews', true, '123');
      expect(mockPort.postMessage).toHaveBeenCalledWith({ id: { key: '123', value: true } });
    });
  });

  describe('setTrue()', () => {
    it('should mark the release previewed and report it back', async () => {
      await setTrue('previews', '123', mockPort);

      expect(db.put).toHaveBeenCalledWith('previews', true, '123');
      expect(mockPort.postMessage).toHaveBeenCalledWith({ id: { key: '123', value: true } });
    });
  });

  describe('initLabelViewBackend()', () => {
    const connectListeners: ((port: chrome.runtime.Port) => void)[] = [];

    beforeEach(() => {
      connectListeners.length = 0;
      globalThis.chrome = {
        runtime: {
          onConnect: { addListener: vi.fn(listener => connectListeners.push(listener)) },
          onInstalled: { addListener: vi.fn() }
        }
      } as any;
    });

    // #302: a listener registered after an await misses the port that woke the worker.
    it('should register its listeners without yielding first', () => {
      void initLabelViewBackend();

      expect(chrome.runtime.onConnect.addListener).toHaveBeenCalled();
      expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
    });

    it('should write a release the content script reports as previewed', async () => {
      void initLabelViewBackend();

      const messageListeners: ((msg: any) => void)[] = [];
      connectListeners[0]({
        name: 'bes',
        postMessage: vi.fn(),
        onMessage: { addListener: (listener: (msg: any) => void) => messageListeners.push(listener) }
      } as unknown as chrome.runtime.Port);

      messageListeners[0]({ setTrue: '123' });
      await vi.waitFor(() => expect(db.put).toHaveBeenCalledWith('previews', true, '123'));
    });
  });
});
