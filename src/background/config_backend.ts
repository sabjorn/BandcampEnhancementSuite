import Logger from "../logger.js";
import DBUtils from "../utilities.js";

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

export default class ConfigBackend {
  public log: Logger;
  public dbUtils: DBUtils;
  public defaultConfig: Config;
  public port?: chrome.runtime.Port;
  public connectionListenerCallback: (port: chrome.runtime.Port) => void;
  public portListenerCallback: (msg: any) => Promise<void>;

  constructor() {
    this.log = new Logger();
    this.dbUtils = new DBUtils();

    this.defaultConfig = defaultConfig;

    this.connectionListenerCallback = ConfigBackend.connectionListenerCallback.bind(
      this
    );

    this.portListenerCallback = ConfigBackend.portListenerCallback.bind(this);
  }

  init(): void {
    this.log.info("initializing ConfigBackend");

    chrome.runtime.onConnect.addListener(this.connectionListenerCallback);
  }

  static connectionListenerCallback(port: chrome.runtime.Port): void {
    this.log.info("connection listener callback");
    if (port.name !== "bandcamplabelview") {
      this.log.error(
        `Unexpected chrome.runtime.onConnect port name: ${port.name}`
      );
      return;
    }

    this.port = port;
    this.port.onMessage.addListener(this.portListenerCallback);
  }

  static async portListenerCallback(msg: any): Promise<void> {
    this.log.info("port listener callback");

    const db = await this.dbUtils.getDB();

    this.setupDB(db);

    if (msg.config) this.synchronizeConfig(db, msg.config);

    if (msg.toggleWaveformDisplay) this.toggleWaveformDisplay(db);

    if (msg.requestConfig) this.broadcastConfig(db);
  }

  async synchronizeConfig(db: any, config: Partial<Config>): Promise<void> {
    let db_config = await db.get("config", "config");
    const merged_config = ConfigBackend.mergeData(db_config, config);

    await db.put("config", merged_config, "config");
    this.port.postMessage({ config: merged_config });
  }

  async toggleWaveformDisplay(db: any): Promise<void> {
    this.log.info("toggleing waveform display");

    let db_config = await db.get("config", "config");
    db_config["displayWaveform"] = !db_config["displayWaveform"];
    await db.put("config", db_config, "config");
    this.port.postMessage({ config: db_config });
  }

  async broadcastConfig(db: any): Promise<void> {
    this.log.info("broadcasting config data");

    const config = await db.get("config", "config");
    this.port.postMessage({ config: config });
  }

  async setupDB(db: any): Promise<void> {
    const dbConfig = await db.get("config", "config");
    const mergedConfig = ConfigBackend.mergeData(this.defaultConfig, dbConfig);
    await db.put("config", mergedConfig, "config");
  }

  static mergeData(reference_config: Config, new_config: Partial<Config>): Config {
    return Object.assign({}, reference_config, new_config);
  }
}
