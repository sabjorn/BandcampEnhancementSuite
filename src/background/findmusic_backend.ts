import Logger from '../logger';
import { exchangeBandcampToken } from '../clients/findmusic';

const log = new Logger();
const FINDMUSIC_BASE_URL = process.env.FINDMUSIC_BASE_URL as string;

export async function processRequest(
  request: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): Promise<boolean> {
  if (request.contentScriptQuery !== 'openFindMusic') return false;

  log.info('Processing openFindMusic request');

  const hasPermissions = await chrome.permissions.contains({
    permissions: ['cookies']
  });

  if (!hasPermissions) {
    log.info('Missing cookies permission, opening permission popup');
    chrome.windows.create({
      url: chrome.runtime.getURL('html/findmusic_permission.html'),
      type: 'popup',
      width: 500,
      height: 650,
      focused: true
    });
    sendResponse({ success: true, needsPermission: true });
    return true;
  }

  exchangeBandcampToken()
    .then(token => {
      const url = `${FINDMUSIC_BASE_URL}/login?bes_token=${encodeURIComponent(token)}`;
      log.info(`Opening FindMusic.club with token`);

      chrome.tabs.create({ url });
      sendResponse({ success: true });
    })
    .catch(error => {
      log.error(`Failed to open FindMusic.club: ${error.message}`);
      sendResponse({ success: false, error: error.message });
    });

  return true;
}

export async function initFindMusicBackend(): Promise<void> {
  log.info('starting FindMusic backend.');
  chrome.runtime.onMessage.addListener(processRequest);
}
