import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';
import { createVolumeSlider, keydownCallback, volumeSliderCallback, initPlayer } from '../src/player';
import Logger from '../src/logger';

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

  it('should test utility functions', () => {
    const volumeSlider = createVolumeSlider();
    expect(volumeSlider.type).toBe('range');
    expect(volumeSlider.min).toBe('0');
    expect(volumeSlider.max).toBe('1');
    expect(volumeSlider.step).toBe('0.01');
    expect(volumeSlider.title).toBe('volume control');
    expect(volumeSlider.classList.contains('volume')).toBe(true);

    const audioElement = document.querySelector('audio') as HTMLAudioElement;
    const mockVolumeEvent = {
      target: { value: '0.8' }
    } as any;

    expect(() => volumeSliderCallback(mockVolumeEvent)).not.toThrow();
    expect(audioElement.volume).toBe(0.8);

    const mockLogger = new Logger();
    const mockKeyHandlers = {
      p: vi.fn(),
      ' ': vi.fn()
    };

    const mockKeyEvent = {
      key: 'p',
      target: document.body,
      preventDefault: vi.fn()
    } as any;

    expect(() => keydownCallback(mockKeyEvent, mockKeyHandlers, false, mockLogger)).not.toThrow();
    expect(mockKeyHandlers['p']).toHaveBeenCalled();
  });
});
