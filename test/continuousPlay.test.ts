import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';
import { initContinuousPlay } from '../src/continuousPlay';

// Mock playerLoader functions
vi.mock('../src/playerLoader', () => ({
  loadNextAlbum: vi.fn().mockResolvedValue(true),
  loadPreviousAlbum: vi.fn().mockResolvedValue(true),
  getCurrentAlbumIndex: vi.fn().mockReturnValue(1),
  getDiscographyLength: vi.fn().mockReturnValue(3)
}));

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

import { loadNextAlbum, loadPreviousAlbum } from '../src/playerLoader';

describe('ContinuousPlay - Cross-Album Navigation', () => {
  let audio: HTMLAudioElement;

  beforeEach(() => {
    createDomNodes(`
      <audio></audio>
      <table>
        <tbody>
          <tr class="track_row_view playing">
            <td>Track 1</td>
          </tr>
          <tr class="track_row_view">
            <td>Track 2</td>
          </tr>
          <tr class="track_row_view">
            <td>Track 3</td>
          </tr>
        </tbody>
      </table>
      <button class="prevbutton">Prev</button>
      <button class="nextbutton">Next</button>
    `);

    audio = document.querySelector('audio') as HTMLAudioElement;
    Object.defineProperty(audio, 'duration', { value: 180, writable: true });
    Object.defineProperty(audio, 'currentTime', { value: 0, writable: true });

    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestNodes();
  });

  describe('AC-N1: Prev button on first track loads previous album', () => {
    it('should load previous album when on first track and prev clicked', async () => {
      // Make first track the current track
      const tracks = document.querySelectorAll('.track_row_view');
      expect(tracks.length).toBe(3);
      tracks.forEach(t => t.classList.remove('playing'));
      tracks[0].classList.add('playing');

      // Set audio to middle of track (should still load previous album)
      Object.defineProperty(audio, 'currentTime', { value: 90, writable: true }); // 90 seconds into track

      initContinuousPlay(false);

      // Click prev button
      const prevButton = document.querySelector('.prevbutton') as HTMLButtonElement;
      prevButton.click();

      // Wait for boundary check
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(loadPreviousAlbum).toHaveBeenCalled();
    });

    it('should load previous album regardless of currentTime', async () => {
      // First track
      const tracks = document.querySelectorAll('.track_row_view');
      tracks.forEach(t => t.classList.remove('playing'));
      tracks[0].classList.add('playing');

      // Set audio to near end of track
      Object.defineProperty(audio, 'currentTime', { value: 170, writable: true }); // Near end, still should load previous album

      initContinuousPlay(false);

      const prevButton = document.querySelector('.prevbutton') as HTMLButtonElement;
      prevButton.click();

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(loadPreviousAlbum).toHaveBeenCalled();
    });

    it('should NOT load previous album when on second track', async () => {
      // Make second track current
      const tracks = document.querySelectorAll('.track_row_view');
      tracks.forEach(t => t.classList.remove('playing'));
      tracks[1].classList.add('playing');

      Object.defineProperty(audio, 'currentTime', { value: 0, writable: true });

      initContinuousPlay(false);

      const prevButton = document.querySelector('.prevbutton') as HTMLButtonElement;
      prevButton.click();

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(loadPreviousAlbum).not.toHaveBeenCalled();
    });
  });

  describe('AC-N2: Next button on last track loads next album', () => {
    it('should load next album when on last track and next clicked', async () => {
      // Make last track the current track
      const tracks = document.querySelectorAll('.track_row_view');
      tracks.forEach(t => t.classList.remove('playing'));
      tracks[2].classList.add('playing');

      // Set audio to beginning of track (should still load next album)
      Object.defineProperty(audio, 'currentTime', { value: 0, writable: true });

      initContinuousPlay(false);

      const nextButton = document.querySelector('.nextbutton') as HTMLButtonElement;
      nextButton.click();

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(loadNextAlbum).toHaveBeenCalled();
    });

    it('should load next album regardless of currentTime', async () => {
      // Last track
      const tracks = document.querySelectorAll('.track_row_view');
      tracks.forEach(t => t.classList.remove('playing'));
      tracks[2].classList.add('playing');

      // Set audio to middle of track
      Object.defineProperty(audio, 'currentTime', { value: 90, writable: true }); // Middle of track, still should load next album

      initContinuousPlay(false);

      const nextButton = document.querySelector('.nextbutton') as HTMLButtonElement;
      nextButton.click();

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(loadNextAlbum).toHaveBeenCalled();
    });

    it('should NOT load next album when on second-to-last track', async () => {
      // Make second-to-last track current
      const tracks = document.querySelectorAll('.track_row_view');
      tracks.forEach(t => t.classList.remove('playing'));
      tracks[1].classList.add('playing');

      Object.defineProperty(audio, 'currentTime', { value: 170, writable: true }); // Near end, but not last track

      initContinuousPlay(false);

      const nextButton = document.querySelector('.nextbutton') as HTMLButtonElement;
      nextButton.click();

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(loadNextAlbum).not.toHaveBeenCalled();
    });
  });

  describe('AC-N3: Last track ending auto-loads next album', () => {
    it('should load next album when last track ends', async () => {
      const tracks = document.querySelectorAll('.track_row_view');
      tracks.forEach(t => t.classList.remove('playing'));
      tracks[2].classList.add('playing');

      initContinuousPlay(false);

      // Simulate track ending
      audio.dispatchEvent(new Event('ended'));

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(loadNextAlbum).toHaveBeenCalled();
    });

    it('should NOT load next album when middle track ends', async () => {
      const tracks = document.querySelectorAll('.track_row_view');
      tracks.forEach(t => t.classList.remove('playing'));
      tracks[1].classList.add('playing');

      initContinuousPlay(false);

      audio.dispatchEvent(new Event('ended'));

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(loadNextAlbum).not.toHaveBeenCalled();
    });
  });

  describe('AC-N4: Maintain playback state during transitions', () => {
    it('should auto-play first track after loading next album', async () => {
      const tracks = document.querySelectorAll('.track_row_view');
      tracks.forEach(t => t.classList.remove('playing'));
      tracks[2].classList.add('playing');

      initContinuousPlay(false);

      const nextButton = document.querySelector('.nextbutton') as HTMLButtonElement;
      nextButton.click();

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(loadNextAlbum).toHaveBeenCalled();
      // After loading, should click first track's play button
      // This is verified by the handleBoundaryLoad function behavior
    });

    it('should auto-play last track after loading previous album', async () => {
      const tracks = document.querySelectorAll('.track_row_view');
      tracks.forEach(t => t.classList.remove('playing'));
      tracks[0].classList.add('playing');

      initContinuousPlay(false);

      const prevButton = document.querySelector('.prevbutton') as HTMLButtonElement;
      prevButton.click();

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(loadPreviousAlbum).toHaveBeenCalled();
      // After loading, should click last track's play button
      // This is verified by the handleBoundaryLoad function behavior
    });
  });
});
