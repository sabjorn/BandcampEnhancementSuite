import Logger from '../logger';

const log = new Logger();

interface BcTokenResponse {
  token: string;
  user: {
    id: string;
    username: string;
  };
}

interface BcTokenRequest {
  bc_token: string;
}

/**
 * Requests permissions to access Bandcamp cookies with user explanation
 * @returns true if permissions granted, false if denied
 */
async function requestBandcampPermissions(): Promise<boolean> {
  log.info('Checking for Bandcamp permissions');

  // Check if we already have the cookies permission
  // Note: bandcamp.com host permissions are already required, so we only need to check cookies
  const hasPermissions = await chrome.permissions.contains({
    permissions: ['cookies']
  });

  if (hasPermissions) {
    log.info('Already have cookies permission');
    return true;
  }

  log.info('Requesting Bandcamp permissions from user');

  // Show notification before permission dialog to provide context
  // The browser will then show its own permission dialog with details
  await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'FindMusic.club Permission Request',
    message:
      'To log in to FindMusic.club, we need to read your Bandcamp cookie. ' +
      'Your credentials are only used to create a secure login token and are never stored. ' +
      'Please click "Allow" in the next dialog.'
  });

  // Small delay to let user see the notification before the permission dialog
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Request permission - browser shows its own dialog
  // Note: bandcamp.com is already a required host_permission, so we only need to request:
  // 1. cookies permission (to read cookies from bandcamp.com)
  // 2. findmusic.club origin (optional host permission for API calls)
  const granted = await chrome.permissions.request({
    permissions: ['cookies'],
    origins: ['https://*.findmusic.club/*']
  });

  if (granted) {
    log.info('User granted Bandcamp permissions');
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'FindMusic.club Connected',
      message: 'Successfully connected! Opening FindMusic.club...'
    });
  } else {
    log.warn('User denied Bandcamp permissions');
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'FindMusic.club Access Denied',
      message:
        'Permission was denied. To use FindMusic.club, please click the FindMusic button again ' +
        'and allow access to Bandcamp cookies when prompted.'
    });
  }

  return granted;
}

/**
 * Exchanges a Bandcamp identity cookie for a FindMusic.club JWT token
 * @returns FindMusic.club JWT token
 * @throws Error if no Bandcamp identity cookie found or API request fails
 */
export async function exchangeBandcampToken(): Promise<string> {
  log.info('Attempting to exchange Bandcamp token for FindMusic.club token');

  // Request permissions if we don't have them
  const hasPermission = await requestBandcampPermissions();
  if (!hasPermission) {
    throw new Error(
      'Permission denied. To use FindMusic.club, please allow access to Bandcamp cookies when prompted.'
    );
  }

  // Get Bandcamp identity cookie
  const cookie = await chrome.cookies.get({
    url: 'https://bandcamp.com/',
    name: 'identity'
  });

  if (!cookie || !cookie.value) {
    log.error('No Bandcamp identity cookie found');
    throw new Error('No Bandcamp identity cookie found. Please log in to Bandcamp first.');
  }

  log.debug(`Found Bandcamp identity cookie: ${cookie.value.substring(0, 20)}...`);

  // Exchange token with FindMusic.club API
  try {
    const response = await fetch('https://findmusic.club/api/bctoken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bc_token: cookie.value
      } as BcTokenRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error(`FindMusic.club API error: ${response.status} ${errorText}`);
      throw new Error(`Failed to exchange token: ${response.status} ${response.statusText}`);
    }

    const data: BcTokenResponse = await response.json();
    log.info(`Successfully exchanged token for user: ${data.user.username}`);

    return data.token;
  } catch (error) {
    if (error instanceof Error) {
      log.error(`Error exchanging token: ${error.message}`);
      throw error;
    }
    log.error(`Unknown error exchanging token: ${error}`);
    throw new Error('Unknown error occurred while exchanging token');
  }
}
