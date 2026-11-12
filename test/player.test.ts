import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes, stubCollection } from './utils';

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

import { getTralbumDetails } from '../src/bclient';

vi.mock('../src/bclient', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/bclient')>()),
  getTralbumDetails: vi.fn()
}));

let collectionStub = stubCollection();

vi.mock('../src/collection', () => ({
  initCollectionState: vi.fn(async () => collectionStub)
}));

beforeEach(() => {
  collectionStub = stubCollection();
});

import { createVolumeSlider, volumeSliderCallback, initPlayer } from '../src/player';

describe('Player', () => {
  beforeEach(() => {
    createDomNodes(`
      <audio></audio>
      <div class="progbar"></div>
      <div class="controls"></div>
      <div class="playbutton"></div>
      <div class="prevbutton"></div>
      <div class="nextbutton"></div>
      <input class="volume" type="range" min="0" max="1" step="0.01" value="0.5" />
    `);
  });

  afterEach(() => {
    cleanupTestNodes();
    vi.restoreAllMocks();
  });

  it('should initialize Player functionality', async () => {
    expect(() => initPlayer()).not.toThrow();
  });

  it('should create volume slider with correct properties', () => {
    const volumeSlider = createVolumeSlider();
    expect(volumeSlider.type).toBe('range');
    expect(volumeSlider.min).toBe('0');
    expect(volumeSlider.max).toBe('1');
    expect(volumeSlider.step).toBe('0.01');
    expect(volumeSlider.title).toBe('volume control');
    expect(volumeSlider.classList.contains('volume')).toBe(true);
  });

  it('should handle volume slider changes', () => {
    const audioElement = document.querySelector('audio') as HTMLAudioElement;
    const mockVolumeEvent = {
      target: { value: '0.8' }
    } as any;

    expect(() => volumeSliderCallback(mockVolumeEvent)).not.toThrow();
    expect(audioElement.volume).toBe(0.8);
  });
});

