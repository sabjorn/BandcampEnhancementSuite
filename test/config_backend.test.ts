import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  syncDarkThemeRegistration,
  updateKeyboardSettings,
  resetKeyboardSettings,
  togglePlayedCaching,
  enableFindMusicCaching,
  toggleTheme,
  setupDB
} from '../src/background/config_backend';
import { DARK_THEME, LIGHT_THEME } from '../src/types/theme';
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
      },
      scripting: {
        getRegisteredContentScripts: vi.fn().mockResolvedValue([]),
        registerContentScripts: vi.fn().mockResolvedValue(undefined),
        unregisterContentScripts: vi.fn().mockResolvedValue(undefined)
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

  describe('togglePlayedCaching', () => {
    const makeDb = (config: Record<string, unknown>) => ({
      get: vi.fn().mockResolvedValue(config),
      put: vi.fn().mockResolvedValue(undefined)
    });

    it('should default to enabled on a fresh install', async () => {
      const mockDb = makeDb(undefined as any);

      await setupDB(mockDb, new Logger());

      expect(mockDb.put.mock.calls[0][1]).toMatchObject({ enablePlayedCaching: true });
    });

    it('should keep a user opt-out across restarts', async () => {
      const mockDb = makeDb({ enablePlayedCaching: false });

      await setupDB(mockDb, new Logger());

      expect(mockDb.put.mock.calls[0][1]).toMatchObject({ enablePlayedCaching: false });
    });

    it('should leave the script unregistered when the stored theme is light', async () => {
      const mockDb = makeDb({ themeName: LIGHT_THEME.name });

      await setupDB(mockDb, new Logger());

      expect((globalThis.chrome as any).scripting.registerContentScripts).not.toHaveBeenCalled();
    });

    it('should turn played caching off when it is on', async () => {
      const mockDb = makeDb({ enablePlayedCaching: true });
      const mockPort = { postMessage: vi.fn() };

      await togglePlayedCaching(mockDb, new Logger(), mockPort as any);

      expect(mockDb.put).toHaveBeenCalledWith('config', { enablePlayedCaching: false }, 'config');
    });

    it('should turn played caching on when it is off', async () => {
      const mockDb = makeDb({ enablePlayedCaching: false });
      const mockPort = { postMessage: vi.fn() };

      await togglePlayedCaching(mockDb, new Logger(), mockPort as any);

      expect(mockDb.put).toHaveBeenCalledWith('config', { enablePlayedCaching: true }, 'config');
    });

    it('should broadcast the updated config', async () => {
      const mockDb = makeDb({ enablePlayedCaching: true });
      const mockPort = { postMessage: vi.fn() };

      await togglePlayedCaching(mockDb, new Logger(), mockPort as any);

      expect(mockPort.postMessage).toHaveBeenCalledWith({ config: { enablePlayedCaching: false } });
    });

    it('should leave the other caching settings alone', async () => {
      const mockDb = makeDb({
        enablePlayedCaching: true,
        enableMetadataCaching: true,
        enableFetchCaching: true
      });

      await togglePlayedCaching(mockDb, new Logger());

      expect(mockDb.put).toHaveBeenCalledWith(
        'config',
        { enablePlayedCaching: false, enableMetadataCaching: true, enableFetchCaching: true },
        'config'
      );
    });

    it('should be enabled alongside the other caching settings on permission grant', async () => {
      const mockDb = makeDb({
        enablePlayedCaching: false,
        enableMetadataCaching: false,
        enableFetchCaching: false
      });

      await enableFindMusicCaching(mockDb, new Logger());

      expect(mockDb.put).toHaveBeenCalledWith(
        'config',
        { enablePlayedCaching: true, enableMetadataCaching: true, enableFetchCaching: true },
        'config'
      );
    });
  });

  describe('setupDB dark theme registration', () => {
    const makeDb = (config: Record<string, unknown>) => ({
      get: vi.fn().mockResolvedValue(config),
      put: vi.fn().mockResolvedValue(undefined)
    });
    it('should re-register the dark theme script from the stored config', async () => {
      const mockDb = makeDb({ themeName: DARK_THEME.name });

      await setupDB(mockDb, new Logger());

      expect((globalThis.chrome as any).scripting.registerContentScripts).toHaveBeenCalled();
    });
  });

  describe('syncDarkThemeRegistration', () => {
    const scripting = () => (globalThis.chrome as any).scripting;

    it('should register the script when the theme is dark', async () => {
      await syncDarkThemeRegistration(DARK_THEME.name, new Logger());

      expect(scripting().registerContentScripts).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'bes-theme-dark',
          js: ['dist/theme_dark.js'],
          runAt: 'document_start',
          persistAcrossSessions: true
        })
      ]);
    });

    it('should not register a second copy when one is already registered', async () => {
      scripting().getRegisteredContentScripts.mockResolvedValue([{ id: 'bes-theme-dark' }]);

      await syncDarkThemeRegistration(DARK_THEME.name, new Logger());

      expect(scripting().registerContentScripts).not.toHaveBeenCalled();
    });

    it('should unregister when the theme goes back to light', async () => {
      scripting().getRegisteredContentScripts.mockResolvedValue([{ id: 'bes-theme-dark' }]);

      await syncDarkThemeRegistration(LIGHT_THEME.name, new Logger());

      expect(scripting().unregisterContentScripts).toHaveBeenCalledWith({ ids: ['bes-theme-dark'] });
    });

    it('should do nothing when light and nothing is registered', async () => {
      await syncDarkThemeRegistration(LIGHT_THEME.name, new Logger());

      expect(scripting().registerContentScripts).not.toHaveBeenCalled();
      expect(scripting().unregisterContentScripts).not.toHaveBeenCalled();
    });

    it('should swallow a registration failure', async () => {
      scripting().registerContentScripts.mockRejectedValue(new Error('no scripting'));

      await expect(syncDarkThemeRegistration(DARK_THEME.name, new Logger())).resolves.toBeUndefined();
    });
  });

  describe('toggleTheme', () => {
    const setup = (themeName: string) => ({
      mockDb: {
        get: vi.fn().mockResolvedValue({ themeName }),
        put: vi.fn().mockResolvedValue(undefined)
      },
      mockPort: { postMessage: vi.fn() },
      mockLog: new Logger()
    });

    it('should switch from light to dark', async () => {
      const { mockDb, mockPort, mockLog } = setup(LIGHT_THEME.name);

      await toggleTheme(mockDb, mockLog, mockPort as any);

      expect(mockDb.put).toHaveBeenCalledWith('config', { themeName: DARK_THEME.name }, 'config');
    });

    it('should switch from dark back to light', async () => {
      const { mockDb, mockPort, mockLog } = setup(DARK_THEME.name);

      await toggleTheme(mockDb, mockLog, mockPort as any);

      expect(mockDb.put).toHaveBeenCalledWith('config', { themeName: LIGHT_THEME.name }, 'config');
    });

    it('should broadcast the updated config so open tabs re-theme', async () => {
      const { mockDb, mockPort, mockLog } = setup(LIGHT_THEME.name);

      await toggleTheme(mockDb, mockLog, mockPort as any);

      expect(mockPort.postMessage).toHaveBeenCalledWith({ config: { themeName: DARK_THEME.name } });
    });

    it('should register the script when switching to dark', async () => {
      const { mockDb, mockPort, mockLog } = setup(LIGHT_THEME.name);

      await toggleTheme(mockDb, mockLog, mockPort as any);

      expect((globalThis.chrome as any).scripting.registerContentScripts).toHaveBeenCalled();
    });

    it('should unregister the script when switching to light', async () => {
      (globalThis.chrome as any).scripting.getRegisteredContentScripts.mockResolvedValue([{ id: 'bes-theme-dark' }]);
      const { mockDb, mockPort, mockLog } = setup(DARK_THEME.name);

      await toggleTheme(mockDb, mockLog, mockPort as any);

      expect((globalThis.chrome as any).scripting.unregisterContentScripts).toHaveBeenCalled();
    });

    it('should treat a config with no theme yet as light', async () => {
      const mockDb = {
        get: vi.fn().mockResolvedValue({ displayWaveform: true }),
        put: vi.fn().mockResolvedValue(undefined)
      };

      await toggleTheme(mockDb, new Logger());

      expect(mockDb.put).toHaveBeenCalledWith(
        'config',
        expect.objectContaining({ themeName: DARK_THEME.name }),
        'config'
      );
    });
  });
});
