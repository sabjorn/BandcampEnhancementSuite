import { describe, it, expect } from 'vitest';
import {
  KeyBinding,
  KeyboardAction,
  KeyboardSettings,
  DEFAULT_KEYBOARD_SETTINGS,
  keyBindingToString,
  keyBindingsEqual,
  validateKeyboardSettings
} from '../src/types/keyboard';

describe('Keyboard Settings', () => {
  describe('keyBindingToString', () => {
    it('should convert simple key binding to string', () => {
      const binding: KeyBinding = { key: 'p' };
      expect(keyBindingToString(binding)).toBe('p');
    });

    it('should convert space key to "Space"', () => {
      const binding: KeyBinding = { key: ' ' };
      expect(keyBindingToString(binding)).toBe('Space');
    });

    it('should convert key binding with shift to string', () => {
      const binding: KeyBinding = { key: 'ArrowRight', shift: true };
      expect(keyBindingToString(binding)).toBe('Shift+ArrowRight');
    });

    it('should convert key binding with multiple modifiers to string', () => {
      const binding: KeyBinding = { key: 'p', ctrl: true, shift: true };
      expect(keyBindingToString(binding)).toBe('Ctrl+Shift+p');
    });

    it('should order modifiers correctly', () => {
      const binding: KeyBinding = { key: 'a', meta: true, ctrl: true, alt: true, shift: true };
      expect(keyBindingToString(binding)).toBe('Alt+Ctrl+Shift+Meta+a');
    });
  });

  describe('keyBindingsEqual', () => {
    it('should return true for identical bindings', () => {
      const a: KeyBinding = { key: 'p', shift: true };
      const b: KeyBinding = { key: 'p', shift: true };
      expect(keyBindingsEqual(a, b)).toBe(true);
    });

    it('should return false for different keys', () => {
      const a: KeyBinding = { key: 'p' };
      const b: KeyBinding = { key: 'q' };
      expect(keyBindingsEqual(a, b)).toBe(false);
    });

    it('should return false for different modifiers', () => {
      const a: KeyBinding = { key: 'p', shift: true };
      const b: KeyBinding = { key: 'p', ctrl: true };
      expect(keyBindingsEqual(a, b)).toBe(false);
    });

    it('should handle undefined modifiers as false', () => {
      const a: KeyBinding = { key: 'p' };
      const b: KeyBinding = { key: 'p', shift: false };
      expect(keyBindingsEqual(a, b)).toBe(true);
    });
  });

  describe('validateKeyboardSettings', () => {
    it('should validate default settings without errors', () => {
      const errors = validateKeyboardSettings(DEFAULT_KEYBOARD_SETTINGS);
      expect(errors).toEqual([]);
    });

    it('should detect duplicate key bindings', () => {
      const settings: KeyboardSettings = {
        controls: [
          {
            action: KeyboardAction.PLAY_PAUSE,
            binding: { key: 'p' },
            enabled: true
          },
          {
            action: KeyboardAction.NEXT_TRACK,
            binding: { key: 'p' },
            enabled: true
          }
        ],
        seekStepSize: 10,
        largeSeekStepSize: 30,
        volumeStep: 0.05
      };

      const errors = validateKeyboardSettings(settings);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Duplicate key binding');
    });

    it('should not report duplicates for disabled controls', () => {
      const settings: KeyboardSettings = {
        controls: [
          {
            action: KeyboardAction.PLAY_PAUSE,
            binding: { key: 'p' },
            enabled: true
          },
          {
            action: KeyboardAction.NEXT_TRACK,
            binding: { key: 'p' },
            enabled: false
          }
        ],
        seekStepSize: 10,
        largeSeekStepSize: 30,
        volumeStep: 0.05
      };

      const errors = validateKeyboardSettings(settings);
      expect(errors).toEqual([]);
    });

    it('should validate seek step size', () => {
      const settings: KeyboardSettings = {
        controls: [],
        seekStepSize: 0,
        largeSeekStepSize: 30,
        volumeStep: 0.05
      };

      const errors = validateKeyboardSettings(settings);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Seek step size must be between 0 and 60 seconds');
    });

    it('should reject seek step size above maximum', () => {
      const settings: KeyboardSettings = {
        controls: [],
        seekStepSize: 100,
        largeSeekStepSize: 30,
        volumeStep: 0.05
      };

      const errors = validateKeyboardSettings(settings);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('Seek step size must be between 0 and 60 seconds'))).toBe(true);
    });

    it('should validate large seek step size', () => {
      const settings: KeyboardSettings = {
        controls: [],
        seekStepSize: 10,
        largeSeekStepSize: -5,
        volumeStep: 0.05
      };

      const errors = validateKeyboardSettings(settings);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('Large seek step size'))).toBe(true);
    });

    it('should reject large seek step size above maximum', () => {
      const settings: KeyboardSettings = {
        controls: [],
        seekStepSize: 10,
        largeSeekStepSize: 500,
        volumeStep: 0.05
      };

      const errors = validateKeyboardSettings(settings);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('Large seek step size must be between 0 and 300 seconds'))).toBe(true);
    });

    it('should validate volume step range', () => {
      const settings: KeyboardSettings = {
        controls: [],
        seekStepSize: 10,
        largeSeekStepSize: 30,
        volumeStep: 1.5
      };

      const errors = validateKeyboardSettings(settings);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('Volume step'))).toBe(true);
    });
  });

  describe('DEFAULT_KEYBOARD_SETTINGS', () => {
    it('should have all required actions defined', () => {
      const actions = DEFAULT_KEYBOARD_SETTINGS.controls.map(c => c.action);

      expect(actions).toContain(KeyboardAction.PLAY_PAUSE);
      expect(actions).toContain(KeyboardAction.PREV_TRACK);
      expect(actions).toContain(KeyboardAction.NEXT_TRACK);
      expect(actions).toContain(KeyboardAction.SEEK_FORWARD);
      expect(actions).toContain(KeyboardAction.SEEK_BACKWARD);
      expect(actions).toContain(KeyboardAction.VOLUME_UP);
      expect(actions).toContain(KeyboardAction.VOLUME_DOWN);
    });

    it('should have all controls enabled by default', () => {
      DEFAULT_KEYBOARD_SETTINGS.controls.forEach(control => {
        expect(control.enabled).toBe(true);
      });
    });

    it('should have reasonable default step sizes', () => {
      expect(DEFAULT_KEYBOARD_SETTINGS.seekStepSize).toBe(10);
      expect(DEFAULT_KEYBOARD_SETTINGS.largeSeekStepSize).toBe(30);
      expect(DEFAULT_KEYBOARD_SETTINGS.volumeStep).toBe(0.05);
    });

    it('should not have duplicate key bindings', () => {
      const errors = validateKeyboardSettings(DEFAULT_KEYBOARD_SETTINGS);
      expect(errors).toEqual([]);
    });
  });
});
