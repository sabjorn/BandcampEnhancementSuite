import { openDB } from "idb";
import Logger from "../logger";
const log = new Logger();

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
      // upgrade old storage
      const storeName = "previews";
      chrome.storage.sync.get(storeName, function(result) {
        try {
          if (!isEmpty(result)) {
            result[storeName].forEach(function(item, index) {
              LabelViewBackend.setVal(storeName, true, item);
            });
          }
        } catch (e) {
          this.log.error(e);
        }
      });
    });
  }

  static async getDB(storeName) {
    const dbName = "BandcampEnhancementSuite";
    const version = 1;

    const db = await openDB(dbName, version, {
      upgrade(db, oldVersion, newVersion, transaction) {
        const store = db.createObjectStore(storeName);
      },
      blocked() {},
      blocking() {},
      terminated() {}
    });

    return db;
  }

  static async setVal(storeName, val, key) {
    let db = await LabelViewBackend.getDB(storeName);
    const tx = db.transaction(storeName, "readwrite");
    const store = await tx.store;
    const value = await store.put(val, key);
    await tx.done;
  }

  static async getVal(storeName, key) {
    let db = await LabelViewBackend.getDB(storeName);
    const value = await db.get(storeName, key);
    return value;
  }

  static async query(storeName, key, port) {
    let value = await LabelViewBackend.getVal(storeName, key);

    if (!value) {
      value = false;
      await LabelViewBackend.setVal(storeName, value, key);
    }

    port.postMessage({ id: { key: key, value: value } });
  }

  static async toggle(storeName, key, port) {
    let value = await LabelViewBackend.getVal(storeName, key);
    value = !value;
    await LabelViewBackend.setVal(storeName, value, key);
    port.postMessage({ id: { key: key, value: value } });
  }

  static async setTrue(storeName, key, port) {
    await LabelViewBackend.setVal(storeName, true, key);
    port.postMessage({ id: { key: key, value: true } });
  }
}
