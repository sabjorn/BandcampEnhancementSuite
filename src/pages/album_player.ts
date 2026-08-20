import Logger from '../logger';
import { extractBandFollowInfo } from '../utilities';
import { createPlayerDrawer, loadAlbumIntoDrawer } from '../components/player';

const log = new Logger();

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

  nativePlayer.remove();
  document.querySelector('table#track_table')?.remove();

  const { drawer, openDrawer } = createPlayerDrawer({ dismissible: false });
  document.body.appendChild(drawer);
  openDrawer();

  await loadAlbumIntoDrawer(String(tralbumId), tralbumType, enableFetchCaching, port);
}
