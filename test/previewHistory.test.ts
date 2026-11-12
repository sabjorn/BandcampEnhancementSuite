import { describe, it, expect, beforeEach, vi } from 'vitest';
import { markPreviewed, togglePreview, queryPreviews } from '../src/previewHistory';

describe('preview history requests', () => {
  beforeEach(() => {
    globalThis.chrome = {
      runtime: {
        sendMessage: vi.fn().mockResolvedValue(null)
      }
    } as any;
  });

  it('should mark a release previewed', async () => {
    await markPreviewed('123');

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ contentScriptQuery: 'markPreviewed', id: '123' });
  });

  it('should return the state a toggle settled on', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ id: '123', value: true });

    await expect(togglePreview('123')).resolves.toBe(true);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ contentScriptQuery: 'togglePreview', id: '123' });
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
