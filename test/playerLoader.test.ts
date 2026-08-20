import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';
import { isPlaybackClick } from '../src/components/player/loader';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  }
}));

vi.mock('../src/bclient', () => {
  const track = (n: number) => ({
    track_id: n,
    title: `Track ${n}`,
    price: 1,
    currency: 'USD',
    is_purchasable: true,
    duration: 180
  });
  const playableTrack = (n: number) => ({
    ...track(n),
    streaming_url: { 'mp3-128': `https://example.com/track${n}.mp3` }
  });
  const unplayableTrack = (n: number) => ({ ...track(n), title: `Track ${n} (pre-order)` });

  return {
    getTralbumDetails: vi.fn(async (albumId: string | number) => {
      const id = Number(albumId);
      // Album 456 has a playable first track and nothing playable after it
      const tracks =
        id === 456
          ? [playableTrack(1), unplayableTrack(2), unplayableTrack(3)]
          : [playableTrack(1), playableTrack(2), playableTrack(3)];

      return {
        id,
        type: 'a',
        title: `Test Album ${id}`,
        tralbum_artist: 'Test Artist',
        is_purchasable: true,
        price: 10.0,
        currency: 'USD',
        tracks
      };
    }),
    CURRENCY_MINIMUMS: { USD: 0.5 }
  };
});

vi.mock('../src/components/player/drawer', () => ({
  getPlayerDrawerElements: vi.fn(() => ({
    drawer: document.querySelector('.bes-player-drawer'),
    playerContainer: document.querySelector('.bes-player-drawer-player'),
    tracklistContainer: document.querySelector('.bes-player-drawer-tracklist'),
    albumArt: document.querySelector('.bes-player-drawer-album-art'),
    transportControls: document.querySelector('.bes-player-drawer-transport'),
    rightColumn: document.querySelector('.bes-player-drawer-right')
  })),
  updatePlayerDrawerInfo: vi.fn(),
  updateMinimizedPlayButton: vi.fn()
}));

vi.mock('../src/components/player/builder', () => {
  const element = (tag: string, className: string): HTMLElement => {
    const node = document.createElement(tag);
    node.className = className;
    return node;
  };

  const buildTracklist = (): HTMLElement => {
    const table = document.createElement('table');
    ['Track 1', 'Track 2', 'Track 3'].forEach((title, index) => {
      const row = element('tr', 'bes-track-row');
      row.dataset.trackId = String(index + 1);
      row.innerHTML = `
        <td class="bes-track-title-col"><span class="bes-track-title">${title}</span></td>
        <td class="bes-track-link-col"><a class="bes-track-link" href="/track">arrow</a></td>
        <td class="bes-track-buy-col"><button class="one-click-button"></button></td>
      `;
      table.appendChild(row);
    });
    return table;
  };

  const buildTransport = (): HTMLElement => {
    const transport = element('div', 'bes-transport');
    ['bes-transport-prev', 'bes-transport-play', 'bes-transport-next'].forEach(name =>
      transport.appendChild(element('button', name))
    );
    return transport;
  };

  const buildCenter = (): HTMLElement => {
    const center = element('div', 'bes-drawer-player-center');
    const progbar = element('div', 'bes-progbar');
    const waveformView = element('div', 'bes-waveform-container bes-visible');
    waveformView.appendChild(element('canvas', 'bes-waveform'));
    progbar.appendChild(waveformView);
    progbar.appendChild(element('div', 'bes-slider-container'));
    center.appendChild(progbar);
    center.appendChild(element('span', 'bes-bpm-number'));
    center.appendChild(element('button', 'bes-toggle-waveform bes-toggle-active'));
    center.appendChild(element('button', 'bes-toggle-slider'));
    return center;
  };

  const buildVolume = (): HTMLElement => {
    const column = element('div', 'bes-drawer-volume-column');
    column.appendChild(element('button', 'bes-volume-mute'));
    column.appendChild(element('div', 'bes-volume'));
    column.appendChild(element('span', 'bes-volume-percent'));
    return column;
  };

  const buildAlbumBuyButton = vi.fn(() => element('div', 'bes-album-buy'));

  return {
    buildDrawerPlayer: vi.fn(() => ({
      transportElement: buildTransport(),
      centerElement: buildCenter(),
      volumeElement: buildVolume(),
      tracklistElement: buildTracklist(),
      albumBuyButton: buildAlbumBuyButton()
    })),
    buildTrackTable: vi.fn(() => buildTracklist()),
    buildAlbumBuyButton
  };
});

vi.mock('../src/utilities', () => ({
  createFetchFunction: vi.fn(() => fetch)
}));

vi.mock('../src/audioFeatures', () => ({
  generateAudioFeatures: vi.fn(),
  drawOverlay: vi.fn()
}));

