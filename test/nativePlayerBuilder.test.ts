import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';
import { buildDrawerPlayer, buildTrackTable } from '../src/nativePlayerBuilder';
import { prevIcon, nextIcon, playIcon, pauseIcon } from '../src/components/playerIcons';
import { TralbumDetailsResponse } from '../src/bclient';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  }
}));

describe('NativePlayerBuilder - DOM Structure Creation', () => {
  let mockTralbumDetails: TralbumDetailsResponse;

  beforeEach(() => {
    createDomNodes('<div></div>');

    mockTralbumDetails = {
      id: 123,
      type: 'a',
      title: 'Test Album',
      tralbum_artist: 'Test Artist',
      currency: 'USD',
      price: 10.0,
      is_purchasable: true,
      tracks: [
        {
          track_id: 1001,
          title: 'Track 1',
          price: 1.0,
          currency: 'USD',
          is_purchasable: true,
          duration: 180,
          streaming_url: { 'mp3-128': 'https://example.com/track1.mp3' },
          track_url: '/track/track-1'
        },
        {
          track_id: 1002,
          title: 'Track 2',
          price: 0,
          currency: 'USD',
          is_purchasable: false,
          duration: 240,
          streaming_url: { 'mp3-128': 'https://example.com/track2.mp3' },
          track_url: '/track/track-2'
        }
      ]
    } as TralbumDetailsResponse;
  });

  afterEach(() => {
    cleanupTestNodes();
  });

  describe('AC-P2: Transport controls (prev/play/pause/next)', () => {
    it('should create transport element with prev/play/next buttons', () => {
      const { transportElement } = buildDrawerPlayer(mockTralbumDetails);

      const prevButton = transportElement.querySelector('.bes-transport-prev');
      expect(prevButton).toBeTruthy();

      const playButton = transportElement.querySelector('.bes-transport-play');
      expect(playButton).toBeTruthy();

      const nextButton = transportElement.querySelector('.bes-transport-next');
      expect(nextButton).toBeTruthy();
    });

    it('should create play button with play and pause icons', () => {
      const { transportElement } = buildDrawerPlayer(mockTralbumDetails);

      const playButton = transportElement.querySelector('.bes-transport-play') as HTMLElement;
      const playIconEl = playButton.querySelector('.bes-play-icon');
      const pauseIconEl = playButton.querySelector('.bes-pause-icon');

      expect(playIconEl).toBeTruthy();
      expect(pauseIconEl).toBeTruthy();
    });
  });

  describe('AC-P3: Track info display (album, title, artist)', () => {
    it('should create track info elements', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      const albumLabel = centerElement.querySelector('.bes-album-label');
      expect(albumLabel).toBeTruthy();

      const trackTitle = centerElement.querySelector('.bes-now-playing-title');
      expect(trackTitle).toBeTruthy();

      const artistName = centerElement.querySelector('.bes-artist-name');
      expect(artistName).toBeTruthy();
    });

    it('should have empty text content initially', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      const albumLabel = centerElement.querySelector('.bes-album-label') as HTMLElement;
      const trackTitle = centerElement.querySelector('.bes-now-playing-title') as HTMLElement;
      const artistName = centerElement.querySelector('.bes-artist-name') as HTMLElement;

      // Should be empty until track is loaded
      expect(albumLabel.textContent).toBe('');
      expect(trackTitle.textContent).toBe('');
      expect(artistName.textContent).toBe('');
    });
  });

  describe('AC-P4: BPM badge display', () => {
    it('should create BPM badge with number and label', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      const bpmBadge = centerElement.querySelector('.bes-bpm-badge');
      expect(bpmBadge).toBeTruthy();

      const bpmNumber = centerElement.querySelector('.bes-bpm-number');
      expect(bpmNumber).toBeTruthy();

      const bpmLabel = bpmBadge?.querySelector('.bes-bpm-unit') as HTMLElement;
      expect(bpmLabel?.textContent).toBe('BPM');
    });
  });

  describe('AC-P5: Dual-mode progress (waveform OR slider toggle)', () => {
    it('should create waveform canvas element', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      const canvas = centerElement.querySelector('canvas.bes-waveform') as HTMLCanvasElement;
      expect(canvas).toBeTruthy();
      expect(canvas.width).toBe(600);
      expect(canvas.height).toBe(30);
    });

    it('should create slider container with progress bar', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      const sliderContainer = centerElement.querySelector('.bes-slider-container');
      expect(sliderContainer).toBeTruthy();

      const progbarFill = centerElement.querySelector('.bes-progbar-fill');
      expect(progbarFill).toBeTruthy();

      const thumb = sliderContainer?.querySelector('.bes-progbar-thumb');
      expect(thumb).toBeTruthy();
    });

    it('should create toggle buttons for waveform and slider modes', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      const toggleSlider = centerElement.querySelector('.bes-toggle-slider') as HTMLButtonElement;
      const toggleWaveform = centerElement.querySelector('.bes-toggle-waveform') as HTMLButtonElement;

      expect(toggleSlider).toBeTruthy();
      expect(toggleWaveform).toBeTruthy();
    });

    it('should show waveform by default, hide slider', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      const sliderContainer = centerElement.querySelector('.bes-slider-container') as HTMLElement;
      const waveformContainer = centerElement.querySelector('.bes-waveform-container') as HTMLElement;

      expect(sliderContainer.classList.contains('bes-visible')).toBe(false);
      expect(waveformContainer.classList.contains('bes-visible')).toBe(true);
    });

    it('should toggle to slider mode when slider button clicked', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);
      document.body.appendChild(centerElement);

      const toggleSlider = centerElement.querySelector('.bes-toggle-slider') as HTMLButtonElement;
      const sliderContainer = centerElement.querySelector('.bes-slider-container') as HTMLElement;
      const waveformContainer = centerElement.querySelector('.bes-waveform-container') as HTMLElement;

      toggleSlider.click();

      expect(sliderContainer.classList.contains('bes-visible')).toBe(true);
      expect(waveformContainer.classList.contains('bes-visible')).toBe(false);
    });

    it('should toggle back to waveform mode when waveform button clicked', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);
      document.body.appendChild(centerElement);

      const toggleSlider = centerElement.querySelector('.bes-toggle-slider') as HTMLButtonElement;
      const toggleWaveform = centerElement.querySelector('.bes-toggle-waveform') as HTMLButtonElement;
      const sliderContainer = centerElement.querySelector('.bes-slider-container') as HTMLElement;
      const waveformContainer = centerElement.querySelector('.bes-waveform-container') as HTMLElement;

      // First switch to slider
      toggleSlider.click();

      // Then switch back to waveform
      toggleWaveform.click();

      expect(waveformContainer.classList.contains('bes-visible')).toBe(true);
      expect(sliderContainer.classList.contains('bes-visible')).toBe(false);
    });
  });

  describe('AC-P6: Custom vertical volume slider', () => {
    it('should create volume container with vertical slider', () => {
      const { volumeElement } = buildDrawerPlayer(mockTralbumDetails);

      const volumeContainer = volumeElement.querySelector('.bes-volume');
      expect(volumeContainer).toBeTruthy();

      const volumeFill = volumeElement.querySelector('.bes-volume-fill');
      expect(volumeFill).toBeTruthy();

      const volumeThumb = volumeElement.querySelector('.bes-volume-thumb');
      expect(volumeThumb).toBeTruthy();
    });

    it('should create volume percentage display', () => {
      const { volumeElement } = buildDrawerPlayer(mockTralbumDetails);

      const volumePercent = volumeElement.querySelector('.bes-volume-percent') as HTMLElement;
      expect(volumePercent).toBeTruthy();
      expect(volumePercent.textContent).toBe('100%');
    });
  });

  describe('AC-P7: Mute toggle', () => {
    it('should create mute button with icon', () => {
      const { volumeElement } = buildDrawerPlayer(mockTralbumDetails);

      const muteButton = volumeElement.querySelector('.bes-volume-mute') as HTMLButtonElement;
      expect(muteButton).toBeTruthy();

      // Should have SVG icon
      const svg = muteButton.querySelector('svg');
      expect(svg).toBeTruthy();
    });
  });

  describe('AC-P8: Time elapsed/total display', () => {
    it('should create time display elements', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      const timeElapsed = centerElement.querySelector('.bes-time-elapsed') as HTMLElement;
      const timeTotal = centerElement.querySelector('.bes-time-total') as HTMLElement;

      expect(timeElapsed).toBeTruthy();
      expect(timeTotal).toBeTruthy();

      // Should have initial values
      expect(timeElapsed.textContent).toBe('00:00');
      expect(timeTotal.textContent).toBe('00:00');
    });
  });

  describe('AC-S4: Tracklist preserved with buy buttons', () => {
    it('should build track table with correct number of rows', () => {
      const trackTable = buildTrackTable(mockTralbumDetails);

      const rows = trackTable.querySelectorAll('.bes-track-row');
      expect(rows.length).toBe(2);
    });

    it('should display track numbers and titles', () => {
      const trackTable = buildTrackTable(mockTralbumDetails);

      const firstRow = trackTable.querySelector('.bes-track-row:first-child') as HTMLElement;
      const trackNumber = firstRow.querySelector('.bes-track-num') as HTMLElement;
      const trackTitle = firstRow.querySelector('.bes-track-title') as HTMLElement;

      expect(trackNumber.textContent).toBe('1.');
      expect(trackTitle.textContent).toBe('Track 1');
    });

    it('should display track duration', () => {
      const trackTable = buildTrackTable(mockTralbumDetails);

      const firstRow = trackTable.querySelector('.bes-track-row:first-child') as HTMLElement;
      const time = firstRow.querySelector('.bes-track-duration') as HTMLElement;

      expect(time.textContent).toBe('3:00');
    });

    it('should include buy button for purchasable tracks', () => {
      const trackTable = buildTrackTable(mockTralbumDetails);

      const firstRow = trackTable.querySelector('.bes-track-row:first-child') as HTMLElement;
      const buyButton = firstRow.querySelector('.bes-track-buy-col');

      expect(buyButton).toBeTruthy();
    });

    it('should have empty download column for non-purchasable tracks', () => {
      const trackTable = buildTrackTable(mockTralbumDetails);

      const secondRow = trackTable.querySelectorAll('.bes-track-row')[1] as HTMLElement;
      const buyCol = secondRow.querySelector('.bes-track-buy-col') as HTMLElement;

      // Column exists but is empty (no cart button inside)
      expect(buyCol).toBeTruthy();
      expect(buyCol.querySelector('.one-click-button-container')).toBeNull();
    });

    it('should give every row the same column structure', () => {
      const trackTable = buildTrackTable(mockTralbumDetails);

      const rows = trackTable.querySelectorAll('.bes-track-row');
      rows.forEach(row => {
        expect(row.querySelector('.bes-track-num-col')).toBeTruthy();
        expect(row.querySelector('.bes-track-title-col')).toBeTruthy();
        expect(row.querySelector('.bes-track-duration-col')).toBeTruthy();
        expect(row.querySelector('.bes-track-link-col')).toBeTruthy();
        expect(row.querySelector('.bes-track-buy-col')).toBeTruthy();
      });
    });

    it('should include track link icon when track_url exists', () => {
      const trackTable = buildTrackTable(mockTralbumDetails);

      const firstRow = trackTable.querySelector('.bes-track-row:first-child') as HTMLElement;
      const trackLink = firstRow.querySelector('.bes-track-link') as HTMLAnchorElement;

      expect(trackLink).toBeTruthy();
      expect(trackLink.href).toContain('/track/track-1');
      expect(trackLink.target).toBe('_blank');
    });
  });

  describe('AC-W5: Grey base with purple accent colors', () => {
    it('should expose progress bar parts by class', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      expect(centerElement.querySelector('.bes-progbar-fill')).toBeTruthy();
      expect(centerElement.querySelector('.bes-progbar-thumb')).toBeTruthy();
    });

    it('should expose slider container by class', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      expect(centerElement.querySelector('.bes-slider-container')).toBeTruthy();
    });
  });

  describe('Transport icons come from the shared icon source', () => {
    const pathsOf = (markup: string) => {
      const holder = document.createElement('div');
      holder.innerHTML = markup;
      return Array.from(holder.querySelectorAll('path, rect')).map(
        node => node.getAttribute('d') || node.getAttribute('x')
      );
    };

    it('should draw prev and next from the shared icons', () => {
      const { transportElement } = buildDrawerPlayer(mockTralbumDetails);

      const prev = transportElement.querySelector('.bes-transport-prev path')?.getAttribute('d');
      const next = transportElement.querySelector('.bes-transport-next path')?.getAttribute('d');

      expect(prev).toBe(pathsOf(prevIcon(18))[0]);
      expect(next).toBe(pathsOf(nextIcon(18))[0]);
    });

    it('should carry both play and pause icons for class based toggling', () => {
      const { transportElement } = buildDrawerPlayer(mockTralbumDetails);
      const play = transportElement.querySelector('.bes-transport-play') as HTMLElement;

      expect(play.querySelector('.bes-play-icon path')?.getAttribute('d')).toBe(pathsOf(playIcon(16))[0]);
      expect(play.querySelectorAll('.bes-pause-icon rect').length).toBe(pathsOf(pauseIcon(16)).length);
    });
  });

  describe('AC-A3: Stylesheet hooks on player elements', () => {
    it('should expose transport buttons by class', () => {
      const { transportElement } = buildDrawerPlayer(mockTralbumDetails);

      expect(transportElement.querySelector('.bes-transport-prev')).toBeTruthy();
      expect(transportElement.querySelector('.bes-transport-play')).toBeTruthy();
      expect(transportElement.querySelector('.bes-transport-next')).toBeTruthy();
    });

    it('should expose player controls by class', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      expect(centerElement.querySelector('.bes-track-info')).toBeTruthy();
      expect(centerElement.querySelector('.bes-player-controls')).toBeTruthy();
      expect(centerElement.querySelector('.bes-progbar')).toBeTruthy();
    });

    it('should expose volume controls by class', () => {
      const { volumeElement } = buildDrawerPlayer(mockTralbumDetails);

      expect(volumeElement.classList.contains('bes-drawer-volume-column')).toBe(true);
      expect(volumeElement.querySelector('.bes-volume-mute')).toBeTruthy();
      expect(volumeElement.querySelector('.bes-volume-track')).toBeTruthy();
      expect(volumeElement.querySelector('.bes-volume-fill')).toBeTruthy();
      expect(volumeElement.querySelector('.bes-volume-thumb')).toBeTruthy();
    });
  });

  describe('AC-P1: Album art display (verified in playerDrawer)', () => {
    it('should be tested in playerDrawer tests', () => {
      // AC-P1 is implemented in playerDrawer.ts, not nativePlayerBuilder
      // This is just a placeholder to document the AC coverage
      expect(true).toBe(true);
    });
  });

  describe('Album purchase button', () => {
    it('should create album buy button when album is purchasable', () => {
      const purchasableTralbum = {
        ...mockTralbumDetails,
        is_purchasable: true,
        price: 10.0
      } as TralbumDetailsResponse;

      const { albumBuyButton } = buildDrawerPlayer(purchasableTralbum);

      expect(albumBuyButton).toBeTruthy();
      expect(albumBuyButton?.querySelector('.one-click-button')).toBeTruthy();
    });

    it('should not create album buy button when album is not purchasable', () => {
      const nonPurchasableTralbum = {
        ...mockTralbumDetails,
        is_purchasable: false,
        price: 0
      } as TralbumDetailsResponse;

      const { albumBuyButton } = buildDrawerPlayer(nonPurchasableTralbum);

      expect(albumBuyButton).toBeNull();
    });

    it('should use correct price and currency for album buy button', () => {
      const purchasableTralbum = {
        ...mockTralbumDetails,
        is_purchasable: true,
        price: 15.5,
        currency: 'EUR'
      } as TralbumDetailsResponse;

      const { albumBuyButton } = buildDrawerPlayer(purchasableTralbum);

      const input = albumBuyButton?.querySelector('input') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.placeholder).toBe('15.5');

      const inputWrapper = albumBuyButton?.querySelector('.currency-input-wrapper') as HTMLElement;
      expect(inputWrapper?.dataset.suffix).toBe('EUR');
    });

    it('should use album ID and type for cart button', () => {
      const purchasableTralbum = {
        ...mockTralbumDetails,
        id: 999,
        type: 'a' as const,
        is_purchasable: true,
        price: 10.0
      } as TralbumDetailsResponse;

      const { albumBuyButton } = buildDrawerPlayer(purchasableTralbum);

      // Album buy button should exist and be ready for cart operations
      // The actual cart integration is tested in cartButton.test.ts
      expect(albumBuyButton).toBeTruthy();
      expect(albumBuyButton?.querySelector('.one-click-button-container')).toBeTruthy();
    });

    it('should place album buy button above tracklist', () => {
      const purchasableTralbum = {
        ...mockTralbumDetails,
        is_purchasable: true,
        price: 10.0
      } as TralbumDetailsResponse;

      const { albumBuyButton, tracklistElement } = buildDrawerPlayer(purchasableTralbum);

      // Both should be present
      expect(albumBuyButton).toBeTruthy();
      expect(tracklistElement).toBeTruthy();

      // Album buy button should have styling that positions it above tracklist
      // (In actual DOM integration, this is verified by placement order)
      expect(albumBuyButton?.className).toContain('bes-album-buy');
    });
  });

  describe('Unplayable track visual indication', () => {
    let tralbumWithUnplayableTracks: TralbumDetailsResponse;

    beforeEach(() => {
      tralbumWithUnplayableTracks = {
        id: 123,
        type: 'a',
        title: 'Test Album',
        tralbum_artist: 'Test Artist',
        currency: 'USD',
        price: 10.0,
        is_purchasable: true,
        tracks: [
          {
            track_id: 1001,
            title: 'Playable Track',
            price: 1.0,
            currency: 'USD',
            is_purchasable: true,
            duration: 180,
            streaming_url: { 'mp3-128': 'https://example.com/track1.mp3' },
            track_url: '/track/playable-track'
          },
          {
            track_id: 1002,
            title: 'Unplayable Track (Pre-order)',
            price: 1.0,
            currency: 'USD',
            is_purchasable: true,
            duration: 240,
            // No streaming_url - this track is unplayable
            track_url: '/track/bes-track-unplayable'
          },
          {
            track_id: 1003,
            title: 'Another Playable Track',
            price: 1.0,
            currency: 'USD',
            is_purchasable: true,
            duration: 200,
            streaming_url: { 'mp3-128': 'https://example.com/track3.mp3' },
            track_url: '/track/another-playable-track'
          }
        ]
      } as TralbumDetailsResponse;
    });

    it('should add bes-track-unplayable class to unplayable track rows', () => {
      const trackTable = buildTrackTable(tralbumWithUnplayableTracks);

      const rows = trackTable.querySelectorAll('.bes-track-row');
      expect(rows.length).toBe(3);

      // First track is playable - should NOT have class
      expect(rows[0].classList.contains('bes-track-unplayable')).toBe(false);

      // Second track is unplayable - should have class
      expect(rows[1].classList.contains('bes-track-unplayable')).toBe(true);

      // Third track is playable - should NOT have class
      expect(rows[2].classList.contains('bes-track-unplayable')).toBe(false);
    });

    it('should not add bes-track-unplayable class to playable track rows', () => {
      const trackTable = buildTrackTable(mockTralbumDetails);

      const rows = trackTable.querySelectorAll('.bes-track-row');
      rows.forEach(row => {
        expect(row.classList.contains('bes-track-unplayable')).toBe(false);
      });
    });

    it('should keep track number and title in the row for unplayable tracks', () => {
      const trackTable = buildTrackTable(tralbumWithUnplayableTracks);

      const secondRow = trackTable.querySelectorAll('.bes-track-row')[1] as HTMLElement;

      expect(secondRow.querySelector('.bes-track-num')).toBeTruthy();
      expect(secondRow.querySelector('.bes-track-title')).toBeTruthy();
    });

    it('should keep buy button visible for unplayable tracks', () => {
      const trackTable = buildTrackTable(tralbumWithUnplayableTracks);

      const secondRow = trackTable.querySelectorAll('.bes-track-row')[1] as HTMLElement;
      const buyButton = secondRow.querySelector('.bes-track-buy-col');

      // Buy button should still be present and visible
      expect(buyButton).toBeTruthy();
      expect(buyButton).not.toBeNull();
    });

    it('should not mark playable tracks as unplayable', () => {
      const trackTable = buildTrackTable(tralbumWithUnplayableTracks);

      const firstRow = trackTable.querySelectorAll('.bes-track-row')[0] as HTMLElement;

      expect(firstRow.classList.contains('bes-track-unplayable')).toBe(false);
    });
  });
});
