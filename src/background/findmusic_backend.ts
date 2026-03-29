import Logger from '../logger';
import { exchangeBandcampToken } from '../clients/findmusic';

const log = new Logger();
const FINDMUSIC_BASE_URL = process.env.FINDMUSIC_BASE_URL as string;
const FINDMUSIC_ORIGIN = process.env.FINDMUSIC_ORIGIN_PATTERN as string;

export function processRequest(
  request: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  if (request.contentScriptQuery === 'checkFindMusicPermissions') {
    chrome.permissions
      .contains({
        permissions: ['cookies'],
        origins: [FINDMUSIC_ORIGIN]
      })
      .then((granted: boolean) => {
        log.info(`Permission check - granted: ${granted}, origin: ${FINDMUSIC_ORIGIN}`);
        sendResponse({ granted });
      });
    return true;
  }

  if (request.contentScriptQuery === 'autoLoginFindMusic') {
    log.info('Processing autoLoginFindMusic request');

    exchangeBandcampToken()
      .then(token => {
        log.info('Token exchanged successfully for auto-login');
        sendResponse({ success: true, token });
      })
      .catch(error => {
        log.error(`Failed to exchange token for auto-login: ${error.message}`);
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }

  if (request.contentScriptQuery !== 'openFindMusic') return false;

  log.info('Processing openFindMusic request');

  chrome.permissions
    .contains({
      permissions: ['cookies']
    })
    .then((hasPermissions: boolean) => {
      if (!hasPermissions) {
        log.info('Missing cookies permission, opening permission popup');
        chrome.windows.getCurrent((currentWindow: chrome.windows.Window) => {
          const width = 500;
          const height = 650;
          const left = currentWindow.left
            ? Math.round(currentWindow.left + (currentWindow.width! - width) / 2)
            : undefined;
          const top = currentWindow.top
            ? Math.round(currentWindow.top + (currentWindow.height! - height) / 2)
            : undefined;

          chrome.windows.create({
            url: chrome.runtime.getURL('html/findmusic_permission.html'),
            type: 'popup',
            width,
            height,
            left,
            top,
            focused: true
          });
        });
        sendResponse({ success: true, needsPermission: true });
        return;
      }

      exchangeBandcampToken()
        .then(token => {
          const url = `${FINDMUSIC_BASE_URL}/login?bes_token=${encodeURIComponent(token)}`;
          log.info('Opening FindMusic.club with token');

          chrome.tabs.create({ url });
          sendResponse({ success: true });
        })
        .catch(error => {
          log.error(`Failed to open FindMusic.club: ${error.message}`);
          sendResponse({ success: false, error: error.message });
        });
    });

  return true;
}

export async function initFindMusicBackend(): Promise<void> {
  log.info('starting FindMusic backend.');
  chrome.runtime.onMessage.addListener(processRequest);
}