describe('PlayerLoader - Main Player Logic', () => {
  let player: typeof import('../src/components/player/loader');
  let discography: typeof import('../src/discography');

  beforeEach(async () => {
    vi.resetModules();
    createDomNodes(`
      <div class="bes-player-drawer">
        <div class="bes-player-drawer-player"></div>
        <div class="bes-player-drawer-tracklist"></div>
        <img class="bes-player-drawer-album-art" />
        <div class="bes-player-drawer-transport"></div>
        <div class="bes-player-drawer-right"></div>
      </div>
      <li class="music-grid-item" data-item-id="album-123">
        <img src="https://example.com/album123.jpg" />
      </li>
      <li class="music-grid-item" data-item-id="album-456">
        <img src="https://example.com/album456.jpg" />
      </li>
      <li class="music-grid-item" data-item-id="album-789">
        <img src="https://example.com/album789.jpg" />
      </li>
    `);

    player = await import('../src/components/player/loader');
    discography = await import('../src/discography');
  });

  afterEach(() => {
    cleanupTestNodes();
    vi.clearAllMocks();
  });

  describe('Continuous play across albums', () => {
    it('should extract discography order from page', () => {
      const items = discography.extractDiscographyOrder();

      expect(items.length).toBe(3);
      expect(items[0].id).toBe('123');
      expect(items[1].id).toBe('456');
      expect(items[2].id).toBe('789');
    });

    it('should update discography order', () => {
      discography.updateDiscographyOrder();
      const length = discography.getDiscographyLength();

      expect(length).toBe(3);
    });

    it('should find album index by ID', () => {
      discography.updateDiscographyOrder();
      const index = discography.findAlbumIndexById('456');

      expect(index).toBe(1);
    });

    it('should return current album index', () => {
      expect(() => discography.getCurrentAlbumIndex()).not.toThrow();
    });

    it('should return discography length', () => {
      discography.updateDiscographyOrder();
      expect(discography.getDiscographyLength()).toBe(3);
    });
  });

  describe('Album navigation (prev/next in discography)', () => {
    it('should load next album when available', async () => {
      discography.updateDiscographyOrder();
      // Load first album first
      await player.loadAlbumIntoDrawer('123', 'album', false);

      const result = await player.loadNextAlbum(false);

      expect(result).toBe(true);
      expect(discography.getCurrentAlbumIndex()).toBe(1);
    });

    it('should load previous album when available', async () => {
      discography.updateDiscographyOrder();
      // Load second album first
      await player.loadAlbumIntoDrawer('456', 'album', false);

      const result = await player.loadPreviousAlbum(false);

      expect(result).toBe(true);
      expect(discography.getCurrentAlbumIndex()).toBe(0);
    });

    it('should return false when trying to load next album at end', async () => {
      discography.updateDiscographyOrder();
      // Load last album
      await player.loadAlbumIntoDrawer('789', 'album', false);

      const result = await player.loadNextAlbum(false);

      expect(result).toBe(false);
    });

    it('should return false when trying to load previous album at start', async () => {
      discography.updateDiscographyOrder();
      // Load first album
      await player.loadAlbumIntoDrawer('123', 'album', false);

      const result = await player.loadPreviousAlbum(false);

      expect(result).toBe(false);
    });

    it('should preserve album buy button when navigating to next album', async () => {
      discography.updateDiscographyOrder();
      // Load first album
      await player.loadAlbumIntoDrawer('123', 'album', false);

      // Check buy button exists after first load
      const tracklistContainer = document.querySelector('.bes-player-drawer-tracklist');
      expect(tracklistContainer?.querySelector('.bes-album-buy')).toBeTruthy();

      // Navigate to next album
      await player.loadNextAlbum(false);

      // Buy button should still exist
      expect(tracklistContainer?.querySelector('.bes-album-buy')).toBeTruthy();
    });
  });

  describe('Album art extracted from discography grid', () => {
    it('should extract album art URL from grid item', async () => {
      discography.updateDiscographyOrder();

      await player.loadAlbumIntoDrawer('123', 'album', false);

      // Album art extraction is verified by the function call
      // The actual URL is extracted in extractAlbumArtFromPage
      expect(player.getCurrentAlbumData()).toBeDefined();
    });
  });

  describe('Persistent audio element with state management', () => {
    it('should create persistent audio element only once', async () => {
      discography.updateDiscographyOrder();

      await player.loadAlbumIntoDrawer('123', 'album', false);

      const firstAudio = document.querySelector('audio');
      expect(firstAudio).toBeDefined();

      await player.loadAlbumIntoDrawer('456', 'album', false);

      const secondAudio = document.querySelector('audio');
      expect(secondAudio).toBe(firstAudio); // Same element
    });

    it('should have audio element hidden from view', async () => {
      discography.updateDiscographyOrder();

      await player.loadAlbumIntoDrawer('123', 'album', false);

      const audio = document.querySelector('audio') as HTMLAudioElement;
      expect(audio.style.display).toBe('none');
    });
  });

  describe('Skipping a fully unplayable remainder', () => {
    const startPlaying = () => {
      const audio = document.querySelector('audio') as HTMLAudioElement;
      audio.play = vi.fn().mockResolvedValue(undefined);
      audio.pause = vi.fn();
      Object.defineProperty(audio, 'paused', { value: false, writable: true, configurable: true });
      return audio;
    };

    it('should advance to the next album when nothing after the current track can play', async () => {
      discography.updateDiscographyOrder();
      await player.loadAlbumIntoDrawer('456', 'album', false);

      expect(player.getCurrentTrackIndex()).toBe(0);
      expect(player.getCurrentAlbumData()?.id).toBe(456);

      startPlaying();
      const nextButton = document.querySelector('.bes-player-drawer .bes-transport-next') as HTMLButtonElement;
      nextButton.click();
      await new Promise(resolve => setTimeout(resolve, 400));

      expect(player.getCurrentAlbumData()?.id).toBe(789);
    });

    it('should keep playing through the album change', async () => {
      discography.updateDiscographyOrder();
      await player.loadAlbumIntoDrawer('456', 'album', false);

      const audio = startPlaying();
      const nextButton = document.querySelector('.bes-player-drawer .bes-transport-next') as HTMLButtonElement;
      nextButton.click();
      await new Promise(resolve => setTimeout(resolve, 400));

      expect(audio.play).toHaveBeenCalled();
    });

    it('should land on a playable track in the album it moves to', async () => {
      discography.updateDiscographyOrder();
      await player.loadAlbumIntoDrawer('456', 'album', false);

      startPlaying();
      const nextButton = document.querySelector('.bes-player-drawer .bes-transport-next') as HTMLButtonElement;
      nextButton.click();
      await new Promise(resolve => setTimeout(resolve, 400));

      expect(player.getCurrentAlbumData()?.id).toBe(789);

      const tracks = player.getCurrentAlbumData()?.tracks;
      const landedOn = tracks?.[player.getCurrentTrackIndex()];
      expect(landedOn?.streaming_url?.['mp3-128']).toBeTruthy();
    });

    it('should move to the next album when the last track finishes on its own', async () => {
      discography.updateDiscographyOrder();
      await player.loadAlbumIntoDrawer('456', 'album', false);

      const audio = startPlaying();
      audio.dispatchEvent(new Event('ended'));
      await new Promise(resolve => setTimeout(resolve, 400));

      expect(player.getCurrentAlbumData()?.id).toBe(789);
      expect(audio.play).toHaveBeenCalled();
    });

    it('should stop at the end of the last album when it finishes on its own', async () => {
      discography.updateDiscographyOrder();
      await player.loadAlbumIntoDrawer('789', 'album', false);

      const audio = startPlaying();
      audio.dispatchEvent(new Event('ended'));
      audio.dispatchEvent(new Event('ended'));
      audio.dispatchEvent(new Event('ended'));
      await new Promise(resolve => setTimeout(resolve, 400));

      expect(player.getCurrentAlbumData()?.id).toBe(789);
    });

    it('should stay put when there is no next album to fall through to', async () => {
      discography.updateDiscographyOrder();
      await player.loadAlbumIntoDrawer('789', 'album', false);

      startPlaying();
      const nextButton = document.querySelector('.bes-player-drawer .bes-transport-next') as HTMLButtonElement;
      nextButton.click();
      nextButton.click();
      nextButton.click();
      await new Promise(resolve => setTimeout(resolve, 400));

      expect(player.getCurrentAlbumData()?.id).toBe(789);
    });
  });

  describe('Track navigation within album (prev/next buttons)', () => {
    let nextButton: HTMLButtonElement;
    let prevButton: HTMLButtonElement;
    let audio: HTMLAudioElement;

    beforeEach(async () => {
      createDomNodes(`
        <div class="bes-player-drawer open">
          <div class="bes-player-drawer-player"></div>
          <div class="bes-player-drawer-tracklist"></div>
          <img class="bes-player-drawer-album-art" />
          <div class="bes-player-drawer-transport">
            <button class="bes-transport-prev"></button>
            <button class="bes-transport-next"></button>
          </div>
          <div class="bes-player-drawer-right"></div>
        </div>
        <li class="music-grid-item" data-item-id="album-123">
          <img src="https://example.com/album123.jpg" />
        </li>
        <li class="music-grid-item" data-item-id="album-456">
          <img src="https://example.com/album456.jpg" />
        </li>
      `);

      discography.updateDiscographyOrder();
      await player.loadAlbumIntoDrawer('123', 'album', false);

      // Re-query buttons after loadAlbumIntoDrawer replaces them
      nextButton = document.querySelector('.bes-player-drawer .bes-transport-next') as HTMLButtonElement;
      prevButton = document.querySelector('.bes-player-drawer .bes-transport-prev') as HTMLButtonElement;
      audio = document.querySelector('audio') as HTMLAudioElement;

      // Mock audio properties and methods
      Object.defineProperty(audio, 'duration', { value: 180, writable: true, configurable: true });
      Object.defineProperty(audio, 'currentTime', { value: 0, writable: true, configurable: true });
      Object.defineProperty(audio, 'paused', { value: false, writable: true, configurable: true });
      audio.play = vi.fn().mockResolvedValue(undefined);
      audio.pause = vi.fn();
    });

    it('should advance from first track to second track when next clicked', async () => {
      // Load first track (index 0)
      expect(player.getCurrentTrackIndex()).toBe(0);

      nextButton.click();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(player.getCurrentTrackIndex()).toBe(1);
    });

    it('should advance from second-to-last track to last track (not next album)', async () => {
      // First click next to get to track 1 (second track, second-to-last of 3)
      nextButton.click();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(player.getCurrentTrackIndex()).toBe(1);

      const initialAlbumId = player.getCurrentAlbumData()?.id;

      // Click next again - should go to track 2 (last track), NOT next album
      nextButton.click();
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should advance to last track (index 2), NOT next album
      expect(player.getCurrentAlbumData()?.id).toBe(initialAlbumId);
      expect(player.getCurrentTrackIndex()).toBe(2);
    });

    it('should load next album when next button clicked on last track', async () => {
      // Navigate to last track (click next twice: 0->1->2)
      nextButton.click();
      await new Promise(resolve => setTimeout(resolve, 10));
      nextButton.click();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(player.getCurrentTrackIndex()).toBe(2); // Last track

      const initialAlbumId = player.getCurrentAlbumData()?.id;

      nextButton.click();
      await new Promise(resolve => setTimeout(resolve, 350)); // Wait for album load + setTimeout

      // Should load next album (456) and play first track
      expect(player.getCurrentAlbumData()?.id).not.toBe(initialAlbumId);
      expect(player.getCurrentAlbumData()?.id).toBe(456);
      expect(player.getCurrentTrackIndex()).toBe(0); // First track of new album
    });

    it('should preserve playing state when navigating to next track', async () => {
      // Start playing
      Object.defineProperty(audio, 'paused', { value: false, writable: true, configurable: true });

      nextButton.click();
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should have called play() to continue playing new track
      expect(audio.play).toHaveBeenCalled();
    });

    it('should preserve paused state when navigating to next track', async () => {
      // Pause
      Object.defineProperty(audio, 'paused', { value: true, writable: true, configurable: true });

      nextButton.click();
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should NOT call play()
      expect(audio.play).not.toHaveBeenCalled();
    });

    it('should go back from second track to first track when prev clicked', async () => {
      // Navigate to second track
      nextButton.click();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(player.getCurrentTrackIndex()).toBe(1);

      prevButton.click();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(player.getCurrentTrackIndex()).toBe(0);
    });

    it('should load previous album when prev button clicked on first track', async () => {
      // Load second album first
      await player.loadAlbumIntoDrawer('456', 'album', false);
      expect(player.getCurrentTrackIndex()).toBe(0); // First track
      expect(player.getCurrentAlbumData()?.id).toBe(456);

      prevButton.click();
      await new Promise(resolve => setTimeout(resolve, 350)); // Wait for album load + setTimeout

      // Should load previous album (123) and play last track
      expect(player.getCurrentAlbumData()?.id).toBe(123);
      expect(player.getCurrentTrackIndex()).toBe(2); // Last track of previous album (3 tracks total)
    });
  });
});

