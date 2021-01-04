import WaveformBackend from "./background/waveform_backend.js";

import { openDB } from "idb";
import Logger from "./logger";
const log = new Logger();

export async function getDB(storeName) {
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

export async function setVal(storeName, val, key) {
  let db = await getDB(storeName);
  const tx = db.transaction(storeName, "readwrite");
  const store = await tx.store;
  const value = await store.put(val, key);
  await tx.done;
}

export async function getVal(storeName, key) {
  let db = await getDB(storeName);
  const value = await db.get(storeName, key);
  return value;
}

export async function query(storeName, key, port) {
  let value = await getVal(storeName, key);

  if (!value) {
    value = false;
    await setVal(storeName, value, key);
  }

  port.postMessage({ id: { key: key, value: value } });
}

export async function toggle(storeName, key, port) {
  let value = await getVal(storeName, key);
  value = !value;
  await setVal(storeName, value, key);
  port.postMessage({ id: { key: key, value: value } });
}

export async function setTrue(storeName, key, port) {
  await setVal(storeName, true, key);
  port.postMessage({ id: { key: key, value: true } });
}

export const init = () => {
  chrome.runtime.onConnect.addListener(function(port) {
    if (port.name !== "bandcamplabelview") {
      log.error(`Unexpected chrome.runtime.onConnect port name: ${port.name}`);
    }

    // get values of initial
    port.onMessage.addListener(function(msg) {
      if (msg.query) query("previews", msg.query, port);
      if (msg.toggle) toggle("previews", msg.toggle, port);
      if (msg.setTrue) setTrue("previews", msg.setTrue, port);
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
            setVal(storeName, true, item);
          });
        }
      } catch (e) {
        log.error(e);
      }
    });
  });
};

window.onload = () => {
  init;

  const wb = new WaveformBackend();
  wb.init();
};
