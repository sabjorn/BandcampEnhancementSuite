import Logger from '../logger';
import { getFindMusicToken } from '../clients/findmusic';

const log = new Logger();

export function processRequest(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  if (request.contentScriptQuery === 'fetchTrackMetadata') {
    fetchTrackMetadata(request.trackId)
      .then(metadata => {
        sendResponse(metadata);
      })
      .catch(error => {
        log.error(`Failed to fetch track metadata: ${error.message}`);
        sendResponse(null);
      });
    return true;
  }

  if (request.contentScriptQuery === 'postTrackMetadata') {
    postTrackMetadata(request.trackId, request.waveform, request.bpm)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        log.error(`Failed to post track metadata: ${error.message}`);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.contentScriptQuery !== 'renderBuffer') return false;

  const url = 'https://t4.bcbits.com/stream/' + request.url;

  fetch(url)
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => {
      const uint8Array = new Uint8Array(arrayBuffer);
      const jsonResult = {
        type: 'Buffer',
        data: Array.from(uint8Array)
      };
      sendResponse(jsonResult);
    })
    .catch(error => {
      // eslint-disable-next-line no-console
      console.error(error);
    });

  return true;
}

async function fetchTrackMetadata(trackId: number): Promise<{ waveform: number[]; bpm: number } | null> {
  try {
    const token = await getFindMusicToken();

    const response = await fetch(`${process.env.FINDMUSIC_BASE_URL}/api/metadata?track_id=${trackId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 404) {
      log.info(`No cached metadata found for track ${trackId}`);
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      log.error(`FindMusic.club metadata API error: ${response.status} ${errorText}`);
      throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    log.info(`Successfully fetched metadata for track ${trackId}`);
    return data;
  } catch (error) {
    if (error instanceof Error) {
      log.error(`Error fetching metadata: ${error.message}`);
      throw error;
    }
    throw new Error('Unknown error occurred while fetching metadata');
  }
}

async function postTrackMetadata(trackId: number, waveform: number[], bpm: number): Promise<void> {
  try {
    const token = await getFindMusicToken();

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
      log.error(`FindMusic.club metadata API error: ${response.status} ${errorText}`);
      throw new Error(`Failed to post metadata: ${response.status} ${response.statusText}`);
    }

    log.info(`Successfully posted metadata for track ${trackId}`);
  } catch (error) {
    if (error instanceof Error) {
      log.error(`Error posting metadata: ${error.message}`);
      throw error;
    }
    throw new Error('Unknown error occurred while posting metadata');
  }
}

export async function initWaveformBackend(): Promise<void> {
  log.info('starting waveform backend.');
  chrome.runtime.onMessage.addListener(processRequest);
}