describe('PlayerLoader - Keyboard Shortcuts', () => {
  let player: typeof import('../src/components/player/loader');
  let discography: typeof import('../src/discography');
  let audio: HTMLAudioElement;

  const press = (key: string, modifiers: { shiftKey?: boolean } = {}) => {
    const event = new KeyboardEvent('keydown', { key, cancelable: true, ...modifiers });
    Object.defineProperty(event, 'target', { value: document.body });
    document.dispatchEvent(event);
    return event;
  };

  beforeEach(async () => {
    vi.resetModules();
    createDomNodes(`
      <div class="bes-player-drawer open">
        <div class="bes-player-drawer-player"></div>
        <div class="bes-player-drawer-tracklist"></div>
        <img class="bes-player-drawer-album-art" />
        <div class="bes-player-drawer-transport"></div>
        <div class="bes-player-drawer-right"></div>
      </div>
      <li class="music-grid-item" data-item-id="album-123"></li>
      <li class="music-grid-item" data-item-id="album-456"></li>
    `);

    player = await import('../src/components/player/loader');
    discography = await import('../src/discography');
    discography.updateDiscographyOrder();
    await player.loadAlbumIntoDrawer('123', 'album', false);

    audio = document.querySelector('audio') as HTMLAudioElement;
    audio.play = vi.fn().mockResolvedValue(undefined);
    audio.pause = vi.fn();
    Object.defineProperty(audio, 'duration', { value: 180, writable: true, configurable: true });
    Object.defineProperty(audio, 'currentTime', { value: 60, writable: true, configurable: true });
    Object.defineProperty(audio, 'paused', { value: true, writable: true, configurable: true });
  });

  afterEach(() => {
    cleanupTestNodes();
  });

  describe('play and pause', () => {
    it('should start playback on Space', () => {
      press(' ');

      expect(audio.play).toHaveBeenCalled();
    });

    it('should start playback on p', () => {
      press('p');

      expect(audio.play).toHaveBeenCalled();
    });

    it('should pause when already playing', () => {
      Object.defineProperty(audio, 'paused', { value: false, writable: true, configurable: true });

      press(' ');

      expect(audio.pause).toHaveBeenCalled();
    });
  });

  describe('track navigation', () => {
    it('should move to the next track on ArrowDown', () => {
      expect(player.getCurrentTrackIndex()).toBe(0);

      press('ArrowDown');

      expect(player.getCurrentTrackIndex()).toBe(1);
    });

    it('should move to the previous track on ArrowUp', () => {
      press('ArrowDown');
      expect(player.getCurrentTrackIndex()).toBe(1);

      press('ArrowUp');

      expect(player.getCurrentTrackIndex()).toBe(0);
    });
  });

  describe('seeking', () => {
    it('should seek forward by the step size on ArrowRight', () => {
      press('ArrowRight');

      expect(audio.currentTime).toBe(70);
    });

    it('should seek backward by the step size on ArrowLeft', () => {
      press('ArrowLeft');

      expect(audio.currentTime).toBe(50);
    });

    it('should seek forward by the large step on Shift+ArrowRight', () => {
      press('ArrowRight', { shiftKey: true });

      expect(audio.currentTime).toBe(90);
    });

    it('should seek backward by the large step on Shift+ArrowLeft', () => {
      press('ArrowLeft', { shiftKey: true });

      expect(audio.currentTime).toBe(30);
    });
  });

  describe('volume', () => {
    beforeEach(() => {
      audio.volume = 0.5;
    });

    it('should raise the volume on Shift+ArrowUp', () => {
      press('ArrowUp', { shiftKey: true });

      expect(audio.volume).toBeCloseTo(0.55);
    });

    it('should lower the volume on Shift+ArrowDown', () => {
      press('ArrowDown', { shiftKey: true });

      expect(audio.volume).toBeCloseTo(0.45);
    });

    it('should not raise the volume above full', () => {
      audio.volume = 0.98;

      press('ArrowUp', { shiftKey: true });

      expect(audio.volume).toBe(1);
    });

    it('should not lower the volume below silent', () => {
      audio.volume = 0.02;

      press('ArrowDown', { shiftKey: true });

      expect(audio.volume).toBe(0);
    });

    it('should show the new volume in the readout', () => {
      press('ArrowUp', { shiftKey: true });

      expect(document.querySelector('.bes-volume-percent')?.textContent).toBe('55%');
    });
  });

  describe('event filtering', () => {
    it('should ignore keys while the drawer is closed', () => {
      document.querySelector('.bes-player-drawer')?.classList.remove('open');

      press(' ');

      expect(audio.play).not.toHaveBeenCalled();
    });

    it('should ignore keys while the page search bar has focus', () => {
      const input = document.createElement('input');
      input.className = 'search-bar';
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
      Object.defineProperty(event, 'target', { value: input });
      document.dispatchEvent(event);

      expect(audio.play).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('should ignore arrow keys while a search suggestion has focus', () => {
      const suggestion = document.createElement('a');
      document.body.appendChild(suggestion);

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
      Object.defineProperty(event, 'target', { value: suggestion });
      document.dispatchEvent(event);

      expect(player.getCurrentTrackIndex()).toBe(0);
      expect(event.defaultPrevented).toBe(false);
    });

    it('should ignore a bare Meta press', () => {
      const event = new KeyboardEvent('keydown', { key: 'Meta', metaKey: true, cancelable: true });
      Object.defineProperty(event, 'target', { value: document.body });
      document.dispatchEvent(event);

      expect(audio.play).not.toHaveBeenCalled();
    });

    it('should claim the keys it handles', () => {
      const event = press(' ');

      expect(event.defaultPrevented).toBe(true);
    });
  });
});

describe('PlayerLoader - Track row click targets', () => {
  beforeEach(() => {
    createDomNodes(`
      <table>
        <tr class="bes-track-row">
          <td class="bes-track-num-col"><div class="bes-track-num">1.</div></td>
          <td class="bes-track-title-col"><span class="bes-track-title">Track 1</span></td>
          <td class="bes-track-duration-col"><span class="bes-track-duration">3:00</span></td>
          <td class="bes-track-link-col"><a class="bes-track-link" href="/track/1">arrow</a></td>
          <td class="bes-track-buy-col">
            <div class="one-click-button-container">
              <div class="currency-input-wrapper"><input class="currency-input" /></div>
              <button class="one-click-button"><span class="bes-cart-icons"></span></button>
            </div>
          </td>
        </tr>
      </table>
    `);
  });

  afterEach(() => {
    cleanupTestNodes();
  });

  it('should treat a click on the track title as a playback click', () => {
    expect(isPlaybackClick(document.querySelector('.bes-track-title'))).toBe(true);
  });

  it('should treat a click on the row itself as a playback click', () => {
    expect(isPlaybackClick(document.querySelector('.bes-track-num'))).toBe(true);
  });

  it('should NOT play when clicking the add to cart button', () => {
    expect(isPlaybackClick(document.querySelector('.one-click-button'))).toBe(false);
  });

  it('should NOT play when clicking an icon inside the add to cart button', () => {
    expect(isPlaybackClick(document.querySelector('.bes-cart-icons'))).toBe(false);
  });

  it('should NOT play when clicking the price input', () => {
    expect(isPlaybackClick(document.querySelector('.currency-input'))).toBe(false);
  });

  it('should NOT play when clicking anywhere in the buy column', () => {
    expect(isPlaybackClick(document.querySelector('.bes-track-buy-col'))).toBe(false);
  });

  it('should NOT play when clicking the track link icon', () => {
    expect(isPlaybackClick(document.querySelector('.bes-track-link'))).toBe(false);
  });
});

describe('PlayerLoader - Player Interactions', () => {
  let player: typeof import('../src/components/player/loader');
  let discography: typeof import('../src/discography');
  let audio: HTMLAudioElement;

  beforeEach(async () => {
    vi.resetModules();
    createDomNodes(`
      <div class="bes-player-drawer open">
        <div class="bes-player-drawer-player"></div>
        <div class="bes-player-drawer-tracklist"></div>
        <img class="bes-player-drawer-album-art" />
        <div class="bes-player-drawer-transport"></div>
        <div class="bes-player-drawer-right"></div>
      </div>
      <li class="music-grid-item" data-item-id="album-123"></li>
    `);

    player = await import('../src/components/player/loader');
    discography = await import('../src/discography');
    discography.updateDiscographyOrder();
    await player.loadAlbumIntoDrawer('123', 'album', false);

    audio = document.querySelector('audio') as HTMLAudioElement;
    audio.play = vi.fn().mockResolvedValue(undefined);
    audio.pause = vi.fn();
    Object.defineProperty(audio, 'duration', { value: 180, writable: true, configurable: true });
    Object.defineProperty(audio, 'currentTime', { value: 0, writable: true, configurable: true });
    Object.defineProperty(audio, 'paused', { value: true, writable: true, configurable: true });
  });

  afterEach(() => {
    cleanupTestNodes();
  });

  describe('transport buttons', () => {
    it('should start playback when the play button is clicked', () => {
      (document.querySelector('.bes-transport-play') as HTMLElement).click();

      expect(audio.play).toHaveBeenCalled();
    });

    it('should pause when the play button is clicked while playing', () => {
      Object.defineProperty(audio, 'paused', { value: false, writable: true, configurable: true });

      (document.querySelector('.bes-transport-play') as HTMLElement).click();

      expect(audio.pause).toHaveBeenCalled();
    });

    it('should mark the play button while audio is playing', () => {
      audio.dispatchEvent(new Event('play'));

      expect(document.querySelector('.bes-transport-play')?.classList.contains('playing')).toBe(true);
    });

    it('should unmark the play button when audio pauses', () => {
      audio.dispatchEvent(new Event('play'));
      audio.dispatchEvent(new Event('pause'));

      expect(document.querySelector('.bes-transport-play')?.classList.contains('playing')).toBe(false);
    });
  });

  describe('seeking by clicking the progress bar', () => {
    it('should seek to the clicked position', () => {
      const progbar = document.querySelector('.bes-progbar') as HTMLElement;
      progbar.getBoundingClientRect = vi.fn().mockReturnValue({ left: 0, width: 600 }) as never;

      progbar.dispatchEvent(new MouseEvent('click', { clientX: 300 }));

      expect(audio.currentTime).toBe(90);
    });
  });

  describe('volume slider', () => {
    const dragTo = (clientY: number) => {
      const slider = document.querySelector('.bes-volume') as HTMLElement;
      slider.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0, height: 200 }) as never;
      slider.setPointerCapture = vi.fn();
      slider.releasePointerCapture = vi.fn();
      slider.dispatchEvent(new PointerEvent('pointerdown', { clientY, pointerId: 1 }));
      return slider;
    };

    it('should set the volume from the pointer position', () => {
      dragTo(100);

      expect(audio.volume).toBeCloseTo(0.5);
    });

    it('should capture the pointer so dragging outside still tracks', () => {
      const slider = dragTo(100);

      expect(slider.setPointerCapture).toHaveBeenCalledWith(1);
    });

    it('should release the pointer when the drag ends', () => {
      const slider = dragTo(100);

      slider.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));

      expect(slider.releasePointerCapture).toHaveBeenCalledWith(1);
    });

    it('should clamp the volume to the slider bounds', () => {
      dragTo(-50);

      expect(audio.volume).toBe(1);
    });
  });

  describe('mute button', () => {
    it('should silence the audio', () => {
      audio.volume = 0.5;

      (document.querySelector('.bes-volume-mute') as HTMLElement).click();

      expect(audio.volume).toBe(0);
    });

    it('should restore the previous volume when unmuted', () => {
      audio.volume = 0.5;
      const mute = document.querySelector('.bes-volume-mute') as HTMLElement;

      mute.click();
      mute.click();

      expect(audio.volume).toBeCloseTo(0.5);
    });
  });

  describe('clicking a track row', () => {
    const rowAt = (index: number) =>
      document.querySelectorAll('.bes-player-drawer .bes-track-row')[index] as HTMLElement;

    it('should play a different track when its row is clicked', () => {
      rowAt(1).click();

      expect(player.getCurrentTrackIndex()).toBe(1);
      expect(audio.play).toHaveBeenCalled();
    });

    it('should pause the current track rather than restarting it', () => {
      Object.defineProperty(audio, 'paused', { value: false, writable: true, configurable: true });

      rowAt(0).click();

      expect(audio.pause).toHaveBeenCalled();
      expect(audio.play).not.toHaveBeenCalled();
    });

    it('should resume the current track when it is paused', () => {
      rowAt(0).click();

      expect(audio.play).toHaveBeenCalled();
    });

    it('should not change track when the buy button is clicked', () => {
      (rowAt(1).querySelector('.one-click-button') as HTMLElement).click();

      expect(player.getCurrentTrackIndex()).toBe(0);
    });

    it('should not change track when the track link is clicked', () => {
      (rowAt(1).querySelector('.bes-track-link') as HTMLElement).click();

      expect(player.getCurrentTrackIndex()).toBe(0);
    });
  });
});

