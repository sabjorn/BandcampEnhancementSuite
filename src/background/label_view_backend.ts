import DBUtils from "../utilities";
import Logger from "../logger";

export default class LabelViewBackend {
  public log: Logger;

  constructor() {
    this.log = new Logger();
  }

  init(): void {
    this.log.info("initializing LabelViewBackend");
    chrome.runtime.onConnect.addListener(function(port) {
      if (port.name !== "bandcamplabelview") {
        this.log.error(
          `Unexpected chrome.runtime.onConnect port name: ${port.name}`
        );
      }

      // get values of initial
      port.onMessage.addListener(function(msg) {
        if (msg.query) LabelViewBackend.query("previews", msg.query, port);
        if (msg.toggle) LabelViewBackend.toggle("previews", msg.toggle, port);
        if (msg.setTrue)
          LabelViewBackend.setTrue("previews", msg.setTrue, port);
      });
    });

    chrome.runtime.onInstalled.addListener(function() {
      // Empty listener for onInstalled event
    });
  }

  static async query(storeName: string, key: string, port: chrome.runtime.Port, dbUtils: DBUtils = new DBUtils()): Promise<void> {
    let db = await dbUtils.getDB();
    let value = await db.get(storeName, key);

    if (!value) {
      value = false;
      await db.put(storeName, value, key);
    }

    port.postMessage({ id: { key: key, value: value } });
  }

  static async toggle(storeName: string, key: string, port: chrome.runtime.Port, dbUtils: DBUtils = new DBUtils()): Promise<void> {
    let db = await dbUtils.getDB();
    let value = await db.get(storeName, key);

    value = !value;

    await db.put(storeName, value, key);
    port.postMessage({ id: { key: key, value: value } });
  }

  static async setTrue(storeName: string, key: string, port: chrome.runtime.Port, dbUtils: DBUtils = new DBUtils()): Promise<void> {
    let db = await dbUtils.getDB();
    await db.put(storeName, true, key);
    port.postMessage({ id: { key: key, value: true } });
  }
}
