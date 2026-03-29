import Logger from './logger';

const log = new Logger();
const FINDMUSIC_BASE_URL = process.env.FINDMUSIC_BASE_URL as string;
let hasAttemptedLogin = false;

async function autoLogin() {
  if (!window.location.pathname.includes('/guide')) {
    return;
  }

  if (hasAttemptedLogin) {
    return;
  }

  hasAttemptedLogin = true;
  log.info('FindMusic.club guide page detected, attempting auto-login');

  try {
    const response = await chrome.runtime.sendMessage({
      contentScriptQuery: 'checkFindMusicPermissions'
    });

    if (!response.granted) {
      log.info('FindMusic.club permissions not granted, skipping auto-login');
      return;
    }

    const loginResponse = await chrome.runtime.sendMessage({
      contentScriptQuery: 'autoLoginFindMusic'
    });

    if (!loginResponse.success || !loginResponse.token) {
      log.error(`Auto-login failed: ${loginResponse.error || 'Unknown error'}`);
      return;
    }

    const url = `${FINDMUSIC_BASE_URL}/login?bes_token=${encodeURIComponent(loginResponse.token)}`;
    log.info('Auto-login successful, redirecting to login page');
    window.location.href = url;
  } catch (error) {
    log.error(`Error during auto-login: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoLogin);
} else {
  autoLogin();
}

window.addEventListener('popstate', autoLogin);

const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function(...args) {
  originalPushState.apply(this, args);
  autoLogin();
};

history.replaceState = function(...args) {
  originalReplaceState.apply(this, args);
  autoLogin();
};
