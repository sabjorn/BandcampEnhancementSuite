import { openDB, IDBPDatabase } from "idb";

interface MouseEventWithOffset extends MouseEvent {
  offsetX: number;
  target: HTMLElement & { offsetWidth: number };
}

export function mousedownCallback(e: MouseEventWithOffset): void {
  const elementOffset: number = e.offsetX;
  const elementWidth: number = e.target.offsetWidth;
  const scaleDuration: number = elementOffset / elementWidth;

  const audio: HTMLAudioElement | null = document.querySelector("audio");
  if (!audio) return;
  
  const audioDuration: number = audio.duration;
  audio.currentTime = scaleDuration * audioDuration;
}

export async function getDB(_name?: string): Promise<IDBPDatabase> {
  const dbName: string = "BandcampEnhancementSuite";
  const version: number = 2;

  const db = await openDB(dbName, version, {
    upgrade(db: IDBPDatabase, _oldVersion: number, _newVersion: number | null, _transaction: any): void {
      const stores = db.objectStoreNames;

      if (!stores.contains("previews")) db.createObjectStore("previews");
      if (!stores.contains("config")) db.createObjectStore("config");
    },
    blocked(): void {},
    blocking(): void {},
    terminated(): void {}
  });

  return db;
}

// For backward compatibility, export a default object with the getDB function
export default { getDB };

interface BandFollowInfo {
  tralbum_id?: number;
  tralbum_type?: string;
}

export function extractBandFollowInfo(): BandFollowInfo {
  const element: Element | null = document.querySelector("[data-band-follow-info]");
  if (!element) return {};
  
  const data: string | null = element.getAttribute("data-band-follow-info");
  if (!data) return {};

  try {
    const bandFollowInfo: BandFollowInfo = JSON.parse(data);
    return bandFollowInfo;
  } catch (_error) {
    return {};
  }
}

interface FanTralbumData {
  is_purchased: boolean;
  part_of_purchased_album: boolean;
}

interface PageData {
  fan_tralbum_data?: FanTralbumData;
}

export function extractFanTralbumData(): FanTralbumData {
  const defaultData: FanTralbumData = { is_purchased: false, part_of_purchased_album: false };
  const element: Element | null = document.querySelector("[data-blob]");
  if (!element) return defaultData;
  
  const data: string | null = element.getAttribute("data-blob");
  if (!data) return defaultData;

  try {
    const pageData: PageData = JSON.parse(data);
    const { fan_tralbum_data } = pageData;

    if (!fan_tralbum_data) {
      return defaultData;
    }

    return fan_tralbum_data;
  } catch (_error) {
    return defaultData;
  }
}

export function getUrl(): string {
  return window.location.href.split("/")[2];
}

export function addAlbumToCart(
  item_id: string | number,
  unit_price: string | number,
  item_type: string = "a",
  url: string = getUrl()
): Promise<Response> {
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

export function getTralbumDetails(item_id: string | number, item_type: string = "a"): Promise<Response> {
  const raw: string = JSON.stringify({
    tralbum_type: item_type,
    band_id: 12345,
    tralbum_id: item_id
  });

  const requestOptions: RequestInit = {
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

export function downloadFile(filename: string, text: string): void {
  const element: HTMLAnchorElement = document.createElement("a");

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

export function dateString(): string {
  const currentdate: Date = new Date();
  const ye: string = new Intl.DateTimeFormat("en", { year: "2-digit" }).format(
    currentdate
  );
  const mo: string = new Intl.DateTimeFormat("en", { month: "2-digit" }).format(
    currentdate
  );
  const da: string = new Intl.DateTimeFormat("en", { day: "2-digit" }).format(
    currentdate
  );

  return `${ye}-${mo}-${da}`;
}

export function loadJsonFile(): Promise<any> {
  return new Promise((resolve, reject) => {
    const fileInput: HTMLInputElement = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";

    fileInput.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file: File | null = target.files?.[0] || null;
      if (file) {
        const reader: FileReader = new FileReader();

        reader.onload = (e: ProgressEvent<FileReader>) => {
          try {
            const result = e.target?.result;
            if (typeof result === 'string') {
              const jsonObject: any = JSON.parse(result);
              resolve(jsonObject);
            } else {
              reject(new Error('Failed to read file as text'));
            }
          } catch (error) {
            reject(error);
          }
        };

        reader.onerror = (error: ProgressEvent<FileReader>) => reject(error);
        reader.readAsText(file);
      }
    };

    fileInput.click();
  });
}

export const CURRENCY_MINIMUMS: Record<string, number> = {
  USD: 0.5,
  AUD: 0.5,
  GBP: 0.25,
  CAD: 1.0,
  EUR: 0.25,
  JPY: 70,
  CZK: 10,
  DKK: 2.5,
  HKD: 2.5,
  HUF: 100,
  ILS: 1.5,
  MXN: 5,
  NZD: 0.5,
  NOK: 3,
  PLN: 3,
  SGD: 1,
  SEK: 3,
  CHF: 0.5
};

export function centreElement(element: HTMLElement): void {
  const windowWidth: number = window.innerWidth;
  const windowHeight: number = window.innerHeight;
  const elementWidth: number = element.offsetWidth;
  const elementHeight: number = element.offsetHeight;

  const left: number = (windowWidth - elementWidth) / 2;
  const top: number = (windowHeight - elementHeight) / 2;

  element.style.position = 'fixed';
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
  element.style.zIndex = '9999';
}

// Export types for use in other files
export type { BandFollowInfo, FanTralbumData, MouseEventWithOffset };
