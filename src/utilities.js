import { openDB } from "idb";

export function mousedownCallback(e) {
  const elementOffset = e.offsetX;
  const elementWidth = e.path[1].offsetWidth;
  const scaleDuration = elementOffset / elementWidth;

  let audio = document.querySelector("audio");
  let audioDuration = audio.duration;
  audio.currentTime = scaleDuration * audioDuration;
}

export default class DBUtils {
  constructor() {
    this.openDB = openDB;
  }

  async getDB() {
    const dbName = "BandcampEnhancementSuite";
    const version = 2;

    const db = await this.openDB(dbName, version, {
      upgrade(db, oldVersion, newVersion, transaction) {
        const stores = db.objectStoreNames;

        if (!stores.contains("previews")) db.createObjectStore("previews");

        if (!stores.contains("config")) db.createObjectStore("config");
      },
      blocked() {},
      blocking() {},
      terminated() {}
    });

    return db;
  }
}

export function getClientId() {
  const cart_id = document
    .querySelector("[data-client-id-and-key]")
    .getAttribute("data-client-id-and-key");
  return cart_id.split('"')[1];
}

export function getUrl() {
  return window.location.href.split("/")[2];
}

export function addAlbumToCart(
  item_id,
  unit_price,
  item_type = "a",
  url = getUrl(),
  client_id = getClientId()
) {
  return fetch(`https://${url}/cart/cb`, {
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "content-type": "application/x-www-form-urlencoded",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-requested-with": "XMLHttpRequest"
    },
    referrer: "https://halfpastvibe.bandcamp.com/album/vielen-dank",
    referrerPolicy: "no-referrer-when-downgrade",
    body: `req=add&item_type=${item_type}&item_id=${item_id}&unit_price=${unit_price}&quantity=1&client_id=${client_id}&sync_num=1`,
    method: "POST",
    mode: "cors"
  });
}
