import Logger from '../logger';
import { getDB } from '../utilities';
import {
  KeyboardSettings,
  DEFAULT_KEYBOARD_SETTINGS,
  validateKeyboardSettings,
  backfillKeyboardControls
} from '../types/keyboard';
import { DEFAULT_THEME_NAME, LIGHT_THEME, DARK_THEME } from '../types/theme';

const DARK_THEME_SCRIPT_ID = 'bes-theme-dark';
const BANDCAMP_MATCHES = ['http://*.bandcamp.com/*', 'https://*.bandcamp.com/*'];

export async function syncDarkThemeRegistration(themeName: string, log: Logger): Promise<void> {
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [DARK_THEME_SCRIPT_ID] });
    const wantDark = themeName === DARK_THEME.name;

    if (wantDark && existing.length === 0) {
      await chrome.scripting.registerContentScripts([
        {
          id: DARK_THEME_SCRIPT_ID,
          matches: BANDCAMP_MATCHES,
          js: ['dist/theme_dark.js'],
          runAt: 'document_start',
          persistAcrossSessions: true
        }
      ]);
      log.info('Registered the dark theme content script');

      return;
    }

    if (!wantDark && existing.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: [DARK_THEME_SCRIPT_ID] });
      log.info('Unregistered the dark theme content script');
    }
  } catch (error: unknown) {
    log.error(`Failed to sync the dark theme registration: ${error}`);
  }
}

export interface Config {
  displayWaveform: boolean;
  enableMetadataCaching: boolean;
  enableFetchCaching: boolean;
  enablePlayedCaching: boolean;
  albumPurchasedDuringCheckout: boolean;
  albumOnCheckoutDisabled: boolean;
  albumPurchaseTimeDelaySeconds: number;
  installDateUnixSeconds: number;
  themeName: string;
  keyboardSettings?: KeyboardSettings;
}

const defaultConfig: Config = {
  displayWaveform: true,
  enableMetadataCaching: true,
  enableFetchCaching: true,
  enablePlayedCaching: true,
  albumPurchasedDuringCheckout: false,
  albumOnCheckoutDisabled: false,
  albumPurchaseTimeDelaySeconds: 60 * 60 * 24 * 30,
  installDateUnixSeconds: Math.floor(Date.now() / 1000),
  themeName: DEFAULT_THEME_NAME,
  keyboardSettings: DEFAULT_KEYBOARD_SETTINGS
};

const TOGGLES = {
  displayWaveform: toggleWaveformDisplay,
  enableMetadataCaching: toggleMetadataCaching,
  enableFetchCaching: toggleFetchCaching,
  enablePlayedCaching: togglePlayedCaching,
  themeName: toggleTheme
} as const;

export type ToggleName = keyof typeof TOGGLES;

export type ConfigResponse = Config | { keyboardSettingsError: string[] };

function handlerFor(request: any, log: Logger): ((db: any) => Promise<ConfigResponse>) | null {
  switch (request.contentScriptQuery) {
    case 'requestConfig':
      return db => readConfig(db);
    case 'toggleSetting': {
      const toggle = TOGGLES[request.setting as ToggleName];
      if (!toggle) return () => Promise.reject(new Error(`Unknown setting ${request.setting}`));

      return db => toggle(db, log);
    }
    case 'updateKeyboardSettings':
      return db => updateKeyboardSettings(db, request.settings, log);
    case 'resetKeyboardSettings':
      return db => resetKeyboardSettings(db, log);
    default:
      return null;
  }
}

export function processRequest(
  request: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  const log = new Logger();
  const handler = handlerFor(request, log);
  if (!handler) return false;

  (async () => {
    const db = await getDB();
    await ensureSeeded(db);

    return await handler(db);
  })()
    .then(sendResponse)
    .catch((error: Error) => {
      log.error(`${request.contentScriptQuery} failed: ${error.message}`);
      sendResponse({ error: error.message });
    });

  return true;
}

let seedingPromise: Promise<void> | null = null;

function ensureSeeded(db: any): Promise<void> {
  seedingPromise ??= setupDB(db, new Logger());
  return seedingPromise;
}

