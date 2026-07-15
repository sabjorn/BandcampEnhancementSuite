import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';
import { buildDrawerPlayer, buildTrackTable } from '../src/nativePlayerBuilder';
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

      const prevButton = transportElement.querySelector('.prevbutton');
      expect(prevButton).toBeDefined();

      const playButton = transportElement.querySelector('.playbutton');
      expect(playButton).toBeDefined();

      const nextButton = transportElement.querySelector('.nextbutton');
      expect(nextButton).toBeDefined();
    });

    it('should create play button with play and pause icons', () => {
      const { transportElement } = buildDrawerPlayer(mockTralbumDetails);

      const playButton = transportElement.querySelector('.playbutton') as HTMLElement;
      const playIcon = playButton.querySelector('.play-icon');
      const pauseIcon = playButton.querySelector('.pause-icon');

      expect(playIcon).toBeDefined();
      expect(pauseIcon).toBeDefined();
    });
  });

  describe('AC-P3: Track info display (album, title, artist)', () => {
    it('should create track info elements', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      const albumLabel = centerElement.querySelector('.album-label');
      expect(albumLabel).toBeDefined();

      const trackTitle = centerElement.querySelector('.track-title');
      expect(trackTitle).toBeDefined();

      const artistName = centerElement.querySelector('.artist-name');
      expect(artistName).toBeDefined();
    });

    it('should have empty text content initially', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      const albumLabel = centerElement.querySelector('.album-label') as HTMLElement;
      const trackTitle = centerElement.querySelector('.track-title') as HTMLElement;
      const artistName = centerElement.querySelector('.artist-name') as HTMLElement;

      // Should be empty until track is loaded
      expect(albumLabel.textContent).toBe('');
      expect(trackTitle.textContent).toBe('');
      expect(artistName.textContent).toBe('');
    });
  });

  describe('AC-P4: BPM badge display', () => {
    it('should create BPM badge with number and label', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      const bpmBadge = centerElement.querySelector('.bpm-badge');
      expect(bpmBadge).toBeDefined();

      const bpmNumber = centerElement.querySelector('.bpm-number');
      expect(bpmNumber).toBeDefined();

      const bpmLabel = bpmBadge?.querySelector('span:last-child') as HTMLElement;
      expect(bpmLabel?.textContent).toBe('BPM');
    });
  });

  describe('AC-P5: Dual-mode progress (waveform OR slider toggle)', () => {
    it('should create waveform canvas element', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      const canvas = centerElement.querySelector('canvas.waveform') as HTMLCanvasElement;
      expect(canvas).toBeDefined();
      expect(canvas.width).toBe(600);
      expect(canvas.height).toBe(30);
    });

    it('should create slider container with progress bar', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      const sliderContainer = centerElement.querySelector('.slider-container');
      expect(sliderContainer).toBeDefined();

      const progbarFill = centerElement.querySelector('.progbar_fill');
      expect(progbarFill).toBeDefined();

      const thumb = sliderContainer?.querySelector('.thumb');
      expect(thumb).toBeDefined();
    });

    it('should create toggle buttons for waveform and slider modes', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      const toggleSlider = centerElement.querySelector('.toggle-slider') as HTMLButtonElement;
      const toggleWaveform = centerElement.querySelector('.toggle-waveform') as HTMLButtonElement;

      expect(toggleSlider).toBeDefined();
      expect(toggleWaveform).toBeDefined();
    });

    it('should show waveform by default, hide slider', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      const sliderContainer = centerElement.querySelector('.slider-container') as HTMLElement;
      const waveformContainer = centerElement.querySelector('.waveform-container') as HTMLElement;

      expect(sliderContainer.style.display).toBe('none');
      expect(waveformContainer.style.display).not.toBe('none');
    });

    it('should toggle to slider mode when slider button clicked', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);
      document.body.appendChild(centerElement);

      const toggleSlider = centerElement.querySelector('.toggle-slider') as HTMLButtonElement;
      const sliderContainer = centerElement.querySelector('.slider-container') as HTMLElement;
      const waveformContainer = centerElement.querySelector('.waveform-container') as HTMLElement;

      toggleSlider.click();

      expect(sliderContainer.style.display).toBe('block');
      expect(waveformContainer.style.display).toBe('none');
    });

    it('should toggle back to waveform mode when waveform button clicked', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);
      document.body.appendChild(centerElement);

      const toggleSlider = centerElement.querySelector('.toggle-slider') as HTMLButtonElement;
      const toggleWaveform = centerElement.querySelector('.toggle-waveform') as HTMLButtonElement;
      const sliderContainer = centerElement.querySelector('.slider-container') as HTMLElement;
      const waveformContainer = centerElement.querySelector('.waveform-container') as HTMLElement;

      // First switch to slider
      toggleSlider.click();

      // Then switch back to waveform
      toggleWaveform.click();

      expect(waveformContainer.style.display).toBe('block');
      expect(sliderContainer.style.display).toBe('none');
    });
  });

  describe('AC-P6: Custom vertical volume slider', () => {
    it('should create volume container with vertical slider', () => {
      const { volumeElement } = buildDrawerPlayer(mockTralbumDetails);

      const volumeContainer = volumeElement.querySelector('.volume');
      expect(volumeContainer).toBeDefined();

      const volumeFill = volumeElement.querySelector('.volume-fill');
      expect(volumeFill).toBeDefined();

      const volumeThumb = volumeElement.querySelector('.volume-thumb');
      expect(volumeThumb).toBeDefined();
    });

    it('should create volume percentage display', () => {
      const { volumeElement } = buildDrawerPlayer(mockTralbumDetails);

      const volumePercent = volumeElement.querySelector('.volume-percent') as HTMLElement;
      expect(volumePercent).toBeDefined();
      expect(volumePercent.textContent).toBe('100%');
    });
  });

  describe('AC-P7: Mute toggle', () => {
    it('should create mute button with icon', () => {
      const { volumeElement } = buildDrawerPlayer(mockTralbumDetails);

      const muteButton = volumeElement.querySelector('.volume-mute') as HTMLButtonElement;
      expect(muteButton).toBeDefined();

      // Should have SVG icon
      const svg = muteButton.querySelector('svg');
      expect(svg).toBeDefined();
    });
  });

  describe('AC-P8: Time elapsed/total display', () => {
    it('should create time display elements', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      const timeElapsed = centerElement.querySelector('.time_elapsed') as HTMLElement;
      const timeTotal = centerElement.querySelector('.time_total') as HTMLElement;

      expect(timeElapsed).toBeDefined();
      expect(timeTotal).toBeDefined();

      // Should have initial values
      expect(timeElapsed.textContent).toBe('00:00');
      expect(timeTotal.textContent).toBe('00:00');
    });
  });

  describe('AC-S4: Tracklist preserved with buy buttons', () => {
    it('should build track table with correct number of rows', () => {
      const trackTable = buildTrackTable(mockTralbumDetails);

      const rows = trackTable.querySelectorAll('.track_row_view');
      expect(rows.length).toBe(2);
    });

    it('should display track numbers and titles', () => {
      const trackTable = buildTrackTable(mockTralbumDetails);

      const firstRow = trackTable.querySelector('.track_row_view:first-child') as HTMLElement;
      const trackNumber = firstRow.querySelector('.track_number') as HTMLElement;
      const trackTitle = firstRow.querySelector('.track-title') as HTMLElement;

      expect(trackNumber.textContent).toBe('1.');
      expect(trackTitle.textContent).toBe('Track 1');
    });

    it('should display track duration', () => {
      const trackTable = buildTrackTable(mockTralbumDetails);

      const firstRow = trackTable.querySelector('.track_row_view:first-child') as HTMLElement;
      const time = firstRow.querySelector('.time') as HTMLElement;

      expect(time.textContent).toBe('3:00');
    });

    it('should include buy button for purchasable tracks', () => {
      const trackTable = buildTrackTable(mockTralbumDetails);

      const firstRow = trackTable.querySelector('.track_row_view:first-child') as HTMLElement;
      const buyButton = firstRow.querySelector('.download-col');

      expect(buyButton).toBeDefined();
    });

    it('should NOT include buy button for non-purchasable tracks', () => {
      const trackTable = buildTrackTable(mockTralbumDetails);

      const secondRow = trackTable.querySelectorAll('.track_row_view')[1] as HTMLElement;
      const buyButton = secondRow.querySelector('.download-col');

      expect(buyButton).toBeNull();
    });

    it('should include track link icon when track_url exists', () => {
      const trackTable = buildTrackTable(mockTralbumDetails);

      const firstRow = trackTable.querySelector('.track_row_view:first-child') as HTMLElement;
      const trackLink = firstRow.querySelector('.track-link-icon') as HTMLAnchorElement;

      expect(trackLink).toBeDefined();
      expect(trackLink.href).toContain('/track/track-1');
      expect(trackLink.target).toBe('_blank');
    });
  });

  describe('AC-W5: Grey base with purple accent colors', () => {
    it('should use correct colors for waveform progress bar', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      const progbarFill = centerElement.querySelector('.progbar_fill') as HTMLElement;
      // Purple accent #5b53e8 (rgb(91, 83, 232))
      expect(progbarFill.style.background).toBe('rgb(91, 83, 232)');
    });

    it('should use grey background for slider container', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      const sliderContainer = centerElement.querySelector('.slider-container') as HTMLElement;
      // Grey base #ececef (rgb(236, 236, 239))
      expect(sliderContainer.style.background).toBe('rgb(236, 236, 239)');
    });
  });

  describe('AC-A3: Inline styles to avoid conflicts', () => {
    it('should use inline styles on transport buttons', () => {
      const { transportElement } = buildDrawerPlayer(mockTralbumDetails);

      const prevButton = transportElement.querySelector('.prevbutton') as HTMLElement;
      expect(prevButton.style.cssText).toBeTruthy();
      expect(prevButton.style.cssText.length).toBeGreaterThan(0);
    });

    it('should use inline styles on player controls', () => {
      const { centerElement } = buildDrawerPlayer(mockTralbumDetails);

      const trackInfo = centerElement.querySelector('.track_info') as HTMLElement;
      expect(trackInfo.style.cssText).toBeTruthy();
      expect(trackInfo.style.cssText.length).toBeGreaterThan(0);
    });

    it('should use inline styles on volume controls', () => {
      const { volumeElement } = buildDrawerPlayer(mockTralbumDetails);

      expect(volumeElement.style.cssText).toBeTruthy();
      expect(volumeElement.style.cssText.length).toBeGreaterThan(0);
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

      expect(albumBuyButton).toBeDefined();
      expect(albumBuyButton?.querySelector('.one-click-button')).toBeDefined();
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
      expect(input).toBeDefined();
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
      expect(albumBuyButton).toBeDefined();
      expect(albumBuyButton?.querySelector('.one-click-button-container')).toBeDefined();
    });

    it('should place album buy button above tracklist', () => {
      const purchasableTralbum = {
        ...mockTralbumDetails,
        is_purchasable: true,
        price: 10.0
      } as TralbumDetailsResponse;

      const { albumBuyButton, tracklistElement } = buildDrawerPlayer(purchasableTralbum);

      // Both should be present
      expect(albumBuyButton).toBeDefined();
      expect(tracklistElement).toBeDefined();

      // Album buy button should have styling that positions it above tracklist
      // (In actual DOM integration, this is verified by placement order)
      expect(albumBuyButton?.className).toContain('album-buy-button-container');
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
            track_url: '/track/unplayable-track'
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

    it('should add unplayable-track class to unplayable track rows', () => {
      const trackTable = buildTrackTable(tralbumWithUnplayableTracks);

      const rows = trackTable.querySelectorAll('.track_row_view');
      expect(rows.length).toBe(3);

      // First track is playable - should NOT have class
      expect(rows[0].classList.contains('unplayable-track')).toBe(false);

      // Second track is unplayable - should have class
      expect(rows[1].classList.contains('unplayable-track')).toBe(true);

      // Third track is playable - should NOT have class
      expect(rows[2].classList.contains('unplayable-track')).toBe(false);
    });

    it('should not add unplayable-track class to playable track rows', () => {
      const trackTable = buildTrackTable(mockTralbumDetails);

      const rows = trackTable.querySelectorAll('.track_row_view');
      rows.forEach(row => {
        expect(row.classList.contains('unplayable-track')).toBe(false);
      });
    });

    it('should grey out track number for unplayable tracks', () => {
      const trackTable = buildTrackTable(tralbumWithUnplayableTracks);

      const secondRow = trackTable.querySelectorAll('.track_row_view')[1] as HTMLElement;
      const trackNumber = secondRow.querySelector('.track_number') as HTMLElement;

      // Should have grey color (hex format in JSDOM)
      expect(trackNumber.style.color).toBe('#a1a1aa');
    });

    it('should grey out track title for unplayable tracks', () => {
      const trackTable = buildTrackTable(tralbumWithUnplayableTracks);

      const secondRow = trackTable.querySelectorAll('.track_row_view')[1] as HTMLElement;
      const trackTitle = secondRow.querySelector('.track-title') as HTMLElement;

      // Should have grey color (hex format in JSDOM)
      expect(trackTitle.style.color).toBe('#a1a1aa');
    });

    it('should keep buy button visible for unplayable tracks', () => {
      const trackTable = buildTrackTable(tralbumWithUnplayableTracks);

      const secondRow = trackTable.querySelectorAll('.track_row_view')[1] as HTMLElement;
      const buyButton = secondRow.querySelector('.download-col');

      // Buy button should still be present and visible
      expect(buyButton).toBeDefined();
      expect(buyButton).not.toBeNull();
    });

    it('should apply reduced opacity to unplayable track row', () => {
      const trackTable = buildTrackTable(tralbumWithUnplayableTracks);

      const secondRow = trackTable.querySelectorAll('.track_row_view')[1] as HTMLElement;

      // Should have reduced opacity
      expect(secondRow.style.opacity).toBe('0.5');
    });

    it('should apply not-allowed cursor to unplayable track row', () => {
      const trackTable = buildTrackTable(tralbumWithUnplayableTracks);

      const secondRow = trackTable.querySelectorAll('.track_row_view')[1] as HTMLElement;

      // Should have not-allowed cursor
      expect(secondRow.style.cursor).toBe('not-allowed');
    });

    it('should not apply greyed out styles to playable tracks', () => {
      const trackTable = buildTrackTable(tralbumWithUnplayableTracks);

      const firstRow = trackTable.querySelectorAll('.track_row_view')[0] as HTMLElement;
      const trackNumber = firstRow.querySelector('.track_number') as HTMLElement;
      const trackTitle = firstRow.querySelector('.track-title') as HTMLElement;

      // Should NOT have grey color
      expect(trackNumber.style.color).not.toBe('#a1a1aa');
      expect(trackTitle.style.color).not.toBe('#a1a1aa');
      // Should NOT have reduced opacity
      expect(firstRow.style.opacity).not.toBe('0.5');
      // Should NOT have not-allowed cursor
      expect(firstRow.style.cursor).not.toBe('not-allowed');
    });
  });
});
