import Logger from './logger';
import { exchangeBandcampToken } from './clients/findmusic';

const log = new Logger();
const status = document.getElementById('status')!;
const button = document.getElementById('grant-permission')!;

const FINDMUSIC_BASE_URL = process.env.FINDMUSIC_BASE_URL as string;

button.addEventListener('click', async () => {
  try {
    status.textContent = 'Requesting permission...';

    const granted = await chrome.permissions.request({
      permissions: ['cookies'],
      origins: [process.env.FINDMUSIC_ORIGIN_PATTERN as string]
    });

    if (granted) {
      status.textContent = 'Permission granted! Logging in to FindMusic.club...';
      log.info('User granted FindMusic.club permissions');

      const token = await exchangeBandcampToken();
      const url = `${FINDMUSIC_BASE_URL}/bes-login?bes_token=${encodeURIComponent(token)}`;

      window.location.href = url;
    } else {
      status.textContent = 'Permission denied. Please try again.';
      log.warn('User denied FindMusic.club permissions');
    }
  } catch (error) {
    log.error(`Error requesting permission: ${error}`);
    status.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
});
