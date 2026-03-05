import Logger from '../logger';
import { exchangeBandcampToken } from '../clients/findmusic';

const log = new Logger();
const FINDMUSIC_BASE_URL = process.env.FINDMUSIC_BASE_URL as string;

export function processRequest(
  request: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  if (request.contentScriptQuery !== 'openFindMusic') return false;

  log.info('Processing openFindMusic request');

  exchangeBandcampToken()
    .then(token => {
      const url = `${FINDMUSIC_BASE_URL}/bes-login?bes_token=${encodeURIComponent(token)}`;
      log.info(`Opening FindMusic.club with token`);

      chrome.tabs.create({ url });
      sendResponse({ success: true });
    })
    .catch(error => {
      log.error(`Failed to open FindMusic.club: ${error.message}`);

      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: 'FindMusic.club Login Failed',
        message: error.message || 'Could not log in to FindMusic.club. Please make sure you are logged in to Bandcamp.'
      });

      sendResponse({ success: false, error: error.message });
    });

  return true;
}

export async function initFindMusicBackend(): Promise<void> {
  log.info('starting FindMusic backend.');
  chrome.runtime.onMessage.addListener(processRequest);
}
