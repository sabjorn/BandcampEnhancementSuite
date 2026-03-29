import Logger from './logger';

const log = new Logger();
const FINDMUSIC_BASE_URL = process.env.FINDMUSIC_BASE_URL as string;
const BUTTON_ID = 'bes-findmusic-login-button';
let isLoggingIn = false;

async function performLogin() {
  if (isLoggingIn) {
    return;
  }

  isLoggingIn = true;
  log.info('Login button clicked, attempting login');

  const button = document.getElementById(BUTTON_ID) as HTMLButtonElement;
  if (button) {
    button.disabled = true;
    button.textContent = 'Logging in...';
  }

  try {
    const response = await chrome.runtime.sendMessage({
      contentScriptQuery: 'checkFindMusicPermissions'
    });

    if (!response.granted) {
      log.info('FindMusic.club permissions not granted');
      if (button) {
        button.textContent = 'Permission Required';
      }
      return;
    }

    const loginResponse = await chrome.runtime.sendMessage({
      contentScriptQuery: 'autoLoginFindMusic'
    });

    if (!loginResponse.success || !loginResponse.token) {
      log.error(`Login failed: ${loginResponse.error || 'Unknown error'}`);
      if (button) {
        button.disabled = false;
        button.textContent = 'Login Failed - Try Again';
      }
      isLoggingIn = false;
      return;
    }

    const url = `${FINDMUSIC_BASE_URL}/login?bes_token=${encodeURIComponent(loginResponse.token)}`;
    log.info('Login successful, redirecting');
    window.location.href = url;
  } catch (error) {
    log.error(`Error during login: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (button) {
      button.disabled = false;
      button.textContent = 'Login Error - Try Again';
    }
    isLoggingIn = false;
  }
}

function injectLoginButton() {
  if (!window.location.pathname.includes('/guide')) {
    const existingButton = document.getElementById(BUTTON_ID);
    if (existingButton) {
      existingButton.remove();
    }
    return;
  }

  if (document.getElementById(BUTTON_ID)) {
    return;
  }

  log.info('Injecting login button on guide page');

  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.textContent = 'Login with Bandcamp Enhancement Suite';
  button.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    padding: 12px 24px;
    background: #1ea0c3;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: background 0.2s;
  `;

  button.addEventListener('mouseenter', () => {
    if (!button.disabled) {
      button.style.background = '#1890b0';
    }
  });

  button.addEventListener('mouseleave', () => {
    if (!button.disabled) {
      button.style.background = '#1ea0c3';
    }
  });

  button.addEventListener('click', performLogin);

  document.body.appendChild(button);
}

let lastPathname = window.location.pathname;

function checkUrlChange() {
  if (window.location.pathname !== lastPathname) {
    lastPathname = window.location.pathname;
    injectLoginButton();
  }
}

const urlCheckInterval = setInterval(checkUrlChange, 100);

setTimeout(() => clearInterval(urlCheckInterval), 10000);

const observer = new MutationObserver(() => {
  injectLoginButton();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    injectLoginButton();
    observer.observe(document.body, { childList: true, subtree: true });
  });
} else {
  injectLoginButton();
  observer.observe(document.body, { childList: true, subtree: true });
}

window.addEventListener('popstate', injectLoginButton);

const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function(...args) {
  originalPushState.apply(this, args);
  injectLoginButton();
};

history.replaceState = function(...args) {
  originalReplaceState.apply(this, args);
  injectLoginButton();
};