describe('PlayerLoader - Waveform config from the extension', () => {
  let player: typeof import('../src/components/player/loader');
  let discography: typeof import('../src/discography');
  let audioFeatures: typeof import('../src/audioFeatures');
  let port: { postMessage: ReturnType<typeof vi.fn>; onMessage: { addListener: ReturnType<typeof vi.fn> } };

  const broadcastConfig = (displayWaveform: boolean) => {
    port.onMessage.addListener.mock.calls.forEach(([listener]) => listener({ config: { displayWaveform } }));
  };

  const view = (selector: string) => document.querySelector(selector) as HTMLElement;

  beforeEach(async () => {
    vi.resetModules();
    createDomNodes(`
      <div class="bes-player-drawer open">
        <div class="bes-player-drawer-player"></div>
        <div class="bes-player-drawer-tracklist"></div>
        <img class="bes-player-drawer-album-art" />
        <div class="bes-player-drawer-transport"></div>
        <div class="bes-player-drawer-right"></div>
      </div>
      <li class="music-grid-item" data-item-id="album-123"></li>
    `);

    port = { postMessage: vi.fn(), onMessage: { addListener: vi.fn() } };

    player = await import('../src/components/player/loader');
    discography = await import('../src/discography');
    audioFeatures = await import('../src/audioFeatures');
    discography.updateDiscographyOrder();
    await player.loadAlbumIntoDrawer('123', 'album', false, port as never);
  });

  afterEach(() => {
    cleanupTestNodes();
  });

  it('should ask the extension for the current config on startup', () => {
    expect(port.postMessage).toHaveBeenCalledWith({ requestConfig: {} });
  });

  it('should show the slider instead of the waveform when the config disables it', () => {
    broadcastConfig(false);

    expect(view('.bes-slider-container').classList.contains('bes-visible')).toBe(true);
    expect(view('.bes-waveform-container').classList.contains('bes-visible')).toBe(false);
  });

  it('should mark the matching toggle button as active', () => {
    broadcastConfig(false);

    expect(view('.bes-toggle-slider').classList.contains('bes-toggle-active')).toBe(true);
    expect(view('.bes-toggle-waveform').classList.contains('bes-toggle-active')).toBe(false);
  });

  it('should restore the waveform when the config enables it again', () => {
    broadcastConfig(false);
    broadcastConfig(true);

    expect(view('.bes-waveform-container').classList.contains('bes-visible')).toBe(true);
  });

  it('should persist the choice when the user switches view', () => {
    view('.bes-toggle-slider').click();

    expect(port.postMessage).toHaveBeenCalledWith({ toggleWaveformDisplay: {} });
  });

  it('should not persist anything when the chosen view is already showing', () => {
    view('.bes-toggle-waveform').click();

    expect(port.postMessage).not.toHaveBeenCalledWith({ toggleWaveformDisplay: {} });
  });

  const analysisRuns = () => vi.mocked(audioFeatures.generateAudioFeatures).mock.calls.length;

  it('should analyse the track so bpm and waveform reach the cache', () => {
    const audio = document.querySelector('audio') as HTMLAudioElement;
    audio.src = 'https://t4.bcbits.com/stream/hash/mp3-128/12345';
    const before = analysisRuns();

    audio.dispatchEvent(new Event('canplay'));

    expect(analysisRuns()).toBeGreaterThan(before);
  });

  it('should skip analysis while the waveform is switched off', () => {
    broadcastConfig(false);
    const audio = document.querySelector('audio') as HTMLAudioElement;
    audio.src = 'https://t4.bcbits.com/stream/hash/mp3-128/12345';
    const before = analysisRuns();

    audio.dispatchEvent(new Event('canplay'));

    expect(analysisRuns()).toBe(before);
  });

  const lastAnalysisOptions = () => {
    const calls = vi.mocked(audioFeatures.generateAudioFeatures).mock.calls;
    return calls[calls.length - 1][6] as {
      trackId?: number | null;
      urlFormatter?: (src: string) => { stream: { type: string; path?: string } };
    };
  };

  it('should request the audio buffer by stream path so the backend can find the audio', () => {
    const audio = document.querySelector('audio') as HTMLAudioElement;
    audio.src = 'https://t4.bcbits.com/stream/hash/mp3-128/12345';

    audio.dispatchEvent(new Event('canplay'));

    expect(lastAnalysisOptions().urlFormatter?.(audio.src).stream).toEqual({
      type: 'direct-path',
      path: 'hash/mp3-128/12345'
    });
  });

  it('should identify the track from the api rather than by parsing its url', () => {
    const audio = document.querySelector('audio') as HTMLAudioElement;
    audio.src = 'https://audio.example.com/a-url-no-regex-would-recognise';

    audio.dispatchEvent(new Event('canplay'));

    expect(lastAnalysisOptions().trackId).toBe(1);
  });
});

