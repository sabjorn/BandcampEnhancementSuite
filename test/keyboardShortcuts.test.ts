import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeyboardSettings, KeyboardAction, DEFAULT_KEYBOARD_SETTINGS } from '../src/types/keyboard';
import type { PlayerCommands } from '../src/keyboardShortcuts';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  },
  createLogger: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }))
}));

const settingsFor = (action: KeyboardAction, key: string, shift = false): KeyboardSettings => ({
  controls: [{ action, binding: shift ? { key, shift: true } : { key }, enabled: true }],
  seekStepSize: 10,
  largeSeekStepSize: 30,
  volumeStep: 0.05
});

describe('keyboardShortcuts', () => {
  let shortcuts: typeof import('../src/keyboardShortcuts');
  let commands: PlayerCommands;

  const press = (key: string, modifiers: { shiftKey?: boolean; metaKey?: boolean } = {}) => {
    const event = new KeyboardEvent('keydown', { key, cancelable: true, ...modifiers });
    Object.defineProperty(event, 'target', { value: document.body });
    document.dispatchEvent(event);
    return event;
  };

  beforeEach(async () => {
    vi.resetModules();
    shortcuts = await import('../src/keyboardShortcuts');
    commands = {
      playPause: vi.fn(),
      prevTrack: vi.fn(),
      nextTrack: vi.fn(),
      seekBy: vi.fn(),
      adjustVolumeBy: vi.fn()
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('deciding whether a keypress belongs to the page', () => {
    const focusTargetFrom = (markup: string): EventTarget | null => {
      document.body.innerHTML = markup;
      return document.body.firstElementChild;
    };

    it('should handle shortcuts when nothing on the page holds focus', () => {
      expect(shortcuts.shouldHandleShortcut(document.body)).toBe(true);
    });

    it('should not handle shortcuts while a text field has focus', () => {
      expect(shortcuts.shouldHandleShortcut(focusTargetFrom('<input class="search-bar" type="text" />'))).toBe(false);
    });

    it('should not handle shortcuts while a link has focus', () => {
      expect(shortcuts.shouldHandleShortcut(focusTargetFrom('<a href="/somewhere">a search suggestion</a>'))).toBe(
        false
      );
    });

    it('should not handle shortcuts while a button has focus', () => {
      expect(shortcuts.shouldHandleShortcut(focusTargetFrom('<button>press</button>'))).toBe(false);
    });

    it('should not handle shortcuts for a missing target', () => {
      expect(shortcuts.shouldHandleShortcut(null)).toBe(false);
    });
  });

  describe('mapping settings onto a player', () => {
    it('should bind every enabled control', () => {
      const handlers = shortcuts.buildKeyHandlers(DEFAULT_KEYBOARD_SETTINGS, commands);

      expect(Object.keys(handlers).length).toBe(DEFAULT_KEYBOARD_SETTINGS.controls.length);
    });

    it('should leave disabled controls unbound', () => {
      const settings = settingsFor(KeyboardAction.PLAY_PAUSE, 'p');
      settings.controls[0].enabled = false;

      expect(shortcuts.buildKeyHandlers(settings, commands)['p']).toBeUndefined();
    });

    it('should describe a modified binding the same way a keypress is described', () => {
      const handlers = shortcuts.buildKeyHandlers(settingsFor(KeyboardAction.VOLUME_UP, 'ArrowUp', true), commands);

      expect(handlers['Shift+ArrowUp']).toBeDefined();
    });
  });

  describe('driving a registered player', () => {
    beforeEach(() => {
      shortcuts.updateKeyboardSettings(DEFAULT_KEYBOARD_SETTINGS);
      shortcuts.registerPlayerShortcuts(commands);
    });

    it('should play and pause', () => {
      press(' ');

      expect(commands.playPause).toHaveBeenCalled();
    });

    it('should step tracks', () => {
      press('ArrowDown');
      press('ArrowUp');

      expect(commands.nextTrack).toHaveBeenCalled();
      expect(commands.prevTrack).toHaveBeenCalled();
    });

    it('should seek by the configured step', () => {
      press('ArrowRight');
      press('ArrowLeft');

      expect(commands.seekBy).toHaveBeenCalledWith(10);
      expect(commands.seekBy).toHaveBeenCalledWith(-10);
    });

    it('should seek by the configured large step', () => {
      press('ArrowRight', { shiftKey: true });

      expect(commands.seekBy).toHaveBeenCalledWith(30);
    });

    it('should adjust volume by the configured step', () => {
      press('ArrowUp', { shiftKey: true });
      press('ArrowDown', { shiftKey: true });

      expect(commands.adjustVolumeBy).toHaveBeenCalledWith(0.05);
      expect(commands.adjustVolumeBy).toHaveBeenCalledWith(-0.05);
    });

    it('should claim the keys it acts on', () => {
      expect(press(' ').defaultPrevented).toBe(true);
    });

    it('should leave keys it does not handle alone', () => {
      expect(press('q').defaultPrevented).toBe(false);
    });

    it('should ignore a bare modifier press', () => {
      press('Meta', { metaKey: true });

      expect(commands.playPause).not.toHaveBeenCalled();
    });

    it('should ignore keys while a page control holds focus', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
      Object.defineProperty(event, 'target', { value: input });
      document.dispatchEvent(event);

      expect(commands.playPause).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('changing settings after registration', () => {
    it('should rebind to the new keys', () => {
      shortcuts.registerPlayerShortcuts(commands);

      shortcuts.updateKeyboardSettings(settingsFor(KeyboardAction.PLAY_PAUSE, 'k'));
      press('k');

      expect(commands.playPause).toHaveBeenCalled();
    });

    it('should stop responding to the previous keys', () => {
      shortcuts.updateKeyboardSettings(settingsFor(KeyboardAction.PLAY_PAUSE, 'p'));
      shortcuts.registerPlayerShortcuts(commands);

      shortcuts.updateKeyboardSettings(settingsFor(KeyboardAction.PLAY_PAUSE, 'k'));
      press('p');

      expect(commands.playPause).not.toHaveBeenCalled();
    });

    it('should reach every registered player', () => {
      const second: PlayerCommands = {
        playPause: vi.fn(),
        prevTrack: vi.fn(),
        nextTrack: vi.fn(),
        seekBy: vi.fn(),
        adjustVolumeBy: vi.fn()
      };
      shortcuts.registerPlayerShortcuts(commands, () => false);
      shortcuts.registerPlayerShortcuts(second);

      shortcuts.updateKeyboardSettings(settingsFor(KeyboardAction.PLAY_PAUSE, 'k'));
      press('k');

      expect(second.playPause).toHaveBeenCalled();
    });
  });

  describe('choosing between players', () => {
    it('should ignore a player that is not currently active', () => {
      shortcuts.updateKeyboardSettings(DEFAULT_KEYBOARD_SETTINGS);
      shortcuts.registerPlayerShortcuts(commands, () => false);

      press(' ');

      expect(commands.playPause).not.toHaveBeenCalled();
    });

    it('should give the keys to the most recently registered active player', () => {
      const drawer: PlayerCommands = {
        playPause: vi.fn(),
        prevTrack: vi.fn(),
        nextTrack: vi.fn(),
        seekBy: vi.fn(),
        adjustVolumeBy: vi.fn()
      };
      let drawerOpen = false;

      shortcuts.updateKeyboardSettings(DEFAULT_KEYBOARD_SETTINGS);
      shortcuts.registerPlayerShortcuts(commands);
      shortcuts.registerPlayerShortcuts(drawer, () => drawerOpen);

      press(' ');
      expect(commands.playPause).toHaveBeenCalledTimes(1);
      expect(drawer.playPause).not.toHaveBeenCalled();

      drawerOpen = true;
      press(' ');

      expect(drawer.playPause).toHaveBeenCalledTimes(1);
      expect(commands.playPause).toHaveBeenCalledTimes(1);
    });
  });
});
