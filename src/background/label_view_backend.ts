import { getDB } from '../utilities';
import Logger from '../logger';

export async function query(storeName: string, key: string, port: chrome.runtime.Port): Promise<void> {
  const db = await getDB();
  let value = await db.get(storeName, key);

  if (!value) {
    value = false;
    await db.put(storeName, value, key);
  }

  port.postMessage({ id: { key: key, value: value } });
}

export async function toggle(storeName: string, key: string, port: chrome.runtime.Port): Promise<void> {
  const db = await getDB();
  let value = await db.get(storeName, key);

  value = !value;

  await db.put(storeName, value, key);
  port.postMessage({ id: { key: key, value: value } });
}

export async function setTrue(storeName: string, key: string, port: chrome.runtime.Port): Promise<void> {
  const db = await getDB();
  await db.put(storeName, true, key);
  port.postMessage({ id: { key: key, value: true } });
}

export async function initLabelViewBackend(): Promise<void> {
  const log = new Logger();

  log.info('initializing LabelViewBackend');

  chrome.runtime.onConnect.addListener(function (port) {
    if (port.name !== 'bes') {
      log.error(`Unexpected chrome.runtime.onConnect port name: ${port.name}`);
    }

    port.onMessage.addListener(function (msg) {
      if (msg.query) query('previews', msg.query, port);
      if (msg.toggle) toggle('previews', msg.toggle, port);
      if (msg.setTrue) setTrue('previews', msg.setTrue, port);
    });
  });

  chrome.runtime.onInstalled.addListener(function () {});
}
