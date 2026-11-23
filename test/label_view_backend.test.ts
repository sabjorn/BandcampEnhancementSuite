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

import { query, toggle, setTrue, processRequest, initLabelViewBackend } from '../src/background/label_view_backend';

const respond = async (request: any) => {
  const sendResponse = vi.fn();
  const handled = processRequest(request, {} as chrome.runtime.MessageSender, sendResponse);

  if (handled) await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());

  return { handled, response: sendResponse.mock.calls[0]?.[0] };
};

describe('Label View Backend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.get.mockResolvedValue(undefined);
  });

  describe('the previews store', () => {
    it('should seed a release it has never seen with false', async () => {
      db.get.mockResolvedValue(undefined);

      await expect(query('previews', '123')).resolves.toBe(false);

      expect(db.get).toHaveBeenCalledWith('previews', '123');
      expect(db.put).toHaveBeenCalledWith('previews', false, '123');
    });

    it('should report a stored value without rewriting it', async () => {
      db.get.mockResolvedValue(true);

      await expect(query('previews', '123')).resolves.toBe(true);

      expect(db.put).not.toHaveBeenCalled();
    });

    it('should turn a previewed release off', async () => {
      db.get.mockResolvedValue(true);

      await expect(toggle('previews', '123')).resolves.toBe(false);

      expect(db.put).toHaveBeenCalledWith('previews', false, '123');
    });

    it('should turn an unpreviewed release on', async () => {
      db.get.mockResolvedValue(false);

      await expect(toggle('previews', '123')).resolves.toBe(true);

      expect(db.put).toHaveBeenCalledWith('previews', true, '123');
    });

    it('should mark a release previewed', async () => {
      await setTrue('previews', '123');

      expect(db.put).toHaveBeenCalledWith('previews', true, '123');
    });
  });

  describe('processRequest()', () => {
    it('should answer a batched query with the state of every release asked for', async () => {
      db.get.mockImplementation(async (_store: string, key: string) => key === '123');

      const { response } = await respond({ contentScriptQuery: 'queryPreviews', ids: ['123', '456'] });

      expect(response).toEqual({ '123': true, '456': false });
    });

    it('should answer a toggle with the state it settled on', async () => {
      db.get.mockResolvedValue(false);

      const { response } = await respond({ contentScriptQuery: 'togglePreview', id: '123' });

      expect(db.put).toHaveBeenCalledWith('previews', true, '123');
      expect(response).toEqual({ id: '123', value: true });
    });

    it('should write the mark before answering, so a caller that awaits it knows it landed', async () => {
      const { response } = await respond({ contentScriptQuery: 'markPreviewed', id: '123' });

      expect(db.put).toHaveBeenCalledWith('previews', true, '123');
      expect(response).toEqual({ id: '123', value: true });
    });

    it('should leave messages addressed to other backends alone', async () => {
      const sendResponse = vi.fn();

      const handled = processRequest(
        { contentScriptQuery: 'fetchCollectionSummary' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      );

      expect(handled).toBe(false);
      expect(sendResponse).not.toHaveBeenCalled();
      expect(db.get).not.toHaveBeenCalled();
    });

    it('should report a store failure to the caller rather than hanging it', async () => {
      db.put.mockRejectedValueOnce(new Error('QuotaExceededError'));

      const { response } = await respond({ contentScriptQuery: 'markPreviewed', id: '123' });

      expect(response).toEqual({ error: 'QuotaExceededError' });
    });
  });

  describe('initLabelViewBackend()', () => {
    beforeEach(() => {
      globalThis.chrome = {
        runtime: {
          onMessage: { addListener: vi.fn() },
          onInstalled: { addListener: vi.fn() },
          onConnect: { addListener: vi.fn() }
        }
      } as any;
    });

    // #302: a listener registered after an await misses the message that woke the worker.
    it('should register its message listener without yielding first', () => {
      void initLabelViewBackend();

      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(processRequest);
    });

    it('should no longer take part in the shared bes port', () => {
      void initLabelViewBackend();

      expect(chrome.runtime.onConnect.addListener).not.toHaveBeenCalled();
    });
  });
});
