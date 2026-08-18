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