export async function getConfig(): Promise<Config> {
  const db = await getDB();
  await ensureSeeded(db);
  const stored = await db.get('config', 'config');

  return mergeData(defaultConfig, stored ?? {});
}

export async function initConfigBackend(): Promise<void> {
  const log = new Logger();

  log.info('initializing ConfigBackend');

  chrome.runtime.onMessage.addListener(processRequest);

  await getConfig();
  log.info('Config database initialized');
}

export async function toggleWaveformDisplay(db: any, log: Logger): Promise<Config> {
  log.info('toggling waveform display');

  const db_config = await db.get('config', 'config');
  const newValue = !db_config['displayWaveform'];
  db_config['displayWaveform'] = newValue;

  if (!newValue && db_config['enableMetadataCaching']) {
    db_config['enableMetadataCaching'] = false;
  }

  await db.put('config', db_config, 'config');

  return db_config;
}

export async function toggleMetadataCaching(db: any, log: Logger): Promise<Config> {
  log.info('toggling metadata caching');

  const db_config = await db.get('config', 'config');
  const newValue = !db_config['enableMetadataCaching'];
  db_config['enableMetadataCaching'] = newValue;

  if (newValue && !db_config['displayWaveform']) {
    db_config['displayWaveform'] = true;
  }

  await db.put('config', db_config, 'config');

  return db_config;
}

export async function toggleFetchCaching(db: any, log: Logger): Promise<Config> {
  log.info('toggling fetch caching');

  const db_config = await db.get('config', 'config');
  db_config['enableFetchCaching'] = !db_config['enableFetchCaching'];
  await db.put('config', db_config, 'config');

  return db_config;
}

export async function togglePlayedCaching(db: any, log: Logger): Promise<Config> {
  log.info('toggling played caching');

  const db_config = await db.get('config', 'config');
  db_config['enablePlayedCaching'] = !db_config['enablePlayedCaching'];
  await db.put('config', db_config, 'config');

  return db_config;
}

export async function toggleTheme(db: any, log: Logger): Promise<Config> {
  log.info('toggling theme');

  const db_config = await db.get('config', 'config');
  const newThemeName = db_config['themeName'] === DARK_THEME.name ? LIGHT_THEME.name : DARK_THEME.name;
  db_config['themeName'] = newThemeName;

  await db.put('config', db_config, 'config');
  await syncDarkThemeRegistration(newThemeName, log);

  return db_config;
}

export async function readConfig(db: any): Promise<Config> {
  return await db.get('config', 'config');
}

export async function setupDB(db: any, log: Logger): Promise<void> {
  const dbConfig = await db.get('config', 'config');
  const mergedConfig = mergeData(defaultConfig, dbConfig);
  mergedConfig.keyboardSettings = backfillKeyboardControls(mergedConfig.keyboardSettings ?? DEFAULT_KEYBOARD_SETTINGS);
  await db.put('config', mergedConfig, 'config');

  await syncDarkThemeRegistration(mergedConfig.themeName, log);
}

export function mergeData(reference_config: Config, new_config: Partial<Config>): Config {
  return Object.assign({}, reference_config, new_config);
}

export async function updateKeyboardSettings(
  db: any,
  settings: KeyboardSettings,
  log: Logger
): Promise<ConfigResponse> {
  log.info('updating keyboard settings');

  const errors = validateKeyboardSettings(settings);
  if (errors.length > 0) {
    log.error(`Invalid keyboard settings: ${errors.join(', ')}`);

    return { keyboardSettingsError: errors };
  }

  const db_config = await db.get('config', 'config');
  db_config['keyboardSettings'] = settings;
  await db.put('config', db_config, 'config');

  return db_config;
}

export async function resetKeyboardSettings(db: any, log: Logger): Promise<Config> {
  log.info('resetting keyboard settings to defaults');

  const db_config = await db.get('config', 'config');
  db_config['keyboardSettings'] = DEFAULT_KEYBOARD_SETTINGS;
  await db.put('config', db_config, 'config');

  return db_config;
}
