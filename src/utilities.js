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
  return new Promise((resolve, reject) => {
    fetch(`https://${url}/cart/cb`, {
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
      mode: "cors",
      credentials: "include"
    })
      .then(response => {
        if (response.status !== 200) {
          throw `${response.status}: ${response.statusText}`;
        }
        resolve();
      })
      .catch(reject);
  });
}

export function bandcampRequest(url, body, method = "POST") {
  return new Promise((resolve, reject) => {
    fetch(url, {
      headers: {
        accept: "application/json, text/javascript, */*; q=0.01",
        "accept-language": "en-US,en;q=0.9,ar;q=0.8",
        "content-type": "application/x-www-form-urlencoded",
        "sec-ch-ua":
          '"Not?A_Brand";v="8", "Chromium";v="108", "Google Chrome";v="108"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-requested-with": "XMLHttpRequest"
      },
      referrer: url,
      body: body,
      method: method,
      mode: "cors",
      credentials: "include"
    })
      .then(response => {
        if (response.status !== 200) {
          throw `${response.status}: ${response.statusText}`;
        }
        resolve();
      })
      .catch(reject);
  });
}

export function addTrackWishlist(item_id, band_id, fan_id) {
  const url_base = getUrl();
  const url = `https://${url_base}/collect_item_cb`;

  const meta = JSON.parse(
    document.querySelector("#js-crumbs-data").getAttribute("data-crumbs")
  );
  const crumb = meta.collect_item_cb;

  const body = `fan_id=${fan_id}&item_id=${item_id}&item_type=track&band_id=${band_id}&crumb=${crumb}`;
  return bandcampRequest(url, body);
}

export function removeTrackWishlist(item_id, band_id, fan_id) {
  const url_base = getUrl();
  const url = `https://${url_base}/uncollect_item_cb`;

  const meta = JSON.parse(
    document.querySelector("#js-crumbs-data").getAttribute("data-crumbs")
  );
  const crumb = meta.uncollect_item_cb;

  const body = `fan_id=${fan_id}&item_id=${item_id}&item_type=track&band_id=${band_id}&crumb=${crumb}`;
  return bandcampRequest(url, body);
}
// todo: use this to slow down fetch to prevent rate limiting --> https://stackoverflow.com/questions/70595420/how-to-throttle-my-js-api-fetch-requests-using-the-rate-limit-supplied-by-the-h
//function debounce(func, waitFor) {
//    let timeout;
//    return (...args) => new Promise(resolve => {
//        if (timeout) {
//            clearTimeout(timeout);
//        }
//        timeout = setTimeout(() => resolve(func(...args)), waitFor);
//    });
//}

export function getAudioBuffer(src) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        contentScriptQuery: "renderBuffer",
        url: src
      },
      response => {
        return resolve(response);
      }
    );
  });
}
