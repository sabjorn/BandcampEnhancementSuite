import { createLogger } from './logger';

const log = createLogger();

interface TrackInfo {
  id: number;
  track_id: number;
  title: string;
  duration?: number;
  track_num?: number;
  file?: {
    'mp3-128': string;
  };
  title_link?: string;
}

interface PageTralbumData {
  current: {
    title: string;
    artist: string;
  };
  trackinfo: TrackInfo[];
}

export async function fetchAlbumPageData(albumId: string, albumType: string): Promise<PageTralbumData | null> {
  try {
    const baseUrl = window.location.origin;
    const response = await fetch(`${baseUrl}/album/${albumId}`);

    if (!response.ok) {
      log.error(`Failed to fetch album page: ${response.status}`);
      return null;
    }

    const html = await response.text();

    const scriptMatch = html.match(/data-tralbum="([^"]+)"/);
    if (!scriptMatch) {
      log.error('Could not find data-tralbum attribute');
      return null;
    }

    const encodedData = scriptMatch[1];
    const decodedData = encodedData
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    const tralbumData = JSON.parse(decodedData) as PageTralbumData;

    log.info(`Extracted ${tralbumData.trackinfo?.length || 0} tracks from page`);

    return tralbumData;
  } catch (error) {
    log.error(`Error fetching album page data: ${error}`);
    return null;
  }
}
