import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  },
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() })
}));

vi.mock('../src/components/player', async () => {
  const actual = await vi.importActual<typeof import('../src/components/player')>('../src/components/player');
  return { ...actual, loadAlbumIntoDrawer: vi.fn(async () => {}) };
});

import { initAlbumPlayer } from '../src/pages/album_player';
import { loadAlbumIntoDrawer } from '../src/components/player';

const albumPage = (bandFollowInfo: string | null = '{"tralbum_id":123,"tralbum_type":"a"}') =>
  createDomNodes(`
    <div class="trackView leftMiddleColumns has-art">
      <div class="middleColumn">
        <div id="tralbumArt">
          <a class="popupImage"><img src="https://f4.bcbits.com/img/a0000000000_16.jpg" /></a>
        </div>
      </div>
      <div id="trackInfo" class="leftColumn">
        <div id="trackInfoInner">
          ${bandFollowInfo ? `<div data-band-follow-info='${bandFollowInfo}'></div>` : ''}
          <div class="inline_player"><div class="progbar"></div></div>
          <table id="track_table"><tr class="track_row_view"></tr></table>
        </div>
      </div>
    </div>
  `);

const drawer = () => document.querySelector('.bes-player-drawer') as HTMLElement;

describe('Album page player', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    drawer()?.remove();
    document.body.className = '';
    cleanupTestNodes();
  });

  it('should remove the native player and tracklist', async () => {
    albumPage();

    await initAlbumPlayer();

    expect(document.querySelector('div.inline_player')).toBeNull();
    expect(document.querySelector('table#track_table')).toBeNull();
  });

  it('should put the drawer on the page already open', async () => {
    albumPage();

    await initAlbumPlayer();

    expect(drawer()).toBeTruthy();
    expect(drawer().classList.contains('open')).toBe(true);
  });

  it('should leave the page album art in place', async () => {
    albumPage();

    await initAlbumPlayer();

    expect(document.querySelector('#tralbumArt img')).toBeTruthy();
  });

  it('should load the album named by the page', async () => {
    albumPage();

    await initAlbumPlayer(undefined, true);

    expect(loadAlbumIntoDrawer).toHaveBeenCalledWith('123', 'a', true, undefined);
  });

  it('should offer no way to close or minimize the drawer', async () => {
    albumPage();

    await initAlbumPlayer();

    expect(drawer().querySelector('.bes-player-drawer-close')).toBeNull();
    expect(drawer().querySelector('.bes-player-drawer-minimize')).toBeNull();
    expect(drawer().querySelector('.bes-player-drawer-minimized-bar')).toBeNull();
  });

  it('should do nothing on a page without a native player', async () => {
    createDomNodes('<div id="trackInfoInner"></div>');

    await initAlbumPlayer();

    expect(drawer()).toBeNull();
    expect(loadAlbumIntoDrawer).not.toHaveBeenCalled();
  });

  it('should leave the native player alone when the page names no album', async () => {
    albumPage(null);

    await initAlbumPlayer();

    expect(document.querySelector('div.inline_player')).toBeTruthy();
    expect(document.querySelector('table#track_table')).toBeTruthy();
    expect(drawer()).toBeNull();
  });
});
