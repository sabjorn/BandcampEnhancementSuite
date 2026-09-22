import Logger from './logger';
import { checkFindMusicPermissions } from './utilities';

const log = new Logger();
const FINDMUSIC_BASE_URL = process.env.FINDMUSIC_BASE_URL as string;
const BUTTON_ID = 'bes-findmusic-login-button';
const CONTAINER_MODIFIED_FLAG = 'data-bes-modified';
const BANDCAMP_LOGIN_REQUIRED_MESSAGE = 'You must be signed in to Bandcamp';
let isLoggingIn = false;

async function performLogin() {
  if (isLoggingIn) {
    return;
  }

  isLoggingIn = true;
  log.info('Login button clicked, attempting login');

  const buttonWrapper = document.getElementById(BUTTON_ID);
  const buttonText = buttonWrapper?.querySelector('p');

  if (buttonWrapper) {
    buttonWrapper.style.pointerEvents = 'none';
    buttonWrapper.style.opacity = '0.6';
  }
  if (buttonText) {
    buttonText.textContent = '⏳ Logging in...';
  }

  try {
    if (!(await checkFindMusicPermissions())) {
      log.info('FindMusic.club permissions not granted');
      if (buttonText) {
        buttonText.textContent = '🔒 Permission Required';
      }
      return;
    }

    const loginResponse = await chrome.runtime.sendMessage({
      contentScriptQuery: 'autoLoginFindMusic'
    });

    if (!loginResponse.success || !loginResponse.token) {
      log.error(`Login failed: ${loginResponse.error || 'Unknown error'}`);
      if (buttonWrapper) {
        buttonWrapper.style.pointerEvents = 'auto';
        buttonWrapper.style.opacity = '1';
      }
      if (buttonText) {
        buttonText.textContent = '❌ Login Failed - Try Again';
      }
      isLoggingIn = false;
      return;
    }

    const url = `${FINDMUSIC_BASE_URL}/login?bes_token=${encodeURIComponent(loginResponse.token)}`;
    log.info('Login successful, redirecting');
    window.location.href = url;
  } catch (error) {
    log.error(`Error during login: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (buttonWrapper) {
      buttonWrapper.style.pointerEvents = 'auto';
      buttonWrapper.style.opacity = '1';
    }
    if (buttonText) {
      buttonText.textContent = '❌ Login Error - Try Again';
    }
    isLoggingIn = false;
  }
}

async function injectLoginButton() {
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

  if (!(await checkFindMusicPermissions())) {
    log.info('FindMusic.club permissions not granted, skipping login button injection');
    return;
  }

  const loggedIntoBandcamp = await (async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        contentScriptQuery: 'checkBandcampLogin'
      });
      return Boolean(response?.loggedIn);
    } catch (error) {
      log.error(`Error checking Bandcamp login: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  })();

  log.info('Modifying guide page content and injecting login button');

  const firstChild = container.firstElementChild;

  const children = Array.from(container.children);
  children.forEach(child => {
    if (child !== firstChild) {
      child.remove();
    }
  });

  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.justifyContent = 'center';
  buttonContainer.style.marginTop = '2rem';

  const buttonWrapper = document.createElement('div');
  buttonWrapper.id = BUTTON_ID;
  buttonWrapper.style.position = 'relative';
  buttonWrapper.style.padding = '1rem 2rem';
  buttonWrapper.style.color = 'white';
  buttonWrapper.style.borderRadius = '4px';
  buttonWrapper.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.2)';
  buttonWrapper.style.transition = 'background-color 0.3s';

  if (loggedIntoBandcamp) {
    buttonWrapper.style.cursor = 'pointer';
    buttonWrapper.style.backgroundColor = '#1976d2';
    buttonWrapper.addEventListener('mouseenter', () => {
      buttonWrapper.style.backgroundColor = '#1565c0';
    });
    buttonWrapper.addEventListener('mouseleave', () => {
      if (!isLoggingIn) {
        buttonWrapper.style.backgroundColor = '#1976d2';
      }
    });
    buttonWrapper.addEventListener('click', performLogin);
  } else {
    buttonWrapper.style.cursor = 'not-allowed';
    buttonWrapper.style.backgroundColor = '#9e9e9e';
    buttonWrapper.setAttribute('aria-disabled', 'true');

    const tooltip = document.createElement('span');
    tooltip.textContent = BANDCAMP_LOGIN_REQUIRED_MESSAGE;
    tooltip.style.visibility = 'hidden';
    tooltip.style.opacity = '0';
    tooltip.style.transition = 'opacity 0.2s';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.position = 'absolute';
    tooltip.style.zIndex = '1000';
    tooltip.style.bottom = '115%';
    tooltip.style.left = '50%';
    tooltip.style.marginLeft = '-100px';
    tooltip.style.width = '200px';
    tooltip.style.padding = '8px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.backgroundColor = '#333';
    tooltip.style.color = '#fff';
    tooltip.style.fontSize = '0.75rem';
    tooltip.style.lineHeight = '1.4';
    tooltip.style.textAlign = 'left';
    buttonWrapper.appendChild(tooltip);

    buttonWrapper.addEventListener('mouseenter', () => {
      tooltip.style.visibility = 'visible';
      tooltip.style.opacity = '1';
    });
    buttonWrapper.addEventListener('mouseleave', () => {
      tooltip.style.visibility = 'hidden';
      tooltip.style.opacity = '0';
    });
  }

  const buttonText = document.createElement('p');
  buttonText.style.margin = '0';
  buttonText.style.fontSize = '1rem';
  buttonText.style.fontWeight = '500';
  buttonText.textContent = 'Login with Bandcamp Enhancement Suite';

  buttonWrapper.appendChild(buttonText);

  buttonContainer.appendChild(buttonWrapper);
  container.appendChild(buttonContainer);
  container.setAttribute(CONTAINER_MODIFIED_FLAG, 'true');
}

const observer = new MutationObserver(() => {
  void injectLoginButton();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void injectLoginButton();
    observer.observe(document.body, { childList: true, subtree: true });
  });
} else {
  void injectLoginButton();
  observer.observe(document.body, { childList: true, subtree: true });
}
