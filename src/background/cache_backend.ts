import Logger from '../logger';
import { getFindMusicToken } from '../clients/findmusic';
import { getDB } from '../utilities';

const log = new Logger();

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
  } catch (error) {
    log.error(`Error checking cache: ${error}`);
    return false;
  }
}

async function markAsCached(url: string, method: string, body: string): Promise<void> {
  try {
    const hash = await hashRequest(url, method, body);
    const db = await getDB();
    await db.put('cachedRequests', Date.now(), hash);
  } catch (error) {
    log.error(`Failed to mark as cached: ${error}`);
  }
}

export function processRequest(
  request: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  if (request.contentScriptQuery !== 'postCache') return false;

  const { url, method, requestBody, responseBody } = request;

  postCacheToFindMusic(url, method, requestBody, responseBody)
    .then(() => {
      sendResponse({ success: true });
    })
    .catch((error: Error) => {
      log.error(`Failed to post cache for ${method} ${url}: ${error.message}`);
      sendResponse({ success: false, error: error.message });
    });

  return true;
}

async function postCacheToFindMusic(
  url: string,
  method: string,
  requestBody: string,
  responseBody: string
): Promise<void> {
  try {
    // Check if already cached
    if (await hasBeenCached(url, method, requestBody)) {
      log.debug(`Already cached ${method} ${url} - skipping duplicate`);
      return;
    }

    const token = await getFindMusicToken();

    if (!token) {
      log.warn(`No token available for cache post despite permissions being granted`);
      return;
    }

    const payload = {
      url,
      method,
      request_data: requestBody,
      response_body: responseBody
    };

    const response = await fetch(`${process.env.FINDMUSIC_BASE_URL}/api/cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error(`FindMusic.club cache API error for ${method} ${url}: ${response.status} ${errorText}`);
      throw new Error(`Failed to post cache: ${response.status} ${response.statusText}`);
    }

    // Mark as cached after successful post
    await markAsCached(url, method, requestBody);

    log.info(`Successfully posted cache to FindMusic.club: ${method} ${url}`);
  } catch (error) {
    if (error instanceof Error) {
      log.error(`Error posting cache for ${method} ${url}: ${error.message}`);
      throw error;
    }
    throw new Error('Unknown error occurred while posting cache');
  }
}

export async function initCacheBackend(): Promise<void> {
  log.info('starting cache backend.');
  chrome.runtime.onMessage.addListener(processRequest);
}
