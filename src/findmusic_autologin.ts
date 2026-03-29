import Logger from './logger';

const log = new Logger();
const FINDMUSIC_BASE_URL = process.env.FINDMUSIC_BASE_URL as string;
const BUTTON_ID = 'bes-findmusic-login-button';
const CONTAINER_MODIFIED_FLAG = 'data-bes-modified';
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
    return;
  }

  const container = document.querySelector('.MuiContainer-root.MuiContainer-maxWidthMd');
  if (!container) {
    return;
  }

  if (container.hasAttribute(CONTAINER_MODIFIED_FLAG)) {
    return;
  }

  const boxToKeep = container.querySelector('.MuiBox-root.css-14jdev5');
  if (!boxToKeep) {
    return;
  }

  log.info('Modifying guide page content and injecting login button');

  const children = Array.from(container.children);
  children.forEach(child => {
    if (child !== boxToKeep) {
      child.remove();
    }
  });

  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.textContent = 'Login with Bandcamp Enhancement Suite';
  button.className = 'MuiButtonBase-root MuiButton-root MuiButton-contained MuiButton-containedPrimary MuiButton-sizeMedium MuiButton-containedSizeMedium MuiButton-colorPrimary MuiButton-root MuiButton-contained MuiButton-containedPrimary MuiButton-sizeMedium MuiButton-containedSizeMedium MuiButton-colorPrimary css-sghohy-MuiButtonBase-root-MuiButton-root';
  button.type = 'button';

  button.addEventListener('click', performLogin);

  container.appendChild(button);
  container.setAttribute(CONTAINER_MODIFIED_FLAG, 'true');
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
