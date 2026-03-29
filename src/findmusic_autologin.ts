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
    const response = await chrome.runtime.sendMessage({
      contentScriptQuery: 'checkFindMusicPermissions'
    });

    if (!response.granted) {
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

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'MuiBox-root css-13rcduy';
  buttonContainer.style.display = 'flex';
  buttonContainer.style.justifyContent = 'center';

  const buttonWrapper = document.createElement('div');
  buttonWrapper.id = BUTTON_ID;
  buttonWrapper.className = 'MuiPaper-root MuiPaper-elevation MuiPaper-rounded MuiPaper-elevation1 css-11lia1c';
  buttonWrapper.style.cursor = 'pointer';

  const buttonText = document.createElement('p');
  buttonText.className = 'MuiTypography-root MuiTypography-body1 css-gi6oim';
  buttonText.textContent = 'Login with Bandcamp Enhancement Suite';

  buttonWrapper.appendChild(buttonText);
  buttonWrapper.addEventListener('click', performLogin);

  buttonContainer.appendChild(buttonWrapper);
  container.appendChild(buttonContainer);
  container.setAttribute(CONTAINER_MODIFIED_FLAG, 'true');
}

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
