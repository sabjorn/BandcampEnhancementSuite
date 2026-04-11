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

import {
  createVolumeSlider,
  keydownCallback,
  volumeSliderCallback,
  initPlayer,
  buildKeyHandlersFromSettings,
  updateKeyboardHandlers
} from '../src/player';
import Logger from '../src/logger';
import { KeyboardSettings, KeyboardAction, DEFAULT_KEYBOARD_SETTINGS } from '../src/types/keyboard';

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

  it('should handle keyboard events correctly', () => {
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

  describe('buildKeyHandlersFromSettings', () => {
    it('should build handlers from default settings', () => {
      const handlers = buildKeyHandlersFromSettings(DEFAULT_KEYBOARD_SETTINGS);
      expect(handlers).toBeDefined();
      expect(Object.keys(handlers).length).toBeGreaterThan(0);
    });

    it('should create handler for play/pause action', () => {
      const settings: KeyboardSettings = {
        controls: [
          {
            action: KeyboardAction.PLAY_PAUSE,
            binding: { key: 'p' },
            enabled: true
          }
        ],
        seekStepSize: 10,
        largeSeekStepSize: 30,
        volumeStep: 0.05
      };

      const handlers = buildKeyHandlersFromSettings(settings);
      expect(handlers['p']).toBeDefined();
      expect(typeof handlers['p']).toBe('function');
    });

    it('should not create handler for disabled actions', () => {
      const settings: KeyboardSettings = {
        controls: [
          {
            action: KeyboardAction.PLAY_PAUSE,
            binding: { key: 'p' },
            enabled: false
          }
        ],
        seekStepSize: 10,
        largeSeekStepSize: 30,
        volumeStep: 0.05
      };

      const handlers = buildKeyHandlersFromSettings(settings);
      expect(handlers['p']).toBeUndefined();
    });

    it('should use custom seek step sizes', () => {
      const audio = document.querySelector('audio') as HTMLAudioElement;
      audio.currentTime = 0;

      const customSeekStep = 15;
      const settings: KeyboardSettings = {
        controls: [
          {
            action: KeyboardAction.SEEK_FORWARD,
            binding: { key: 'ArrowRight' },
            enabled: true
          }
        ],
        seekStepSize: customSeekStep,
        largeSeekStepSize: 30,
        volumeStep: 0.05
      };

      const handlers = buildKeyHandlersFromSettings(settings);
      handlers['ArrowRight']();

      expect(audio.currentTime).toBe(customSeekStep);
    });

    it('should use custom volume step', () => {
      const volumeInput = document.querySelector('input.volume') as HTMLInputElement;
      volumeInput.value = '0.5';

      const customVolumeStep = 0.1;
      const settings: KeyboardSettings = {
        controls: [
          {
            action: KeyboardAction.VOLUME_UP,
            binding: { key: 'ArrowUp', shift: true },
            enabled: true
          }
        ],
        seekStepSize: 10,
        largeSeekStepSize: 30,
        volumeStep: customVolumeStep
      };

      const handlers = buildKeyHandlersFromSettings(settings);
      handlers['Shift+ArrowUp']();

      expect(parseFloat(volumeInput.value)).toBe(0.6);
    });

    it('should handle modifier keys in bindings', () => {
      const settings: KeyboardSettings = {
        controls: [
          {
            action: KeyboardAction.SEEK_FORWARD_LARGE,
            binding: { key: 'ArrowRight', shift: true },
            enabled: true
          }
        ],
        seekStepSize: 10,
        largeSeekStepSize: 30,
        volumeStep: 0.05
      };

      const handlers = buildKeyHandlersFromSettings(settings);
      expect(handlers['Shift+ArrowRight']).toBeDefined();
      expect(typeof handlers['Shift+ArrowRight']).toBe('function');
    });
  });

  describe('updateKeyboardHandlers', () => {
    it('should update handlers with new settings', () => {
      const initialSettings: KeyboardSettings = {
        controls: [
          {
            action: KeyboardAction.PLAY_PAUSE,
            binding: { key: 'p' },
            enabled: true
          }
        ],
        seekStepSize: 10,
        largeSeekStepSize: 30,
        volumeStep: 0.05
      };

      const updatedSettings: KeyboardSettings = {
        controls: [
          {
            action: KeyboardAction.PLAY_PAUSE,
            binding: { key: 'x' },
            enabled: true
          }
        ],
        seekStepSize: 10,
        largeSeekStepSize: 30,
        volumeStep: 0.05
      };

      expect(() => updateKeyboardHandlers(initialSettings)).not.toThrow();
      expect(() => updateKeyboardHandlers(updatedSettings)).not.toThrow();
    });
  });
});
