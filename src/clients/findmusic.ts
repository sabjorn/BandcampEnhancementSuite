import Logger from '../logger';
import { storeFindMusicToken, getFindMusicTokenFromStorage } from '../utilities';

const log = new Logger();
const FINDMUSIC_ORIGIN = process.env.FINDMUSIC_ORIGIN_PATTERN as string;

export async function hasFindMusicPermissions(): Promise<boolean> {
  try {
    const hasPermissions = await chrome.permissions.contains({
      permissions: ['cookies'],
      origins: [FINDMUSIC_ORIGIN]
    });
    return hasPermissions;
  } catch (error) {
    log.warn(`Failed to check FindMusic permissions: ${error}`);
    return false;
  }
}

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

    await storeFindMusicToken(data.token);

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

export async function getFindMusicToken(): Promise<string | null> {
  // Check permissions first
  const hasPermissions = await hasFindMusicPermissions();
  if (!hasPermissions) {
    log.debug('FindMusic permissions not granted, skipping token operations');
    return null;
  }

  const storedToken = await getFindMusicTokenFromStorage();

  if (storedToken) {
    log.debug('Using stored FindMusic.club token');
    return storedToken;
  }

  log.info('No valid stored token, exchanging new token');
  return await exchangeBandcampToken();
}

export async function fetchTrackMetadata(
  trackId: number,
  token: string
): Promise<{ waveform: number[]; bpm: number } | null> {
  try {
    log.debug(`fetchTrackMetadata called with trackId: ${trackId}, type: ${typeof trackId}`);

    const url = new URL(`${process.env.FINDMUSIC_BASE_URL}/api/metadata`);
    url.searchParams.set('track_id', trackId.toString());
    log.debug(`Fetching metadata from URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 404 || response.status === 500) {
      log.debug(`Cache miss for track ${trackId} (${response.status})`);
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      log.error(`FindMusic.club metadata API error: ${response.status} ${errorText}`);
      return null;
    }

    const data = await response.json();
    log.info(`Successfully fetched metadata for track ${trackId}`);
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn(`Network error fetching metadata for track ${trackId}: ${message}`);
    return null;
  }
}

export async function postTrackMetadata(
  trackId: number,
  waveform: number[],
  bpm: number,
  token: string
): Promise<void> {
  try {
    const response = await fetch(`${process.env.FINDMUSIC_BASE_URL}/api/metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        track_id: trackId,
        waveform,
        bpm
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.warn(`Failed to post metadata for track ${trackId}: ${response.status} ${errorText}`);
      return;
    }

    log.info(`Successfully posted metadata for track ${trackId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn(`Network error posting metadata for track ${trackId}: ${message}`);
  }
}
