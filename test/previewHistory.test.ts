import { describe, it, expect, beforeEach, vi } from 'vitest';
import { markPreviewed, queryPreviews, setHistory } from '../src/previewHistory';

describe('marking a release previewed', () => {
  const grid = (id: string) => {
    document.body.innerHTML = `
      <li class="music-grid-item" data-item-id="album-${id}">
        <div id="${id}" class="preview">
          <div class="bes-preview-controls">
            <button class="follow-unfollow open-iframe">Preview</button>
            <button class="follow-unfollow historybox"></button>
          </div>
        </div>
      </li>
    `;

    return document.querySelector(`[id="${id}"] .historybox`) as HTMLElement;
  };

  beforeEach(() => {
    globalThis.chrome = {
      runtime: { sendMessage: vi.fn().mockResolvedValue({ id: '123', value: true }) }
    } as any;
  });

  it('should fill in the history box as soon as the write lands', async () => {
    const box = grid('123');

    await markPreviewed('123');

    expect(box.classList.contains('following')).toBe(true);
  });

  it('should leave the box alone when the write fails', async () => {
    const box = grid('123');
    vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(new Error('no backend'));

    await expect(markPreviewed('123')).rejects.toThrow('no backend');

    expect(box.classList.contains('following')).toBe(false);
  });

  it('should not care when the release has no box on this page', async () => {
    document.body.innerHTML = '';

    await expect(markPreviewed('123')).resolves.toBeUndefined();
  });
});

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
