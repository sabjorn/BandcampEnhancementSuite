console.log = function() {}; // disable logging

import { openDB } from "idb";

async function getDB(storeName) {
  const dbName = "BandcampEnhancementSuite";
  const version = 1;

  const db = await openDB(dbName, version, {
    upgrade(db, oldVersion, newVersion, transaction) {
      console.log("creating store");
      const store = db.createObjectStore(storeName);
    },
    blocked() {
      console.log("blocked");
    },
    blocking() {
      console.log("blocking");
    },
    terminated() {
      console.log("terminated");
    }
  });

  return db;
}

async function setVal(storeName, val, key) {
  let db = await getDB(storeName);
  const tx = db.transaction(storeName, "readwrite");
  const store = await tx.store;
  const value = await store.put(val, key);
  await tx.done;
}

async function getVal(storeName, key) {
  let db = await getDB(storeName);
  const value = await db.get(storeName, key);
  return value;
}

async function query(storeName, key, port) {
  let value = await getVal(storeName, key);

  if (!value) {
    value = false;
    setVal(storeName, value, key);
  }

  port.postMessage({ id: { key: key, value: value } });
}

async function toggle(storeName, key, port) {
  let value = await getVal(storeName, key);
  value = !value;
  setVal(storeName, value, key);
  port.postMessage({ id: { key: key, value: value } });
}

async function setTrue(storeName, key, port) {
  setVal(storeName, true, key);
  port.postMessage({ id: { key: key, value: true } });
}

chrome.runtime.onConnect.addListener(function(port) {
  console.log("connected to: ", port.name);
  console.assert(port.name == "bandcamplabelview");

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
      console.error(e);
    }
  });
});
