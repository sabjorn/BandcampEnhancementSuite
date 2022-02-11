import Logger from "../logger.js";
import DBUtils from "../utilities.js";

const defaultConfig = {
  displayWaveform: false,
  albumPurchasedDuringCheckout: false,
  albumOnCheckoutDisabled: false
};

export default class ConfigBackend {
  constructor() {
    this.log = new Logger();
    this.dbUtils = new DBUtils();

    this.defaultConfig = defaultConfig;

    this.connectionListenerCallback = ConfigBackend.connectionListenerCallback.bind(
      this
    );

    this.portListenerCallback = ConfigBackend.portListenerCallback.bind(this);
  }

  init() {
    this.log.info("initializing ConfigBackend");

    chrome.runtime.onConnect.addListener(this.connectionListenerCallback);
  }

  static connectionListenerCallback(port) {
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

  static async portListenerCallback(msg) {
    this.log.info("port listener callback");

    const db = await this.dbUtils.getDB();

    this.setupDB(db);

    if (msg.config) this.synchronizeConfig(db, msg.config);

    if (msg.toggleWaveformDisplay) this.toggleWaveformDisplay(db);

    if (msg.requestConfig) this.broadcastConfig(db);
  }

  async synchronizeConfig(db, config) {
    let db_config = await db.get("config", "config");
    const merged_config = ConfigBackend.mergeData(db_config, config);

    await db.put("config", merged_config, "config");
    this.port.postMessage({ config: merged_config });
  }

  async toggleWaveformDisplay(db) {
    this.log.info("toggleing waveform display");

    let db_config = await db.get("config", "config");
    db_config["displayWaveform"] = !db_config["displayWaveform"];
    await db.put("config", db_config, "config");
    this.port.postMessage({ config: db_config });
  }

  async broadcastConfig(db) {
    this.log.info("broadcasting config data");

    const config = await db.get("config", "config");
    this.port.postMessage({ config: config });
  }

  async setupDB(db) {
    const dbConfig = await db.get("config", "config");
    const mergedConfig = ConfigBackend.mergeData(this.defaultConfig, dbConfig);
    await db.put("config", mergedConfig, "config");
  }

  static mergeData(reference_config, new_config) {
    return Object.assign({}, reference_config, new_config);
  }
}
