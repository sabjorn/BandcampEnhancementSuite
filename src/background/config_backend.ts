import Logger from '../logger';
import { getDB } from '../utilities';
import { KeyboardSettings, DEFAULT_KEYBOARD_SETTINGS, validateKeyboardSettings } from '../types/keyboard';
import { DEFAULT_THEME_NAME, LIGHT_THEME, DARK_THEME } from '../types/theme';

/*
 * The dark theme is applied before first paint by a content script that is registered only while
 * dark mode is on - its presence is the setting, so nothing has to be looked up at document_start.
 * The config below stays the source of truth; this registration is derived from it.
 *
 * Registrations persist across browser restarts but are dropped when the extension updates, so
 * this is re-synced from setupDB on every worker start rather than only on toggle.
 */
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
    // A failure here costs the pre-paint application, not the theme itself - document_end still
    // applies it from config.
    log.error(`Failed to sync the dark theme registration: ${error}`);
  }
}

interface Config {
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

export function connectionListenerCallback(
  port: chrome.runtime.Port,
  log: Logger,
  portState: { port?: chrome.runtime.Port }
): void {
  log.info('connection listener callback');

  if (port.name !== 'bes') {
    log.error(`Unexpected chrome.runtime.onConnect port name: ${port.name}`);
    return;
  }

  portState.port = port;
  portState.port.onMessage.addListener((msg: any) => portListenerCallback(msg, log, portState));
}

export async function portListenerCallback(
  msg: any,
  log: Logger,
  portState: { port?: chrome.runtime.Port }
): Promise<void> {
  log.info('port listener callback');

  const db = await getDB();

  if (msg.config) await synchronizeConfig(db, msg.config, log, portState.port);

  if (msg.toggleWaveformDisplay) await toggleWaveformDisplay(db, log, portState.port);

  if (msg.updateKeyboardSettings) await updateKeyboardSettings(db, msg.updateKeyboardSettings, log, portState.port);

  if (msg.resetKeyboardSettings) await resetKeyboardSettings(db, log, portState.port);

  if (msg.toggleMetadataCaching) await toggleMetadataCaching(db, log, portState.port);

  if (msg.toggleFetchCaching) await toggleFetchCaching(db, log, portState.port);

  if (msg.togglePlayedCaching) await togglePlayedCaching(db, log, portState.port);

  if (msg.toggleTheme) await toggleTheme(db, log, portState.port);

  if (msg.enableFindMusicCaching) await enableFindMusicCaching(db, log, portState.port);

  if (msg.requestConfig) await broadcastConfig(db, log, portState.port);
}

export async function initConfigBackend(): Promise<void> {
  const log = new Logger();
  const portState: { port?: chrome.runtime.Port } = {};

  log.info('initializing ConfigBackend');

  const db = await getDB();
  await setupDB(db, log);
  log.info('Config database initialized');

  chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) =>
    connectionListenerCallback(port, log, portState)
  );
}

export async function synchronizeConfig(
  db: any,
  config: Partial<Config>,
  log: Logger,
  port?: chrome.runtime.Port
): Promise<void> {
  const db_config = await db.get('config', 'config');
  const merged_config = mergeData(db_config, config);

  await db.put('config', merged_config, 'config');
  await syncDarkThemeRegistration(merged_config.themeName, log);
  port?.postMessage({ config: merged_config });
}

export async function toggleWaveformDisplay(db: any, log: Logger, port?: chrome.runtime.Port): Promise<void> {
  log.info('toggling waveform display');

  const db_config = await db.get('config', 'config');
  const newValue = !db_config['displayWaveform'];
  db_config['displayWaveform'] = newValue;

  if (!newValue && db_config['enableMetadataCaching']) {
    db_config['enableMetadataCaching'] = false;
  }

  await db.put('config', db_config, 'config');
  port?.postMessage({ config: db_config });
}

