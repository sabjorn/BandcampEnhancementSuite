import DBUtils from "../utilities";
import Logger from "../logger";

export default class LabelViewBackend {
  constructor() {
    this.log = new Logger();
  }

  init() {
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
      function isEmpty(obj) {
        return Object.keys(obj).length === 0;
      }
    });
  }

  static async query(storeName, key, port, dbUtils = new DBUtils()) {
    let db = await dbUtils.getDB();
    let value = await db.get(storeName, key);

    if (!value) {
      value = false;
      await db.put(storeName, value, key);
    }

    port.postMessage({ id: { key: key, value: value } });
  }

  static async toggle(storeName, key, port, dbUtils = new DBUtils()) {
    let db = await dbUtils.getDB();
    let value = await db.get(storeName, key);

    value = !value;

    await db.put(storeName, value, key);
    port.postMessage({ id: { key: key, value: value } });
  }

  static async setTrue(storeName, key, port, dbUtils = new DBUtils()) {
    let db = await dbUtils.getDB();
    await db.put(storeName, true, key);
    port.postMessage({ id: { key: key, value: true } });
  }
}
