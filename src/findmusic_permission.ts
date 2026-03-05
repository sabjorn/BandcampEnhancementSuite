import Logger from './logger';
import { exchangeBandcampToken } from './clients/findmusic';

const log = new Logger();
const status = document.getElementById('status')!;
const button = document.getElementById('grant-permission') as HTMLButtonElement;
const cancelButton = document.getElementById('cancel-button')!;

const FINDMUSIC_BASE_URL = process.env.FINDMUSIC_BASE_URL as string;

// Set environment-specific URLs for privacy policy and terms
const privacyLink = document.getElementById('privacy-link') as HTMLAnchorElement;
const termsLink = document.getElementById('terms-link') as HTMLAnchorElement;
if (privacyLink) {
  privacyLink.href = `${FINDMUSIC_BASE_URL}/privacy-policy`;
}
if (termsLink) {
  termsLink.href = `${FINDMUSIC_BASE_URL}/terms-of-use`;
}

// Cancel button handler
cancelButton.addEventListener('click', () => {
  log.info('User cancelled FindMusic.club authorization');
  window.close();
});

// Authorize button handler
button.addEventListener('click', async () => {
  try {
    status.textContent = 'Requesting permission...';
    status.classList.add('show');
    button.disabled = true;

    const granted = await chrome.permissions.request({
      permissions: ['cookies'],
      origins: [process.env.FINDMUSIC_ORIGIN_PATTERN as string]
    });

    if (granted) {
      status.textContent = 'Permission granted! Logging in to FindMusic.club...';
      log.info('User granted FindMusic.club permissions');

      const token = await exchangeBandcampToken();
      const url = `${FINDMUSIC_BASE_URL}/bes-login?bes_token=${encodeURIComponent(token)}`;

      // Open FindMusic in a new tab in the main browser window
      chrome.tabs.create({ url });

      // Close the popup
      window.close();
    } else {
      status.textContent = 'Permission denied. Please try again.';
      log.warn('User denied FindMusic.club permissions');
      button.disabled = false;
    }
  } catch (error) {
    log.error(`Error requesting permission: ${error}`);
    status.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    button.disabled = false;
  }
});
