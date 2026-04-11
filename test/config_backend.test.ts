import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { updateKeyboardSettings, resetKeyboardSettings } from '../src/background/config_backend';
import { DEFAULT_KEYBOARD_SETTINGS, KeyboardSettings, KeyboardAction } from '../src/types/keyboard';
import Logger from '../src/logger';

describe('Config Backend', () => {
  beforeEach(() => {
    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn(),
          set: vi.fn()
        }
      }
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if ('chrome' in globalThis) {
      (globalThis as any).chrome = undefined;
    }
  });

  it('should handle config storage operations', () => {
    expect(globalThis.chrome.storage.local.get).toBeDefined();
    expect(globalThis.chrome.storage.local.set).toBeDefined();
  });

  it('should manage configuration settings', () => {
    const mockConfig = { displayWaveform: true };
    vi.mocked(globalThis.chrome.storage.local.get).mockImplementation((_keys, callback) => {
      if (typeof callback === 'function') {
        callback(mockConfig);
      }
    });

    expect(globalThis.chrome.storage.local.get).toBeDefined();
  });

  describe('updateKeyboardSettings', () => {
    it('should update keyboard settings in database', async () => {
      const mockDb = {
        get: vi.fn().mockResolvedValue({ displayWaveform: false }),
        put: vi.fn().mockResolvedValue(undefined)
      };
      const mockPort = {
        postMessage: vi.fn()
      };
      const mockLog = new Logger();

      const customSettings: KeyboardSettings = {
        ...DEFAULT_KEYBOARD_SETTINGS,
        seekStepSize: 15
      };

      await updateKeyboardSettings(mockDb, customSettings, mockLog, mockPort as any);

      expect(mockDb.get).toHaveBeenCalledWith('config', 'config');
      expect(mockDb.put).toHaveBeenCalled();
      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            keyboardSettings: customSettings
          })
        })
      );
    });

    it('should reject invalid settings', async () => {
      const mockDb = {
        get: vi.fn(),
        put: vi.fn()
      };
      const mockPort = {
        postMessage: vi.fn()
      };
      const mockLog = new Logger();

      const invalidSettings: KeyboardSettings = {
        controls: [],
        seekStepSize: 0,
        largeSeekStepSize: 30,
        volumeStep: 0.05
      };

      await updateKeyboardSettings(mockDb, invalidSettings, mockLog, mockPort as any);

      expect(mockDb.put).not.toHaveBeenCalled();
      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          keyboardSettingsError: expect.arrayContaining([expect.stringContaining('Seek step size')])
        })
      );
    });

    it('should reject duplicate key bindings', async () => {
      const mockDb = {
        get: vi.fn(),
        put: vi.fn()
      };
      const mockPort = {
        postMessage: vi.fn()
      };
      const mockLog = new Logger();

      const settingsWithDuplicates: KeyboardSettings = {
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

      await updateKeyboardSettings(mockDb, settingsWithDuplicates, mockLog, mockPort as any);

      expect(mockDb.put).not.toHaveBeenCalled();
      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          keyboardSettingsError: expect.arrayContaining([expect.stringContaining('Duplicate key binding')])
        })
      );
    });
  });

  describe('resetKeyboardSettings', () => {
    it('should reset keyboard settings to defaults', async () => {
      const mockDb = {
        get: vi.fn().mockResolvedValue({ displayWaveform: true, keyboardSettings: { seekStepSize: 15 } }),
        put: vi.fn().mockResolvedValue(undefined)
      };
      const mockPort = {
        postMessage: vi.fn()
      };
      const mockLog = new Logger();

      await resetKeyboardSettings(mockDb, mockLog, mockPort as any);

      expect(mockDb.get).toHaveBeenCalledWith('config', 'config');
      expect(mockDb.put).toHaveBeenCalled();
      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            keyboardSettings: DEFAULT_KEYBOARD_SETTINGS
          })
        })
      );
    });

    it('should work without a port', async () => {
      const mockDb = {
        get: vi.fn().mockResolvedValue({ displayWaveform: true }),
        put: vi.fn().mockResolvedValue(undefined)
      };
      const mockLog = new Logger();

      await resetKeyboardSettings(mockDb, mockLog);

      expect(mockDb.put).toHaveBeenCalled();
    });
  });
});
