import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  }
}));

vi.mock('../src/components/player', () => ({
  loadAlbum: vi.fn(async () => {})
}));

import { initAlbumPlayer } from '../src/pages/album_player';
import { loadAlbum } from '../src/components/player';
import { setPlayerRoot, inPlayer } from '../src/components/player/query';

const albumPage = (bandFollowInfo: string | null = '{"tralbum_id":123,"tralbum_type":"a"}') =>
  createDomNodes(`
    <div class="trackView leftMiddleColumns has-art">
      <div id="name-section"></div>
      <div class="middleColumn">
        <div id="tralbumArt">
          <a class="popupImage" href="https://f4.bcbits.com/img/a0000000000_10.jpg">
            <picture>
              <img src="https://f4.bcbits.com/img/a0000000000_16.jpg" />
            </picture>
          </a>
        </div>
        <div class="share-panel-wrapper-desktop"></div>
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

describe('Album page player', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    setPlayerRoot(document);
    cleanupTestNodes();
  });

  it('should replace the native player with the BES player', async () => {
    albumPage();

    await initAlbumPlayer();

    expect(document.querySelector('div.inline_player')).toBeNull();
    expect(document.querySelector('.bes-player')).toBeTruthy();
  });

  it('should keep the BES player where the native player was', async () => {
    albumPage();

    await initAlbumPlayer();

    const trackInfo = document.querySelector('#trackInfoInner') as HTMLElement;
    expect(trackInfo.querySelector('.bes-player')).toBeTruthy();
  });

  it('should remove the native tracklist', async () => {
    albumPage();

    await initAlbumPlayer();

    expect(document.querySelector('table#track_table')).toBeNull();
  });

  it('should provide the mount points the player fills', async () => {
    albumPage();

    await initAlbumPlayer();

    const container = document.querySelector('.bes-player') as HTMLElement;
    ['.bes-player-transport', '.bes-player-container', '.bes-player-right', '.bes-player-tracklist'].forEach(
      selector => expect(container.querySelector(selector)).toBeTruthy()
    );
  });

  it('should scope the player to its own container', async () => {
    albumPage();

    await initAlbumPlayer();

    expect(inPlayer('.bes-player-tracklist')).toBe(document.querySelector('.bes-player .bes-player-tracklist'));
  });

  it('should move the page album art into the player', async () => {
    albumPage();

    await initAlbumPlayer();

    const art = document.querySelector('.bes-player-art') as HTMLImageElement;
    expect(art).toBeTruthy();
    expect(art.src).toBe('https://f4.bcbits.com/img/a0000000000_16.jpg');
  });

  it('should remove the album art from the page', async () => {
    albumPage();

    await initAlbumPlayer();

    expect(document.querySelector('#tralbumArt')).toBeNull();
    expect(document.querySelectorAll('img[src*="a0000000000_16"]').length).toBe(1);
    expect(document.querySelector('.middleColumn .share-panel-wrapper-desktop')).toBeTruthy();
  });

  it('should mark the page as hosting the player so it can reclaim the art column', async () => {
    albumPage();

    await initAlbumPlayer();

    expect(document.body.classList.contains('bes-album-player-host')).toBe(true);
  });

  it('should still mount when the page has no album art', async () => {
    createDomNodes(`
      <div id="trackInfoInner">
        <div data-band-follow-info='{"tralbum_id":123,"tralbum_type":"a"}'></div>
        <div class="inline_player"></div>
      </div>
    `);

    await initAlbumPlayer();

    expect(document.querySelector('.bes-player')).toBeTruthy();
    expect(document.querySelector('.bes-player-art')?.getAttribute('src')).toBeNull();
  });

  it('should load the album named by the page', async () => {
    albumPage();

    await initAlbumPlayer(undefined, true);

    expect(loadAlbum).toHaveBeenCalledWith('123', 'a', true, undefined);
  });

  it('should do nothing on a page without a native player', async () => {
    createDomNodes('<div id="trackInfoInner"></div>');

    await initAlbumPlayer();

    expect(document.querySelector('.bes-player')).toBeNull();
    expect(loadAlbum).not.toHaveBeenCalled();
  });

  it('should leave the native player alone when the page names no album', async () => {
    albumPage(null);

    await initAlbumPlayer();

    expect(document.querySelector('div.inline_player')).toBeTruthy();
    expect(document.querySelector('table#track_table')).toBeTruthy();
    expect(loadAlbum).not.toHaveBeenCalled();
  });
});
