import Logger from '../../logger';
import { TralbumDetailsResponse, CURRENCY_MINIMUMS } from '../../bclient';
import { createAddToCartButton } from '../cartButton';
import { prevIcon, nextIcon, playIcon, pauseIcon, volumeIcon, heartIcon, playedIcon } from './icons';
import playerCenterMarkup from '../../../html/drawer_player_center.html';

const log = new Logger();

export function buildDrawerPlayer(tralbumDetails: TralbumDetailsResponse): {
  transportElement: HTMLElement;
  centerElement: HTMLElement;
  volumeElement: HTMLElement;
  tracklistElement: HTMLElement;
  albumBuyButton: HTMLElement | null;
} {
  const transport = document.createElement('div');
  transport.className = 'bes-transport';
  transport.innerHTML = `
    <button class="bes-transport-prev bes-hidden">${prevIcon(18)}</button>
    <button class="bes-transport-play">${playIcon(16)}${pauseIcon(16)}</button>
    <button class="bes-transport-next">${nextIcon(18)}</button>
  `;

  const center = document.createElement('div');
  center.className = 'bes-drawer-player-center';
  center.innerHTML = playerCenterMarkup;

  const volumeCol = document.createElement('div');
  volumeCol.className = 'bes-drawer-volume-column';
  volumeCol.innerHTML = `
    <button class="bes-volume-mute">${volumeIcon(19)}</button>
    <div class="bes-volume">
      <div class="bes-volume-track">
        <div class="bes-volume-fill"></div>
        <div class="bes-volume-thumb"></div>
      </div>
    </div>
    <span class="bes-volume-percent">100%</span>
  `;

  const trackTable = buildTrackTable(tralbumDetails);

  log.info('Drawer player built successfully');

  return {
    transportElement: transport,
    centerElement: center,
    volumeElement: volumeCol,
    tracklistElement: trackTable,
    albumBuyButton: buildAlbumBuyButton(tralbumDetails)
  };
}

export function buildAlbumBuyButton(tralbumDetails: TralbumDetailsResponse): HTMLElement | null {
  const { price, currency, id, title, type, is_purchasable } = tralbumDetails;
  if (!is_purchasable || price === undefined) return null;

  const container = document.createElement('div');
  container.className = 'bes-album-buy';

  const label = document.createElement('span');
  label.className = 'bes-album-buy-label';
  label.textContent = 'Buy Album';

  container.appendChild(label);
  container.appendChild(
    createAddToCartButton({
      price: price > 0.0 ? price : CURRENCY_MINIMUMS[currency] || 0.5,
      currency,
      tralbumId: String(id),
      itemTitle: title,
      type,
      log
    })
  );

  return container;
}

function buildTrackStateCell(): HTMLElement {
  const stateCol = document.createElement('td');
  stateCol.className = 'bes-track-state-col';

  const likedIndicator = document.createElement('span');
  likedIndicator.className = 'bes-track-liked';
  likedIndicator.setAttribute('title', 'Liked on FindMusic.club');
  likedIndicator.innerHTML = heartIcon(12);

  const playedIndicator = document.createElement('span');
  playedIndicator.className = 'bes-track-played';
  playedIndicator.setAttribute('title', 'Played');
  playedIndicator.innerHTML = playedIcon(12);

  stateCol.appendChild(likedIndicator);
  stateCol.appendChild(playedIndicator);

  return stateCol;
}

export function buildTrackTable(tralbumDetails: TralbumDetailsResponse): HTMLElement {
  const table = document.createElement('table');
  table.className = 'bes-tracklist-table';

  if (!tralbumDetails.tracks || tralbumDetails.tracks.length === 0) {
    return table;
  }

  tralbumDetails.tracks.forEach((track, index) => {
    const row = document.createElement('tr');
    row.className = 'bes-track-row';
    row.setAttribute('rel', `tracknum=${index + 1}`);

    if (track.track_id) {
      row.dataset.trackId = String(track.track_id);
    }

    const isPlayable = Boolean(track?.streaming_url?.['mp3-128']);

    const trackNumCol = document.createElement('td');
    trackNumCol.className = 'bes-track-num-col';

    const trackNumDiv = document.createElement('div');
    trackNumDiv.className = 'bes-track-num';
    trackNumDiv.textContent = `${index + 1}.`;

    trackNumCol.appendChild(trackNumDiv);

    const titleCol = document.createElement('td');
    titleCol.className = 'bes-track-title-col';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'bes-track-title';
    titleSpan.textContent = track.title;

    titleCol.appendChild(titleSpan);

    const durationCol = document.createElement('td');
    durationCol.className = 'bes-track-duration-col';

    if (track.duration) {
      const timeSpan = document.createElement('span');
      timeSpan.className = 'bes-track-duration';
      timeSpan.textContent = formatDuration(track.duration);
      durationCol.appendChild(timeSpan);
    }

    const stateCol = buildTrackStateCell();

    const linkCol = document.createElement('td');
    linkCol.className = 'bes-track-link-col';

    if (track.track_url) {
      const linkIcon = document.createElement('a');
      linkIcon.className = 'bes-track-link';
      linkIcon.href = track.track_url;
      linkIcon.target = '_blank';
      linkIcon.setAttribute('aria-label', `Open ${track.title} in new tab`);
      linkIcon.setAttribute('title', 'Open track page');
      linkIcon.innerHTML = '↗';
      linkCol.appendChild(linkIcon);
    }

    const buyCol = document.createElement('td');
    buyCol.className = 'bes-track-buy-col';

    if (track.is_purchasable && track.track_id) {
      const { price, currency, track_id: trackId, title: trackTitle } = track;
      const minimumPrice = price > 0.0 ? price : CURRENCY_MINIMUMS[currency] || 0.5;

      const buyButton = createAddToCartButton({
        price: minimumPrice,
        currency: currency,
        tralbumId: String(trackId),
        itemTitle: trackTitle,
        type: 't',
        log
      });

      buyCol.appendChild(buyButton);
    }

    row.appendChild(trackNumCol);
    row.appendChild(titleCol);
    row.appendChild(durationCol);
    row.appendChild(stateCol);
    row.appendChild(linkCol);
    row.appendChild(buyCol);

    if (!isPlayable) {
      row.classList.add('bes-track-unplayable');
    }

    table.appendChild(row);
  });

  return table;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
