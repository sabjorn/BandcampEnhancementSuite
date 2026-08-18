import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }))
}));

import { initLabelView, fillFrame } from '../src/label_view';

const mockPort = {
  postMessage: vi.fn(),
  onMessage: {
    addListener: vi.fn()
  }
};

describe('LabelView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestNodes();
    vi.restoreAllMocks();
  });

  describe('init()', () => {
    beforeEach(() => {
      createDomNodes(`
        <div id="pagedata" data-blob='{"lo_querystr": "item_id=123"}'></div>
        <div class="label-container">
          <div class="label-item">Test Label</div>
        </div>
      `);
    });

    it('should initialize label view functionality', async () => {
      await expect(initLabelView(mockPort as any)).resolves.not.toThrow();
    });
  });

  describe('label operations', () => {
    beforeEach(() => {
      createDomNodes(`
        <div class="music-grid">
          <div class="music-grid-item">
            <div class="art">Album Art</div>
            <div class="itemurl">Album URL</div>
          </div>
        </div>
      `);
    });

    it('should handle label view items', () => {
      const musicGrid = document.querySelector('.music-grid');
      expect(musicGrid).toBeTruthy();
      expect(musicGrid?.querySelector('.music-grid-item')).toBeTruthy();
    });
  });
});

describe('fillFrame - clicking preview for the album already in the drawer', () => {
  let fill: typeof fillFrame;

  const clickPreviewFor = (id: string, previewState: { previewOpen: boolean; previewId?: string }) => {
    const button = document.querySelector(`[id="${id}"] button.open-iframe`) as HTMLElement;
    fill({ target: button } as unknown as Event, previewState, false);
  };

  const drawer = () => document.querySelector('.bes-player-drawer') as HTMLElement;

  beforeEach(async () => {
    vi.resetModules();
    document.querySelectorAll('.bes-player-drawer').forEach(d => d.remove());
    ({ fillFrame: fill } = await import('../src/label_view'));
    createDomNodes(`
      <div id="123" class="preview">
        <button class="open-iframe">Preview</button>
        <div class="preview-frame" id="album-123"></div>
      </div>
      <div id="456" class="preview">
        <button class="open-iframe">Preview</button>
        <div class="preview-frame" id="album-456"></div>
      </div>
    `);
  });

  afterEach(() => {
    document.querySelectorAll('.bes-player-drawer').forEach(d => d.remove());
    cleanupTestNodes();
  });

  it('should minimize rather than close the drawer', () => {
    const previewState = { previewOpen: false, previewId: undefined as string | undefined };

    clickPreviewFor('123', previewState);
    expect(drawer().classList.contains('open')).toBe(true);

    clickPreviewFor('123', previewState);

    expect(drawer().classList.contains('minimized')).toBe(true);
    expect(drawer().classList.contains('open')).toBe(true);
  });

  it('should restore the drawer when clicking the same preview again', () => {
    const previewState = { previewOpen: false, previewId: undefined as string | undefined };

    clickPreviewFor('123', previewState);
    clickPreviewFor('123', previewState);
    expect(drawer().classList.contains('minimized')).toBe(true);

    clickPreviewFor('123', previewState);

    expect(drawer().classList.contains('minimized')).toBe(false);
    expect(drawer().classList.contains('open')).toBe(true);
  });

  it('should not pause playback when minimizing via the preview button', () => {
    const audio = document.createElement('audio');
    Object.defineProperty(audio, 'paused', { value: false, writable: true });
    const pauseSpy = vi.spyOn(audio, 'pause');
    document.body.appendChild(audio);

    const previewState = { previewOpen: false, previewId: undefined as string | undefined };
    clickPreviewFor('123', previewState);
    clickPreviewFor('123', previewState);

    expect(pauseSpy).not.toHaveBeenCalled();
    audio.remove();
  });

  it('should restore a minimized drawer when a different album is previewed', () => {
    const previewState = { previewOpen: false, previewId: undefined as string | undefined };

    clickPreviewFor('123', previewState);
    clickPreviewFor('123', previewState);
    expect(drawer().classList.contains('minimized')).toBe(true);

    clickPreviewFor('456', previewState);

    expect(drawer().classList.contains('minimized')).toBe(false);
    expect(previewState.previewId).toBe('456');
  });
});
