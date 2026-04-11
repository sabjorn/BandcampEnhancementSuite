import Logger from '../logger';
import { getFindMusicToken, hasFindMusicPermissions } from '../clients/findmusic';

const log = new Logger();

export function processRequest(
  request: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  if (request.contentScriptQuery !== 'postCache') return false;

  const { url, method, requestBody, responseBody } = request;
  log.debug(`Cache backend received: ${method} ${url}`);
  log.debug(`Request body size: ${requestBody.length} bytes, Response body size: ${responseBody.length} bytes`);

  postCacheToFindMusic(url, method, requestBody, responseBody)
    .then(() => {
      log.debug(`Cache backend successfully processed: ${method} ${url}`);
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
    const hasPermissions = await hasFindMusicPermissions();
    if (!hasPermissions) {
      log.debug(`Skipping cache post for ${method} ${url} - no FindMusic permissions`);
      return;
    }

    log.debug(`Posting to FindMusic API cache endpoint: ${method} ${url}`);
    const token = await getFindMusicToken();

    if (!token) {
      log.warn(`No token available for cache post despite permissions being granted`);
      return;
    }

    const cacheEndpoint = `${process.env.FINDMUSIC_BASE_URL}/api/cache`;
    const response = await fetch(cacheEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        url,
        method,
        body: requestBody,
        rawResponse: responseBody
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error(`FindMusic.club cache API error for ${method} ${url}: ${response.status} ${errorText}`);
      throw new Error(`Failed to post cache: ${response.status} ${response.statusText}`);
    }

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
