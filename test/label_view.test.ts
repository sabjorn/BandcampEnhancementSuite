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

import { initLabelView, fillFrame, addFindMusicBandLink } from '../src/label_view';

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

describe('addFindMusicBandLink', () => {
  const bioContainer = `
    <div id="bio-container">
      <p id="band-name-location"><span class="title">Test Label</span></p>
    </div>
    <script type="text/javascript" data-band="{&quot;id&quot;:857243381,&quot;name&quot;:&quot;Test Label&quot;}"></script>
  `;

  beforeEach(() => {
    process.env.FINDMUSIC_BASE_URL = 'https://findmusic.club';
  });

  afterEach(() => {
    cleanupTestNodes();
  });

  it('should add a link to the band page on FindMusic.club', () => {
    createDomNodes(bioContainer);

    addFindMusicBandLink();

    const link = document.querySelector('a.bes-findmusic-band-link') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.href).toBe('https://findmusic.club/artist/857243381');
    expect(link.target).toBe('_blank');
    expect(link.previousElementSibling?.id).toBe('band-name-location');
  });

  it('should not add the link twice', () => {
    createDomNodes(bioContainer);

    addFindMusicBandLink();
    addFindMusicBandLink();

    expect(document.querySelectorAll('a.bes-findmusic-band-link').length).toBe(1);
  });

  it('should do nothing without a bio container', () => {
    createDomNodes(`<script type="text/javascript" data-band="{&quot;id&quot;:857243381}"></script>`);

    addFindMusicBandLink();

    expect(document.querySelector('a.bes-findmusic-band-link')).toBeNull();
  });

  it('should do nothing without a band id', () => {
    createDomNodes(`<div id="bio-container"></div>`);

    addFindMusicBandLink();

    expect(document.querySelector('a.bes-findmusic-band-link')).toBeNull();
  });
});

describe('initLabelView - FindMusic.club band link', () => {
  beforeEach(() => {
    process.env.FINDMUSIC_BASE_URL = 'https://findmusic.club';
  });

  afterEach(() => {
    cleanupTestNodes();
  });

  it('should add the link on a discography page', async () => {
    createDomNodes(`
      <ol class="music-grid"></ol>
      <div id="bio-container">
        <p id="band-name-location"><span class="title">Test Label</span></p>
      </div>
      <script type="text/javascript" data-band="{&quot;id&quot;:857243381}"></script>
    `);

    await initLabelView(mockPort as any);

    expect(document.querySelector('a.bes-findmusic-band-link')).toBeTruthy();
  });

  it('should not add the link without a discography grid', async () => {
    createDomNodes(`
      <div id="bio-container">
        <p id="band-name-location"><span class="title">Test Label</span></p>
      </div>
      <script type="text/javascript" data-band="{&quot;id&quot;:857243381}"></script>
    `);

    await initLabelView(mockPort as any);

    expect(document.querySelector('a.bes-findmusic-band-link')).toBeNull();
  });
});
