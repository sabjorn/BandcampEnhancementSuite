import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendRequest } from '../src/messaging';

describe('sendRequest()', () => {
  beforeEach(() => {
    globalThis.chrome = {
      runtime: {
        sendMessage: vi.fn()
      }
    } as any;
  });

  it('should hand the message to the backend and return its response', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ '123': true });

    const response = await sendRequest<Record<string, boolean>>({ contentScriptQuery: 'queryPreviews', ids: ['123'] });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ contentScriptQuery: 'queryPreviews', ids: ['123'] });
    expect(response).toEqual({ '123': true });
  });

  it('should pass a null response through, which backends use to mean "nothing to report"', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(null);

    await expect(sendRequest({ contentScriptQuery: 'markPreviewed', id: '123' })).resolves.toBeNull();
  });

  // undefined comes back when no listener claimed the message, which is otherwise silent.
  it('should throw when no backend handled the message', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined);

    await expect(sendRequest({ contentScriptQuery: 'markPreviewed', id: '123' })).rejects.toThrow(/markPreviewed/);
  });

  it('should let a transport failure reach the caller', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(new Error('Could not establish connection'));

    await expect(sendRequest({ contentScriptQuery: 'markPreviewed', id: '123' })).rejects.toThrow(
      'Could not establish connection'
    );
  });
});