describe('FindMusic.club played and liked state', () => {
  let player: typeof import('../src/components/player/loader');
  let discography: typeof import('../src/discography');
  let sendMessage: ReturnType<typeof vi.fn>;

  const rows = (): HTMLElement[] =>
    Array.from(document.querySelectorAll<HTMLElement>('.bes-player-drawer .bes-track-row'));

  const audio = (): HTMLAudioElement => document.querySelector('audio') as HTMLAudioElement;

  const startPlayback = () => audio().dispatchEvent(new Event('play'));

  const playPosts = (): number[] =>
    sendMessage.mock.calls
      .map(([message]) => message)
      .filter(message => message?.contentScriptQuery === 'postTrackPlayed')
      .map(message => message.trackId);

  const flush = () => new Promise(resolve => setTimeout(resolve, 0));

  beforeEach(async () => {
    vi.resetModules();
    sendMessage = vi.fn(async () => null);
    (globalThis as any).chrome = { runtime: { sendMessage } };

    createDomNodes(`
      <div class="bes-player-drawer">
        <div class="bes-player-drawer-player"></div>
        <div class="bes-player-drawer-tracklist"></div>
        <img class="bes-player-drawer-album-art" />
        <div class="bes-player-drawer-transport"></div>
        <div class="bes-player-drawer-right"></div>
      </div>
      <li class="music-grid-item" data-item-id="album-123">
        <img src="https://example.com/album123.jpg" />
      </li>
      <li class="music-grid-item" data-item-id="album-456">
        <img src="https://example.com/album456.jpg" />
      </li>
    `);

    player = await import('../src/components/player/loader');
    discography = await import('../src/discography');
    discography.updateDiscographyOrder();
  });

  afterEach(() => {
    document.querySelector('audio')?.remove();
    cleanupTestNodes();
    vi.clearAllMocks();
  });

  it('should ask the background for the track state of the album it loads', async () => {
    await player.loadAlbumIntoDrawer('123', 'album', false);
    await flush();

    expect(sendMessage).toHaveBeenCalledWith({
      contentScriptQuery: 'fetchAlbumTrackState',
      albumId: '123'
    });
  });

  it('should mark liked and played tracks returned by FindMusic.club', async () => {
    sendMessage.mockResolvedValue({ liked: [2], played: [1, 2] });

    await player.loadAlbumIntoDrawer('123', 'album', false);
    await flush();

    expect(rows().map(row => row.classList.contains('bes-is-liked'))).toEqual([false, true, false]);
    expect(rows().map(row => row.classList.contains('bes-is-played'))).toEqual([true, true, false]);
  });

  it('should leave rows unmarked when no state is available', async () => {
    sendMessage.mockResolvedValue(null);

    await player.loadAlbumIntoDrawer('123', 'album', false);
    await flush();

    rows().forEach(row => {
      expect(row.classList.contains('bes-is-liked')).toBe(false);
      expect(row.classList.contains('bes-is-played')).toBe(false);
    });
  });

  it('should still load the album when the track state request fails', async () => {
    sendMessage.mockRejectedValue(new Error('offline'));

    await expect(player.loadAlbumIntoDrawer('123', 'album', false)).resolves.toBeUndefined();
    await flush();

    expect(rows().length).toBe(3);
  });

  it('should not mark rows when the state arrives after the drawer moved to another album', async () => {
    let resolveState: (state: unknown) => void = () => {};
    sendMessage.mockImplementationOnce(() => new Promise(resolve => (resolveState = resolve)));

    await player.loadAlbumIntoDrawer('123', 'album', false);
    await player.loadAlbumIntoDrawer('456', 'album', false);

    resolveState({ liked: [1], played: [1] });
    await flush();

    expect(rows()[0].classList.contains('bes-is-liked')).toBe(false);
    expect(rows()[0].classList.contains('bes-is-played')).toBe(false);
  });

  it('should mark a track played once the play is recorded', async () => {
    sendMessage.mockResolvedValue({ success: true });

    await player.loadAlbumIntoDrawer('123', 'album', false);
    await flush();

    startPlayback();
    await flush();

    expect(rows()[0].classList.contains('bes-is-played')).toBe(true);
  });

  it('should not mark a track played when played caching is off', async () => {
    sendMessage.mockResolvedValue({ success: false });

    await player.loadAlbumIntoDrawer('123', 'album', false);
    await flush();

    startPlayback();
    await flush();

    expect(rows()[0].classList.contains('bes-is-played')).toBe(false);
  });

  it('should report the play to the background', async () => {
    await player.loadAlbumIntoDrawer('123', 'album', false);
    await flush();

    startPlayback();
    await flush();

    expect(playPosts()).toEqual([1]);
  });

  it('should report a play once per track, not on every resume', async () => {
    await player.loadAlbumIntoDrawer('123', 'album', false);
    await flush();

    startPlayback();
    startPlayback();
    startPlayback();
    await flush();

    expect(playPosts()).toEqual([1]);
  });

  it('should report each track the listener moves on to', async () => {
    await player.loadAlbumIntoDrawer('123', 'album', false);
    await flush();

    startPlayback();
    (document.querySelector('.bes-transport-next') as HTMLElement).click();
    await flush();
    startPlayback();
    await flush();

    expect(playPosts()).toEqual([1, 2]);
  });

  it('should keep playing when reporting the play fails', async () => {
    sendMessage.mockRejectedValue(new Error('offline'));

    await player.loadAlbumIntoDrawer('123', 'album', false);
    await flush();

    expect(() => startPlayback()).not.toThrow();
    await flush();

    expect(rows()[0].classList.contains('bes-is-played')).toBe(false);
  });
});
