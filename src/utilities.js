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
