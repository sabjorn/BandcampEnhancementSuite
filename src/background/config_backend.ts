import Logger from '../logger.js';
import { getDB } from '../utilities.js';
import { KeyboardSettings, DEFAULT_KEYBOARD_SETTINGS, validateKeyboardSettings } from '../types/keyboard.js';

interface Config {
  displayWaveform: boolean;
  enableFindMusicCaching: boolean;
  albumPurchasedDuringCheckout: boolean;
  albumOnCheckoutDisabled: boolean;
  albumPurchaseTimeDelaySeconds: number;
  installDateUnixSeconds: number;
  keyboardSettings?: KeyboardSettings;
}

const defaultConfig: Config = {
  displayWaveform: false,
  enableFindMusicCaching: false,
  albumPurchasedDuringCheckout: false,
  albumOnCheckoutDisabled: false,
  albumPurchaseTimeDelaySeconds: 60 * 60 * 24 * 30,
  installDateUnixSeconds: Math.floor(Date.now() / 1000),
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

  await setupDB(db);

  if (msg.config) await synchronizeConfig(db, msg.config, portState.port);

  if (msg.toggleWaveformDisplay) await toggleWaveformDisplay(db, log, portState.port);

  if (msg.updateKeyboardSettings) await updateKeyboardSettings(db, msg.updateKeyboardSettings, log, portState.port);

  if (msg.resetKeyboardSettings) await resetKeyboardSettings(db, log, portState.port);

  if (msg.toggleFindMusicCaching) await toggleFindMusicCaching(db, log, portState.port);

  if (msg.requestConfig) await broadcastConfig(db, log, portState.port);
}

export async function initConfigBackend(): Promise<void> {
  const log = new Logger();
  const portState: { port?: chrome.runtime.Port } = {};

  log.info('initializing ConfigBackend');

  chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) =>
    connectionListenerCallback(port, log, portState)
  );
}

export async function synchronizeConfig(db: any, config: Partial<Config>, port?: chrome.runtime.Port): Promise<void> {
  const db_config = await db.get('config', 'config');
  const merged_config = mergeData(db_config, config);

  await db.put('config', merged_config, 'config');
  port?.postMessage({ config: merged_config });
}

export async function toggleWaveformDisplay(db: any, log: Logger, port?: chrome.runtime.Port): Promise<void> {
  log.info('toggleing waveform display');

  const db_config = await db.get('config', 'config');
  db_config['displayWaveform'] = !db_config['displayWaveform'];
  await db.put('config', db_config, 'config');
  port?.postMessage({ config: db_config });
}

export async function toggleFindMusicCaching(db: any, log: Logger, port?: chrome.runtime.Port): Promise<void> {
  log.info('toggling FindMusic.club caching');

  const db_config = await db.get('config', 'config');
  db_config['enableFindMusicCaching'] = !db_config['enableFindMusicCaching'];
  await db.put('config', db_config, 'config');
  port?.postMessage({ config: db_config });
}

export async function broadcastConfig(db: any, log: Logger, port?: chrome.runtime.Port): Promise<void> {
  log.info('broadcasting config data');

  const config = await db.get('config', 'config');
  port?.postMessage({ config: config });
}

export async function setupDB(db: any): Promise<void> {
  const dbConfig = await db.get('config', 'config');
  const mergedConfig = mergeData(defaultConfig, dbConfig);
  await db.put('config', mergedConfig, 'config');
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