describe('Player - wishlist stars on the album page track rows', () => {
  const tracks = [
    {
      track_id: 1001,
      band_id: 857243381,
      title: 'Track 1',
      price: 1,
      currency: 'USD',
      is_purchasable: true,
      track_url: 'https://label.bandcamp.com/track/track-1'
    },
    {
      track_id: 1002,
      band_id: 857243381,
      title: 'Track 2',
      price: 1,
      currency: 'USD',
      is_purchasable: true,
      track_url: 'https://label.bandcamp.com/track/track-2'
    }
  ];

  const renderPage = (dataBlob: Record<string, unknown> = {}) =>
    createDomNodes(`
      <div id="pagedata" data-blob='${JSON.stringify(dataBlob)}'></div>
      <div data-band-follow-info='{"tralbum_id":1609998585,"tralbum_type":"a"}'></div>
      <div class="inline_player"></div>
      <table id="track_table">
        <tr class="track_row_view">
          <td class="info-col"></td>
          <td class="download-col"><div class="dl_link"><a href="/track/x?action=download">buy track</a></div></td>
        </tr>
        <tr class="track_row_view">
          <td class="info-col"></td>
          <td class="download-col"><div class="dl_link"><a href="/track/x?action=download">buy track</a></div></td>
        </tr>
      </table>
      <ul class="tralbumCommands">
        <li class="buyItem digital"><h3 class="hd"></h3></li>
        <li class="buyItem package"><h3 class="hd"></h3></li>
      </ul>
    `);

  const stars = () => Array.from(document.querySelectorAll<HTMLElement>('.track_row_view .bes-wishlist-button'));

  const markNativeOwned = () =>
    document
      .querySelector('ul.tralbumCommands li.buyItem.digital h3.hd')
      ?.insertAdjacentHTML('afterbegin', '<span class="buyItemPackageTitle you-own-this">Digital Album</span>');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTralbumDetails).mockResolvedValue({
      id: 1609998585,
      type: 'a',
      title: 'Vielen Dank',
      tralbum_artist: 'Dataist',
      currency: 'USD',
      price: 10,
      is_purchasable: true,
      bandcamp_url: 'https://label.bandcamp.com/album/vielen-dank',
      tracks
    } as any);
  });

  afterEach(() => {
    cleanupTestNodes();
    vi.restoreAllMocks();
  });

  it('should read the collection before decorating the rows', async () => {
    renderPage();

    await initPlayer();

    expect(collectionStub.isWishlisted).toHaveBeenCalled();
  });

  it('should put a star in each track row, wired to that track', async () => {
    renderPage();

    await initPlayer();

    expect(stars().map(star => star.dataset.wishlistId)).toEqual(['1001', '1002']);
    stars().forEach(star => expect(star.dataset.wishlistType).toBe('t'));
  });

  it('should show the star filled for a track that is already wishlisted', async () => {
    collectionStub.isWishlisted.mockImplementation((_type, id) => id === 1002);
    renderPage();

    await initPlayer();

    expect(stars().map(star => star.dataset.wishlistState)).toEqual(['out', 'in']);
  });

  it('should mark every track owned on a release the page reports as purchased', async () => {
    renderPage({ fan_tralbum_data: { is_purchased: true, part_of_purchased_album: false } });

    await initPlayer();

    expect(document.querySelectorAll('.track_row_view .bes-owned-indicator').length).toBe(2);
    expect(stars().length).toBe(0);
  });

  it('should mark every track owned when the page reports part of a purchased album', async () => {
    renderPage({ fan_tralbum_data: { is_purchased: false, part_of_purchased_album: true } });

    await initPlayer();

    expect(document.querySelectorAll('.track_row_view .bes-owned-indicator').length).toBe(2);
  });

  it('should clear every buy affordance on a release the page reports as purchased', async () => {
    renderPage({ fan_tralbum_data: { is_purchased: true, part_of_purchased_album: false } });
    markNativeOwned();

    await initPlayer();

    expect(document.querySelectorAll('.track_row_view .one-click-button').length).toBe(0);
    expect(document.querySelectorAll('.track_row_view .dl_link').length).toBe(0);
    expect(document.querySelector('ul.tralbumCommands .one-click-button')).toBeNull();
  });

  it("should keep Bandcamp's own owned marker instead of removing the buy item it lives in", async () => {
    renderPage({ fan_tralbum_data: { is_purchased: true, part_of_purchased_album: false } });
    markNativeOwned();

    await initPlayer();

    expect(document.querySelector('ul.tralbumCommands li.buyItem.digital .you-own-this')).toBeTruthy();
  });

  // tralbum_lookup carries the album entry, not one per track, so an owned album's tracks are
  // owned through the album rather than on their own.
  it('should mark the tracks of an owned album owned rather than offering a star', async () => {
    collectionStub.isOwned.mockImplementation(type => type === 'a');
    renderPage();

    await initPlayer();

    expect(document.querySelectorAll('.track_row_view .bes-wishlist-button').length).toBe(0);
    expect(document.querySelectorAll('.track_row_view .bes-owned-indicator').length).toBe(2);
  });

  it("should strip Bandcamp's own buy track links from an owned album's rows", async () => {
    collectionStub.isOwned.mockImplementation(type => type === 'a');
    renderPage();

    await initPlayer();

    expect(document.querySelectorAll('.track_row_view .dl_link').length).toBe(0);
    expect(document.querySelectorAll('.track_row_view .one-click-button').length).toBe(0);
  });

  it("should strip Bandcamp's own buy track link from an owned track's row", async () => {
    collectionStub.isOwned.mockImplementation((type, id) => type === 't' && id === 1001);
    renderPage();

    await initPlayer();

    expect(document.querySelectorAll('.track_row_view .dl_link').length).toBe(0);
    expect(document.querySelectorAll('.track_row_view .one-click-button').length).toBe(1);
  });

  it('should keep the rows aligned when only one track is owned', async () => {
    collectionStub.isOwned.mockImplementation((type, id) => type === 't' && id === 1001);
    renderPage();

    await initPlayer();

    const rows = Array.from(document.querySelectorAll('.track_row_view'));
    const shapes = rows.map(row => Array.from(row.children).map(cell => cell.className));

    expect(shapes[0]).toEqual(shapes[1]);
  });

  it('should not offer a one click buy for an owned track', async () => {
    collectionStub.isOwned.mockReturnValue(true);
    renderPage();

    await initPlayer();

    expect(document.querySelectorAll('.track_row_view .one-click-button').length).toBe(0);
  });

  it('should not offer a one click buy for an owned album', async () => {
    collectionStub.isOwned.mockImplementation(type => type === 'a');
    renderPage();

    await initPlayer();

    expect(document.querySelector('ul.tralbumCommands .one-click-button')).toBeNull();
  });

  it("should remove Bandcamp's digital buy item for an owned album", async () => {
    collectionStub.isOwned.mockImplementation(type => type === 'a');
    renderPage();

    await initPlayer();

    expect(document.querySelector('ul.tralbumCommands li.buyItem.digital')).toBeNull();
    expect(document.querySelector('ul.tralbumCommands li.buyItem.package')).toBeTruthy();
  });

  it("should keep Bandcamp's digital buy item for an album the fan does not own", async () => {
    renderPage();

    await initPlayer();

    expect(document.querySelector('ul.tralbumCommands li.buyItem.digital')).toBeTruthy();
  });

  it('should leave the rows bare when the wishlist is unavailable', async () => {
    collectionStub.isAvailable.mockReturnValue(false);
    renderPage();

    await initPlayer();

    expect(stars().length).toBe(0);
  });

  it('should keep the star when the buy button replaces the download column', async () => {
    renderPage();

    await initPlayer();

    document.querySelectorAll('.track_row_view').forEach(row => {
      expect(row.querySelector('.bes-wishlist-button')).toBeTruthy();
    });
  });

  it('should sit to the left of the one click buy button', async () => {
    renderPage();

    await initPlayer();

    document.querySelectorAll('.track_row_view').forEach(row => {
      const cells = Array.from(row.children).map(cell => cell.className);

      expect(cells).toEqual(['bes-wishlist-col', 'download-col']);
      expect(row.querySelector('.download-col .one-click-button')).toBeTruthy();
    });
  });

  it('should still place the star when a row has no download column to sit beside', async () => {
    createDomNodes(`
      <div id="pagedata" data-blob='{}'></div>
      <div data-band-follow-info='{"tralbum_id":1609998585,"tralbum_type":"a"}'></div>
      <div class="inline_player"></div>
      <table id="track_table">
        <tr class="track_row_view"><td class="info-col"></td></tr>
      </table>
    `);

    await initPlayer();

    expect(document.querySelector('.track_row_view .bes-wishlist-button')).toBeTruthy();
  });
});
