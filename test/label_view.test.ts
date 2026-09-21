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

describe('FindMusic.club links in the player drawer', () => {
  let init: typeof initLabelView;

  const discographyPage = `
    <div id="pagedata" data-blob='{"lo_querystr": "item_id=123"}'></div>
    <div class="leftMiddleColumns">
      <ol class="music-grid">
        <li class="music-grid-item" data-item-id="album-123" data-band-id="857243381">
          <span class="artist-override">Test Label</span>
        </li>
        <li class="music-grid-item" data-item-id="album-456" data-band-id="112233">
          <span class="artist-override">Guest Artist</span>
        </li>
      </ol>
    </div>
    <div id="bio-container">
      <p id="band-name-location"><span class="title">Test Label</span></p>
    </div>
    <script type="text/javascript" data-band="{&quot;id&quot;:857243381,&quot;name&quot;:&quot;Test Label&quot;}"></script>
  `;

  const grantFindMusicPermissions = (granted: boolean) => {
    (globalThis.chrome.runtime as any).sendMessage = vi.fn().mockResolvedValue({ granted });
  };

  const clickPreviewFor = (id: string) => {
    const button = document.querySelector(`li[data-item-id="album-${id}"] button.open-iframe`) as HTMLElement;
    button.click();
  };

  const links = () =>
    Array.from(document.querySelectorAll('.bes-player-drawer-header-actions a.bes-findmusic-link')).map(link => ({
      kind: link.className.includes('bes-findmusic-link-label') ? 'label' : 'artist',
      href: (link as HTMLAnchorElement).href,
      title: link.getAttribute('title')
    }));

  beforeEach(async () => {
    vi.resetModules();
    document.querySelectorAll('.bes-player-drawer').forEach(d => d.remove());
    process.env.FINDMUSIC_BASE_URL = 'https://findmusic.club';
    grantFindMusicPermissions(true);
    ({ initLabelView: init } = await import('../src/label_view'));
  });

  afterEach(() => {
    document.querySelectorAll('.bes-player-drawer').forEach(d => d.remove());
    cleanupTestNodes();
    delete (globalThis.chrome.runtime as any).sendMessage;
  });

  it('should add a label link when previewing a release by the page band', async () => {
    createDomNodes(discographyPage);
    await init(mockPort as any);

    clickPreviewFor('123');

    expect(links()).toEqual([
      {
        kind: 'label',
        href: 'https://findmusic.club/artist/857243381',
        title: 'Open Test Label on FindMusic.club'
      }
    ]);
  });

  it('should add an artist link alongside the label link for another band', async () => {
    createDomNodes(discographyPage);
    await init(mockPort as any);

    clickPreviewFor('456');

    expect(links()).toEqual([
      {
        kind: 'label',
        href: 'https://findmusic.club/artist/857243381',
        title: 'Open Test Label on FindMusic.club'
      },
      {
        kind: 'artist',
        href: 'https://findmusic.club/artist/112233',
        title: 'Open Guest Artist on FindMusic.club'
      }
    ]);
  });

  it('should swap the artist link when a different release is previewed', async () => {
    createDomNodes(discographyPage);
    await init(mockPort as any);

    clickPreviewFor('456');
    clickPreviewFor('123');

    expect(links().map(link => link.kind)).toEqual(['label']);
  });

  it('should not add links when FindMusic.club permissions are not granted', async () => {
    grantFindMusicPermissions(false);
    createDomNodes(discographyPage);
    await init(mockPort as any);

    clickPreviewFor('456');

    expect(links()).toEqual([]);
  });

  it('should not add links when the permission check fails', async () => {
    (globalThis.chrome.runtime as any).sendMessage = vi.fn().mockRejectedValue(new Error('no receiver'));
    createDomNodes(discographyPage);
    await init(mockPort as any);

    clickPreviewFor('456');

    expect(links()).toEqual([]);
  });

  it('should still add the artist link when the page has no band id', async () => {
    createDomNodes(`
      <div id="pagedata" data-blob='{"lo_querystr": "item_id=123"}'></div>
      <div class="leftMiddleColumns">
        <ol class="music-grid">
          <li class="music-grid-item" data-item-id="album-123" data-band-id="112233"></li>
        </ol>
      </div>
    `);
    await init(mockPort as any);

    clickPreviewFor('123');

    expect(links()).toEqual([
      {
        kind: 'artist',
        href: 'https://findmusic.club/artist/112233',
        title: 'Open this artist on FindMusic.club'
      }
    ]);
  });
});
