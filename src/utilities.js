import { openDB } from "idb";

export function mousedownCallback(e) {
  const elementOffset = e.offsetX;
  const elementWidth = e.target.offsetWidth;
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

export function extractBandFollowInfo() {
  const data = document
    .querySelector("[data-band-follow-info]")
    .getAttribute("data-band-follow-info");

  if (!data) {
    return {};
  }

  try {
    const bandFollowInfo = JSON.parse(data);
    return bandFollowInfo;
  } catch (error) {
    return {};
  }
}

export function extractFanTralbumData() {
  const defaultData = { is_purchased: false, part_of_purchased_album: false };
  const data = document.querySelector("[data-blob]").getAttribute("data-blob");

  if (!data) {
    return defaultData;
  }

  try {
    const { fan_tralbum_data } = JSON.parse(data);

    if (!fan_tralbum_data) {
      return defaultData;
    }

    return fan_tralbum_data;
  } catch (error) {
    return defaultData;
  }
}

export function getUrl() {
  return window.location.href.split("/")[2];
}

export function addAlbumToCart(
  item_id,
  unit_price,
  item_type = "a",
  url = getUrl()
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
    body: `req=add&item_type=${item_type}&item_id=${item_id}&unit_price=${unit_price}&quantity=1&sync_num=1`,
    method: "POST",
    mode: "cors"
  });
}

export function getTralbumDetails(item_id, item_type = "a") {
  const raw = JSON.stringify({
    tralbum_type: item_type,
    band_id: 12345,
    tralbum_id: item_id
  });

  const requestOptions = {
    method: "POST",
    headers: {
      accept: "application/json",
      host: "bandcamp.com",
      connection: "keep-alive",
      "content-type": "application/json",
      "user-agent": "Bandcamp/218977 CFNetwork/1399 Darwin/22.1.0",
      "accept-language": "en-CA:en-US;q=0.9:en;q=0.8",
      "accept-encoding": "gzip: deflate: br",
      "sec-fetch-mode": "cors"
    },
    body: raw
  };

  return fetch(`/api/mobile/25/tralbum_details`, requestOptions);
}

export function downloadFile(filename, text) {
  var element = document.createElement("a");

  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text)
  );
  element.setAttribute("download", filename);

  element.style.display = "none";
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

export function dateString() {
  const currentdate = new Date();
  const ye = new Intl.DateTimeFormat("en", { year: "2-digit" }).format(
    currentdate
  );
  const mo = new Intl.DateTimeFormat("en", { month: "2-digit" }).format(
    currentdate
  );
  const da = new Intl.DateTimeFormat("en", { day: "2-digit" }).format(
    currentdate
  );

  return `${ye}-${mo}-${da}`;
}

export function loadJsonFile() {
  return new Promise((resolve, reject) => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";

    fileInput.onchange = event => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();

        reader.onload = e => {
          try {
            const jsonObject = JSON.parse(e.target.result);
            resolve(jsonObject);
          } catch (error) {
            reject(error);
          }
        };

        reader.onerror = error => reject(error);
        reader.readAsText(file);
      }
    };

    fileInput.click();
  });
}
