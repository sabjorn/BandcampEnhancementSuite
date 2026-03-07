import Logger from '../logger';

const log = new Logger();

interface BcTokenResponse {
  token: string;
}

interface BcTokenRequest {
  bc_token: string;
}

export async function exchangeBandcampToken(): Promise<string> {
  log.info('Attempting to exchange Bandcamp token for FindMusic.club token');

  const cookie = await chrome.cookies.get({
    url: 'https://bandcamp.com/',
    name: 'identity'
  });

  if (!cookie || !cookie.value) {
    log.error('No Bandcamp identity cookie found');
    throw new Error('No Bandcamp identity cookie found. Please log in to Bandcamp first.');
  }

  log.debug(`Found Bandcamp identity cookie: ${cookie.value.substring(0, 20)}...`);

  try {
    const response = await fetch(`${process.env.FINDMUSIC_BASE_URL}/api/bctoken`, {
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
    log.info(`Successfully exchanged token`);

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
