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
  const version: number = 2;

  const db = await openDB(dbName, version, {
    upgrade(db: IDBPDatabase, _oldVersion: number, _newVersion: number | null, _transaction: any): void {
      const stores = db.objectStoreNames;

      if (!stores.contains('previews')) db.createObjectStore('previews');
      if (!stores.contains('config')) db.createObjectStore('config');
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

// Fetch function factory - creates appropriate fetch based on caching config
type FetchFunction = (url: string, options?: RequestInit) => Promise<Response>;

const log = new Logger();

function createCachingFetch(): FetchFunction {
  return async (url: string, options?: RequestInit): Promise<Response> => {
    const method = options?.method || 'GET';
    log.debug(`Caching fetch: ${method} ${url}`);

    const response = await fetch(url, options);
    const clonedResponse = response.clone();
    const responseText = await clonedResponse.text();
    const requestBody = options?.body ? String(options.body) : '';

    log.debug(`Sending to cache backend: ${method} ${url} (${responseText.length} bytes)`);

    // Non-blocking cache operation
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

function createPlainFetch(): FetchFunction {
  return async (url: string, options?: RequestInit): Promise<Response> => {
    const method = options?.method || 'GET';
    log.debug(`Plain fetch (caching disabled): ${method} ${url}`);
    return fetch(url, options);
  };
}

// Stateful fetch manager using factory pattern
class FetchManager {
  private currentFetch: FetchFunction;
  private cachingEnabled: boolean;

  constructor() {
    this.cachingEnabled = false;
    this.currentFetch = createPlainFetch();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const db = await getDB();
      const config = await db.get('config', 'config');
      this.updateCachingState(config?.enableFindMusicCaching ?? false);
    } catch (error) {
      log.warn('Failed to initialize fetch manager, defaulting to plain fetch');
    }
  }

  updateCachingState(enabled: boolean): void {
    if (this.cachingEnabled === enabled) return;

    this.cachingEnabled = enabled;
    this.currentFetch = enabled ? createCachingFetch() : createPlainFetch();
    log.info(`Fetch manager updated: caching ${enabled ? 'enabled' : 'disabled'}`);
  }

  async fetch(url: string, options?: RequestInit): Promise<Response> {
    return this.currentFetch(url, options);
  }
}

// Global fetch manager instance
const fetchManager = new FetchManager();

// Export function to update caching state (called when config changes)
export function updateFetchCachingState(enabled: boolean): void {
  fetchManager.updateCachingState(enabled);
}

// Main export - smart fetch that uses current configuration
export async function cachedFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetchManager.fetch(url, options);
}

export type { BandFollowInfo, FanTralbumData, MouseEventWithOffset, FindMusicTokenData };
