import { openDB, IDBPDatabase } from 'idb';
import Logger from './logger';

interface MouseEventWithOffset extends MouseEvent {
  offsetX: number;
  target: HTMLElement & { offsetWidth: number };
}

export function mousedownCallback(e: MouseEventWithOffset): void {
  const elementOffset: number = e.offsetX;
  const elementWidth: number = e.target.offsetWidth;
  const scaleDuration: number = elementOffset / elementWidth;

  const audio: HTMLAudioElement | null = document.querySelector('audio');
  if (!audio) return;

  const audioDuration: number = audio.duration;
  audio.currentTime = scaleDuration * audioDuration;
}

export async function getDB(_name?: string): Promise<IDBPDatabase> {
  const dbName: string = 'BandcampEnhancementSuite';
  const version: number = 3;

  const db = await openDB(dbName, version, {
    upgrade(db: IDBPDatabase, _oldVersion: number, _newVersion: number | null, _transaction: any): void {
      const stores = db.objectStoreNames;

      if (!stores.contains('previews')) db.createObjectStore('previews');
      if (!stores.contains('config')) db.createObjectStore('config');
      if (!stores.contains('cachedRequests')) db.createObjectStore('cachedRequests');
    },
    blocked(): void {},
    blocking(): void {},
    terminated(): void {}
  });

  return db;
}

export default { getDB };

interface BandFollowInfo {
  tralbum_id?: number;
  tralbum_type?: string;
}

export function extractBandFollowInfo(): BandFollowInfo {
  const element: Element | null = document.querySelector('[data-band-follow-info]');
  if (!element) return {};

  const data: string | null = element.getAttribute('data-band-follow-info');
  if (!data) return {};

  try {
    const bandFollowInfo: BandFollowInfo = JSON.parse(data);
    return bandFollowInfo;
  } catch {
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
  const element: Element | null = document.querySelector('[data-blob]');
  if (!element) return defaultData;

  const data: string | null = element.getAttribute('data-blob');
  if (!data) return defaultData;

  try {
    const pageData: PageData = JSON.parse(data);
    const { fan_tralbum_data } = pageData;

    if (!fan_tralbum_data) {
      return defaultData;
    }

    return fan_tralbum_data;
  } catch {
    return defaultData;
  }
}

export function downloadFile(filename: string, text: string): void {
  const element: HTMLAnchorElement = document.createElement('a');

  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

export function dateString(): string {
  const currentdate: Date = new Date();
  const ye: string = new Intl.DateTimeFormat('en', { year: '2-digit' }).format(currentdate);
  const mo: string = new Intl.DateTimeFormat('en', { month: '2-digit' }).format(currentdate);
  const da: string = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(currentdate);

  return `${ye}-${mo}-${da}`;
}

export function loadJsonFile(): Promise<any> {
  return new Promise((resolve, reject) => {
    const fileInput: HTMLInputElement = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';

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

export function loadTextFile(): Promise<string> {
  return new Promise((resolve, reject) => {
    const fileInput: HTMLInputElement = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt,.json';

    fileInput.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file: File | null = target.files?.[0] || null;
      if (!file) {
        return;
      }

      const reader: FileReader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const result = e.target?.result;
        if (typeof result !== 'string') {
          reject(new Error('Failed to read file as text'));
          return;
        }

        resolve(result);
      };

      reader.onerror = (error: ProgressEvent<FileReader>) => reject(error);
      reader.readAsText(file);
    };

    fileInput.click();
  });
}

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

interface FindMusicTokenData {
  token: string;
  expiresAt: number;
}

export async function storeFindMusicToken(token: string, expiresInSeconds: number = 86400): Promise<void> {
  const db = await getDB();
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  const tokenData: FindMusicTokenData = { token, expiresAt };
  await db.put('config', tokenData, 'findmusicToken');
}

export async function getFindMusicTokenFromStorage(): Promise<string | null> {
  const db = await getDB();
  const tokenData: FindMusicTokenData | undefined = await db.get('config', 'findmusicToken');

  if (!tokenData) return null;

  if (Date.now() >= tokenData.expiresAt) {
    await db.delete('config', 'findmusicToken');
    return null;
  }

  return tokenData.token;
}

export async function clearFindMusicToken(): Promise<void> {
  const db = await getDB();
  await db.delete('config', 'findmusicToken');
}

async function hashRequest(url: string, method: string, body: string): Promise<string> {
  const text = `${method}:${url}:${body}`;
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hasBeenCached(url: string, method: string, body: string): Promise<boolean> {
  try {
    const hash = await hashRequest(url, method, body);
    const db = await getDB();
    const cached = await db.get('cachedRequests', hash);
    return !!cached;
  } catch (_error) {
    return false;
  }
}

async function markAsCached(url: string, method: string, body: string): Promise<void> {
  try {
    const hash = await hashRequest(url, method, body);
    const db = await getDB();
    await db.put('cachedRequests', Date.now(), hash);
  } catch (_error) {
  }
}

const CACHEABLE_URLS = ['/api/mobile/25/tralbum_details'];

function shouldCacheUrl(url: string): boolean {
  return CACHEABLE_URLS.some(pattern => url.includes(pattern));
}

type FetchFunction = (url: string, options?: RequestInit) => Promise<Response>;

const log = new Logger();

function createCachingFetch(): FetchFunction {
  return async (url: string, options?: RequestInit): Promise<Response> => {
    const method = options?.method || 'GET';
    const requestBody = options?.body ? String(options.body) : '';

    if (!shouldCacheUrl(url)) {
      log.debug(`Skipping cache for ${method} ${url} - not in whitelist`);
      return fetch(url, options);
    }

    const alreadyCached = await hasBeenCached(url, method, requestBody);
    if (alreadyCached) {
      log.debug(`Already cached ${method} ${url} - skipping duplicate`);
      return fetch(url, options);
    }

    log.debug(`Caching fetch: ${method} ${url}`);

    const response = await fetch(url, options);
    const clonedResponse = response.clone();
    const responseText = await clonedResponse.text();

    log.debug(`Sending to cache backend: ${method} ${url} (${responseText.length} bytes)`);

    markAsCached(url, method, requestBody);

    chrome.runtime
      .sendMessage({
        contentScriptQuery: 'postCache',
        url: url,
        method: method,
        requestBody: requestBody,
        responseBody: responseText
      })
      .then(() => {
        log.debug(`Successfully cached: ${method} ${url}`);
      })
      .catch((error: Error) => {
        log.warn(`Failed to cache request ${method} ${url}: ${error.message}`);
      });

    return response;
  };
}

function getFetch(cached: boolean): FetchFunction {
  return cached ? createCachingFetch() : createPlainFetch();
}

function createPlainFetch(): FetchFunction {
  return async (url: string, options?: RequestInit): Promise<Response> => {
    return fetch(url, options);
  };
}

export async function cachedFetch(url: string, options?: RequestInit): Promise<Response> {
  const db = await getDB();
  const config = await db.get('config', 'config');
  const cachingEnabled = config?.enableFindMusicCaching ?? false;

  const fetchFn = getFetch(cachingEnabled);
  return fetchFn(url, options);
}

export type { BandFollowInfo, FanTralbumData, MouseEventWithOffset, FindMusicTokenData };
