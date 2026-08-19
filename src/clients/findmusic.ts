import Logger from '../logger';
import { storeFindMusicToken, getFindMusicTokenFromStorage } from '../utilities';

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
  const storedToken = await getFindMusicTokenFromStorage();

  if (storedToken) {
    log.debug('Using stored FindMusic.club token');
    return storedToken;
  }

  log.info('No valid stored token, attempting to exchange new token');
  try {
    return await exchangeBandcampToken();
  } catch (error) {
    log.debug('Failed to exchange token (likely missing permissions or not logged in)');
    return null;
  }
}

export async function fetchTrackMetadata(
  trackId: number,
  token: string
): Promise<{ waveform: number[]; bpm: number } | null> {
  try {
    const url = new URL(`${process.env.FINDMUSIC_BASE_URL}/api/metadata`);
    url.searchParams.set('track_id', trackId.toString());

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

export interface TrackState {
  liked: number[];
  played: number[];
}

export async function fetchAlbumTrackState(albumId: string, token: string): Promise<TrackState | null> {
  try {
    const url = new URL(`${process.env.FINDMUSIC_BASE_URL}/api/track-state`);
    url.searchParams.set('album_id', albumId);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 404 || response.status === 500) {
      log.debug(`No track state for album ${albumId} (${response.status})`);
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      log.error(`FindMusic.club track state API error: ${response.status} ${errorText}`);
      return null;
    }

    const data = await response.json();
    log.info(`Successfully fetched track state for album ${albumId}`);
    return {
      liked: Array.isArray(data?.liked) ? data.liked : [],
      played: Array.isArray(data?.played) ? data.played : []
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn(`Network error fetching track state for album ${albumId}: ${message}`);
    return null;
  }
}

export async function postTrackPlayed(trackId: number, token: string): Promise<void> {
  try {
    const response = await fetch(`${process.env.FINDMUSIC_BASE_URL}/api/played`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        track_id: trackId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.warn(`Failed to post play for track ${trackId}: ${response.status} ${errorText}`);
      return;
    }

    log.info(`Successfully posted play for track ${trackId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn(`Network error posting play for track ${trackId}: ${message}`);
  }
}
