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

  // Check if permissions are granted before modifying the page
  try {
    const response = await chrome.runtime.sendMessage({
      contentScriptQuery: 'checkFindMusicPermissions'
    });

    if (!response.granted) {
      log.info('FindMusic.club permissions not granted, skipping login button injection');
      return;
    }
  } catch (error) {
    log.error(`Error checking FindMusic permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return;
  }

  log.info('Modifying guide page content and injecting login button');

  // Keep the first child (the graphic at the top)
  const firstChild = container.firstElementChild;

  // Remove all children except the first one
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
  buttonWrapper.style.cursor = 'pointer';
  buttonWrapper.style.padding = '1rem 2rem';
  buttonWrapper.style.backgroundColor = '#1976d2';
  buttonWrapper.style.color = 'white';
  buttonWrapper.style.borderRadius = '4px';
  buttonWrapper.style.boxShadow = '0px 2px 4px rgba(0,0,0,0.2)';
  buttonWrapper.style.transition = 'background-color 0.3s';
  buttonWrapper.addEventListener('mouseenter', () => {
    buttonWrapper.style.backgroundColor = '#1565c0';
  });
  buttonWrapper.addEventListener('mouseleave', () => {
    if (!isLoggingIn) {
      buttonWrapper.style.backgroundColor = '#1976d2';
    }
  });

  const buttonText = document.createElement('p');
  buttonText.style.margin = '0';
  buttonText.style.fontSize = '1rem';
  buttonText.style.fontWeight = '500';
  buttonText.textContent = 'Login with Bandcamp Enhancement Suite';

  buttonWrapper.appendChild(buttonText);
  buttonWrapper.addEventListener('click', performLogin);

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
