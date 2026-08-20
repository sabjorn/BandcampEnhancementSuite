import Logger from '../logger';
import { extractBandFollowInfo } from '../utilities';
import { loadAlbum } from '../components/player';
import { setPlayerRoot } from '../components/player/query';
import { buildPlayerShell, setAlbumArt } from '../components/player/shell';

const log = new Logger();

const PAGE_ART_SELECTORS = ['#tralbumArt img', 'a.popupImage img', 'img[itemprop="image"]'];

export function takePageAlbumArt(): string | null {
  const image = PAGE_ART_SELECTORS.reduce<HTMLImageElement | null>(
    (found, selector) => found ?? document.querySelector<HTMLImageElement>(selector),
    null
  );

  if (!image) {
    log.info('No album art found on the page');
    return null;
  }

  const source = image.src;
  (image.closest('#tralbumArt') ?? image).remove();

  return source;
}

export async function initAlbumPlayer(port?: chrome.runtime.Port, enableFetchCaching: boolean = false): Promise<void> {
  const nativePlayer = document.querySelector('div.inline_player');
  if (!nativePlayer) {
    log.info('No native player on this page, skipping album player');
    return;
  }

  const { tralbum_id: tralbumId, tralbum_type: tralbumType } = extractBandFollowInfo();
  if (!tralbumId || !tralbumType) {
    log.error('Could not determine tralbum from page, leaving the native player in place');
    return;
  }

  const albumArtUrl = takePageAlbumArt();

  const shell = buildPlayerShell();
  nativePlayer.replaceWith(shell);
  document.querySelector('table#track_table')?.remove();
  document.body.classList.add('bes-album-player-host');

  setPlayerRoot(shell);
  if (albumArtUrl) setAlbumArt(albumArtUrl);

  await loadAlbum(String(tralbumId), tralbumType, enableFetchCaching, port);
}
