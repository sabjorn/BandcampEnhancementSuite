import Logger from '../logger.js';
import { getDB } from '../utilities.js';

interface Config {
  displayWaveform: boolean;
  albumPurchasedDuringCheckout: boolean;
  albumOnCheckoutDisabled: boolean;
  albumPurchaseTimeDelaySeconds: number;
  installDateUnixSeconds: number;
}

const defaultConfig: Config = {
  displayWaveform: false,
  albumPurchasedDuringCheckout: false,
  albumOnCheckoutDisabled: false,
  albumPurchaseTimeDelaySeconds: 60 * 60 * 24 * 30, // 30 days
  installDateUnixSeconds: Math.floor(Date.now() / 1000)
};

export function connectionListenerCallback(
  port: chrome.runtime.Port,
  log: Logger,
  portState: { port?: chrome.runtime.Port }
): void {
  log.info('connection listener callback');

  if (port.name !== 'bandcamplabelview') {
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

  let db_config = await db.get('config', 'config');
  db_config['displayWaveform'] = !db_config['displayWaveform'];
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
