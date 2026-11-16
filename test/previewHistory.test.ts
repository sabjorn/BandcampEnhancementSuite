import { describe, it, expect, beforeEach, vi } from 'vitest';
import { queryPreviews } from '../src/previewHistory';

describe('hydrating preview history', () => {
  beforeEach(() => {
    globalThis.chrome = {
      runtime: {
        sendMessage: vi.fn().mockResolvedValue({})
      }
    } as any;
  });

  it('should ask for every release in one request', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ '123': true, '456': false });

    await expect(queryPreviews(['123', '456'])).resolves.toEqual({ '123': true, '456': false });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      contentScriptQuery: 'queryPreviews',
      ids: ['123', '456']
    });
  });

  it('should not go to the backend at all for an empty grid', async () => {
    await expect(queryPreviews([])).resolves.toEqual({});

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });
});