export async function toggleMetadataCaching(db: any, log: Logger, port?: chrome.runtime.Port): Promise<void> {
  log.info('toggling metadata caching');

  const db_config = await db.get('config', 'config');
  const newValue = !db_config['enableMetadataCaching'];
  db_config['enableMetadataCaching'] = newValue;

  if (newValue && !db_config['displayWaveform']) {
    db_config['displayWaveform'] = true;
  }

  await db.put('config', db_config, 'config');
  port?.postMessage({ config: db_config });
}

export async function toggleFetchCaching(db: any, log: Logger, port?: chrome.runtime.Port): Promise<void> {
  log.info('toggling fetch caching');

  const db_config = await db.get('config', 'config');
  db_config['enableFetchCaching'] = !db_config['enableFetchCaching'];
  await db.put('config', db_config, 'config');
  port?.postMessage({ config: db_config });
}

export async function togglePlayedCaching(db: any, log: Logger, port?: chrome.runtime.Port): Promise<void> {
  log.info('toggling played caching');

  const db_config = await db.get('config', 'config');
  db_config['enablePlayedCaching'] = !db_config['enablePlayedCaching'];
  await db.put('config', db_config, 'config');
  port?.postMessage({ config: db_config });
}

export async function toggleTheme(db: any, log: Logger, port?: chrome.runtime.Port): Promise<void> {
  log.info('toggling theme');

  const db_config = await db.get('config', 'config');
  const newThemeName = db_config['themeName'] === DARK_THEME.name ? LIGHT_THEME.name : DARK_THEME.name;
  db_config['themeName'] = newThemeName;

  await db.put('config', db_config, 'config');
  await syncDarkThemeRegistration(newThemeName, log);
  port?.postMessage({ config: db_config });
}

export async function enableFindMusicCaching(db: any, log: Logger, port?: chrome.runtime.Port): Promise<void> {
  log.info('enabling FindMusic.club caching after permission grant');

  const db_config = await db.get('config', 'config');
  db_config['enableMetadataCaching'] = true;
  db_config['enableFetchCaching'] = true;
  db_config['enablePlayedCaching'] = true;
  await db.put('config', db_config, 'config');
  port?.postMessage({ config: db_config });
}

export async function broadcastConfig(db: any, log: Logger, port?: chrome.runtime.Port): Promise<void> {
  log.info('broadcasting config data');

  const config = await db.get('config', 'config');
  port?.postMessage({ config: config });
}

export async function setupDB(db: any, log?: Logger): Promise<void> {
  const dbConfig = await db.get('config', 'config');
  const mergedConfig = mergeData(defaultConfig, dbConfig);
  await db.put('config', mergedConfig, 'config');

  if (log) await syncDarkThemeRegistration(mergedConfig.themeName, log);
}

export function mergeData(reference_config: Config, new_config: Partial<Config>): Config {
  return Object.assign({}, reference_config, new_config);
}

export async function updateKeyboardSettings(
  db: any,
  settings: KeyboardSettings,
  log: Logger,
  port?: chrome.runtime.Port
): Promise<void> {
  log.info('updating keyboard settings');

  const errors = validateKeyboardSettings(settings);
  if (errors.length > 0) {
    log.error(`Invalid keyboard settings: ${errors.join(', ')}`);
    port?.postMessage({ keyboardSettingsError: errors });
    return;
  }

  const db_config = await db.get('config', 'config');
  db_config['keyboardSettings'] = settings;
  await db.put('config', db_config, 'config');
  port?.postMessage({ config: db_config });
}

export async function resetKeyboardSettings(db: any, log: Logger, port?: chrome.runtime.Port): Promise<void> {
  log.info('resetting keyboard settings to defaults');

  const db_config = await db.get('config', 'config');
  db_config['keyboardSettings'] = DEFAULT_KEYBOARD_SETTINGS;
  await db.put('config', db_config, 'config');
  port?.postMessage({ config: db_config });
}
