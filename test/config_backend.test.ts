import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  processRequest,
  initConfigBackend,
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
import { getDB } from '../src/utilities';

vi.mock('../src/utilities', () => ({
  getDB: vi.fn()
}));

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
      const mockLog = new Logger();

      const customSettings: KeyboardSettings = {
        ...DEFAULT_KEYBOARD_SETTINGS,
        seekStepSize: 15
      };

      const response = await updateKeyboardSettings(mockDb, customSettings, mockLog);

      expect(mockDb.get).toHaveBeenCalledWith('config', 'config');
      expect(mockDb.put).toHaveBeenCalled();
      expect(response).toMatchObject({ keyboardSettings: customSettings });
    });

    it('should reject invalid settings', async () => {
      const mockDb = {
        get: vi.fn(),
        put: vi.fn()
      };
      const mockLog = new Logger();

      const invalidSettings: KeyboardSettings = {
        controls: [],
        seekStepSize: 0,
        largeSeekStepSize: 30,
        volumeStep: 0.05
      };

      const response = await updateKeyboardSettings(mockDb, invalidSettings, mockLog);

      expect(mockDb.put).not.toHaveBeenCalled();
      expect(response).toMatchObject({
        keyboardSettingsError: expect.arrayContaining([expect.stringContaining('Seek step size')])
      });
    });

    it('should reject duplicate key bindings', async () => {
      const mockDb = {
        get: vi.fn(),
        put: vi.fn()
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

      const response = await updateKeyboardSettings(mockDb, settingsWithDuplicates, mockLog);

      expect(mockDb.put).not.toHaveBeenCalled();
      expect(response).toMatchObject({
        keyboardSettingsError: expect.arrayContaining([expect.stringContaining('Duplicate key binding')])
      });
    });
  });

  describe('resetKeyboardSettings', () => {
    it('should reset keyboard settings to defaults', async () => {
      const mockDb = {
        get: vi.fn().mockResolvedValue({ displayWaveform: true, keyboardSettings: { seekStepSize: 15 } }),
        put: vi.fn().mockResolvedValue(undefined)
      };
      const mockLog = new Logger();

      const response = await resetKeyboardSettings(mockDb, mockLog);

      expect(mockDb.get).toHaveBeenCalledWith('config', 'config');
      expect(mockDb.put).toHaveBeenCalled();
      expect(response).toMatchObject({ keyboardSettings: DEFAULT_KEYBOARD_SETTINGS });
    });

    it('should hand back the whole config, not just the settings it reset', async () => {
      const mockDb = {
        get: vi.fn().mockResolvedValue({ displayWaveform: true }),
        put: vi.fn().mockResolvedValue(undefined)
      };

      const response = await resetKeyboardSettings(mockDb, new Logger());

      expect(response).toMatchObject({ displayWaveform: true, keyboardSettings: DEFAULT_KEYBOARD_SETTINGS });
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

      await togglePlayedCaching(mockDb, new Logger());

      expect(mockDb.put).toHaveBeenCalledWith('config', { enablePlayedCaching: false }, 'config');
    });

    it('should turn played caching on when it is off', async () => {
      const mockDb = makeDb({ enablePlayedCaching: false });

      await togglePlayedCaching(mockDb, new Logger());

      expect(mockDb.put).toHaveBeenCalledWith('config', { enablePlayedCaching: true }, 'config');
    });

    it('should answer with the updated config', async () => {
      const mockDb = makeDb({ enablePlayedCaching: true });

      const response = await togglePlayedCaching(mockDb, new Logger());

      expect(response).toEqual({ enablePlayedCaching: false });
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

  describe('setupDB keyboard settings', () => {
    const makeDb = (config: Record<string, unknown>) => ({
      get: vi.fn().mockResolvedValue(config),
      put: vi.fn().mockResolvedValue(undefined)
    });

    const storedControls = (...actions: KeyboardAction[]) =>
      DEFAULT_KEYBOARD_SETTINGS.controls
        .filter(control => actions.includes(control.action))
        .map(control => ({ ...control, binding: { ...control.binding } }));

    it('should add controls the stored settings predate', async () => {
      const mockDb = makeDb({
        keyboardSettings: { ...DEFAULT_KEYBOARD_SETTINGS, controls: storedControls(KeyboardAction.PLAY_PAUSE) }
      });

      await setupDB(mockDb, new Logger());

      const { keyboardSettings } = mockDb.put.mock.calls[0][1] as { keyboardSettings: KeyboardSettings };
      expect(keyboardSettings.controls.map(control => control.action)).toEqual(
        expect.arrayContaining([KeyboardAction.PREV_ALBUM, KeyboardAction.NEXT_ALBUM])
      );
    });

    it('should keep the bindings a user has customized', async () => {
      const controls = storedControls(KeyboardAction.PLAY_PAUSE);
      controls[0].binding = { key: 'k' };
      const mockDb = makeDb({ keyboardSettings: { ...DEFAULT_KEYBOARD_SETTINGS, controls } });

      await setupDB(mockDb, new Logger());

      const { keyboardSettings } = mockDb.put.mock.calls[0][1] as { keyboardSettings: KeyboardSettings };
      expect(keyboardSettings.controls[0]).toMatchObject({
        action: KeyboardAction.PLAY_PAUSE,
        binding: { key: 'k' }
      });
    });

    it('should store the defaults on a fresh install', async () => {
      const mockDb = makeDb(undefined as any);

      await setupDB(mockDb, new Logger());

      expect(mockDb.put.mock.calls[0][1]).toMatchObject({ keyboardSettings: DEFAULT_KEYBOARD_SETTINGS });
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

      await toggleTheme(mockDb, mockLog);

      expect(mockDb.put).toHaveBeenCalledWith('config', { themeName: DARK_THEME.name }, 'config');
    });

    it('should switch from dark back to light', async () => {
      const { mockDb, mockPort, mockLog } = setup(DARK_THEME.name);

      await toggleTheme(mockDb, mockLog);

      expect(mockDb.put).toHaveBeenCalledWith('config', { themeName: LIGHT_THEME.name }, 'config');
    });

    it('should answer with the updated config so the caller can re-theme', async () => {
      const { mockDb, mockLog } = setup(LIGHT_THEME.name);

      const response = await toggleTheme(mockDb, mockLog);

      expect(response).toEqual({ themeName: DARK_THEME.name });
    });

    it('should register the script when switching to dark', async () => {
      const { mockDb, mockPort, mockLog } = setup(LIGHT_THEME.name);

      await toggleTheme(mockDb, mockLog);

      expect((globalThis.chrome as any).scripting.registerContentScripts).toHaveBeenCalled();
    });

    it('should unregister the script when switching to light', async () => {
      (globalThis.chrome as any).scripting.getRegisteredContentScripts.mockResolvedValue([{ id: 'bes-theme-dark' }]);
      const { mockDb, mockPort, mockLog } = setup(DARK_THEME.name);

      await toggleTheme(mockDb, mockLog);

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

  describe('processRequest', () => {
    const storedConfig = () => ({ displayWaveform: true, enableFetchCaching: false });
    let db: { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };

    const respond = async (request: any) => {
      const sendResponse = vi.fn();
      const handled = processRequest(request, {} as chrome.runtime.MessageSender, sendResponse);

      if (handled) await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());

      return { handled, response: sendResponse.mock.calls[0]?.[0] };
    };

    beforeEach(async () => {
      db = { get: vi.fn(async () => storedConfig()), put: vi.fn().mockResolvedValue(undefined) };
      vi.mocked(getDB).mockResolvedValue(db as any);
    });

    it('should answer a config request with the stored config', async () => {
      const { response } = await respond({ contentScriptQuery: 'requestConfig' });

      expect(response).toMatchObject({ displayWaveform: true });
    });

    it('should answer a toggle with the config that resulted from it', async () => {
      const { response } = await respond({ contentScriptQuery: 'toggleSetting', setting: 'displayWaveform' });

      expect(db.put).toHaveBeenCalledWith('config', expect.objectContaining({ displayWaveform: false }), 'config');
      expect(response).toMatchObject({ displayWaveform: false });
    });

    it('should route each toggle to its own setting', async () => {
      const { response } = await respond({ contentScriptQuery: 'toggleSetting', setting: 'enableFetchCaching' });

      expect(response).toMatchObject({ displayWaveform: true, enableFetchCaching: true });
    });

    it('should reject a setting it does not know how to toggle', async () => {
      const { response } = await respond({ contentScriptQuery: 'toggleSetting', setting: 'nonsense' });

      expect(db.put).not.toHaveBeenCalled();
      expect(response).toMatchObject({ error: expect.stringContaining('nonsense') });
    });

    it('should answer invalid keyboard settings with the errors and write nothing', async () => {
      const { response } = await respond({
        contentScriptQuery: 'updateKeyboardSettings',
        settings: { controls: [], seekStepSize: 0, largeSeekStepSize: 30, volumeStep: 0.05 }
      });

      expect(db.put).not.toHaveBeenCalled();
      expect(response).toMatchObject({ keyboardSettingsError: expect.any(Array) });
    });

    it('should leave messages addressed to other backends alone', async () => {
      const sendResponse = vi.fn();

      const handled = processRequest(
        { contentScriptQuery: 'queryPreviews', ids: [] },
        {} as chrome.runtime.MessageSender,
        sendResponse
      );

      expect(handled).toBe(false);
      expect(sendResponse).not.toHaveBeenCalled();
    });

    it('should report a store failure instead of hanging the caller', async () => {
      db.get.mockRejectedValueOnce(new Error('InvalidStateError'));

      const { response } = await respond({ contentScriptQuery: 'requestConfig' });

      expect(response).toMatchObject({ error: 'InvalidStateError' });
    });
  });

  describe('initConfigBackend', () => {
    beforeEach(() => {
      (globalThis.chrome as any).runtime = {
        onMessage: { addListener: vi.fn() },
        onConnect: { addListener: vi.fn() }
      };
      vi.mocked(getDB).mockResolvedValue({
        get: vi.fn().mockResolvedValue({}),
        put: vi.fn().mockResolvedValue(undefined)
      } as any);
    });

    it('should register its message listener without yielding first', () => {
      void initConfigBackend();

      expect((globalThis.chrome as any).runtime.onMessage.addListener).toHaveBeenCalledWith(processRequest);
    });

    it('should no longer take part in the shared bes port', () => {
      void initConfigBackend();

      expect((globalThis.chrome as any).runtime.onConnect.addListener).not.toHaveBeenCalled();
    });
  });
});
