import Logger from './logger';
import { TralbumDetailsResponse, CURRENCY_MINIMUMS } from './bclient';
import { createAddToCartButton } from './components/cartButton';
import { prevIcon, nextIcon, playIcon, pauseIcon } from './components/playerIcons';

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
  center.innerHTML = `
    <div class="bes-now-playing">
      <div class="bes-track-info">
        <div class="bes-album-label"></div>
        <div class="bes-now-playing-title"></div>
        <div class="bes-artist-name"></div>
      </div>
      <div class="bes-bpm-badge">
        <span class="bes-bpm-number"></span>
        <span class="bes-bpm-unit">BPM</span>
      </div>
    </div>
    <div class="bes-progress-area">
      <div class="bes-progbar">
        <div class="bes-slider-container">
          <div class="bes-progbar-fill"></div>
          <div class="bes-progbar-thumb"></div>
        </div>
        <div class="bes-waveform-container">
          <canvas class="bes-waveform" width="600" height="30"></canvas>
        </div>
      </div>
      <div class="bes-player-controls">
        <div class="bes-view-toggle">
          <button class="bes-toggle-slider" title="Slider">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"></line><circle cx="15" cy="12" r="3" fill="currentColor" stroke="none"></circle></svg>
          </button>
          <button class="bes-toggle-waveform bes-toggle-active" title="Waveform">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="9" x2="4" y2="15"></line><line x1="9" y1="5" x2="9" y2="19"></line><line x1="14" y1="8" x2="14" y2="16"></line><line x1="19" y1="6" x2="19" y2="18"></line></svg>
          </button>
        </div>
        <div class="bes-controls-spacer"></div>
        <span class="bes-time-elapsed">00:00</span>
        <span class="bes-time-separator">/ </span>
        <span class="bes-time-total">00:00</span>
      </div>
    </div>
  `;

  const sliderButton = center.querySelector('.bes-toggle-slider') as HTMLButtonElement;
  const waveformButton = center.querySelector('.bes-toggle-waveform') as HTMLButtonElement;
  const sliderContainer = center.querySelector('.bes-slider-container') as HTMLDivElement;
  const waveformContainer = center.querySelector('.bes-waveform-container') as HTMLDivElement;

  if (sliderButton && waveformButton) {
    sliderButton.onclick = () => {
      sliderButton.classList.add('bes-toggle-active');
      waveformButton.classList.remove('bes-toggle-active');
      if (sliderContainer) sliderContainer.classList.add('bes-visible');
      if (waveformContainer) waveformContainer.classList.remove('bes-visible');
    };

    waveformButton.onclick = () => {
      waveformButton.classList.add('bes-toggle-active');
      sliderButton.classList.remove('bes-toggle-active');
      if (waveformContainer) waveformContainer.classList.add('bes-visible');
      if (sliderContainer) sliderContainer.classList.remove('bes-visible');
    };
  }

  if (waveformContainer) waveformContainer.classList.add('bes-visible');

  const volumeCol = document.createElement('div');
  volumeCol.className = 'bes-drawer-volume-column';
  volumeCol.innerHTML = `
    <button class="bes-volume-mute">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
    </button>
    <div class="bes-volume">
      <div class="bes-volume-track">
        <div class="bes-volume-fill"></div>
        <div class="bes-volume-thumb"></div>
      </div>
    </div>
    <span class="bes-volume-percent">100%</span>
  `;

  const trackTable = buildTrackTable(tralbumDetails);

  let albumBuyButton: HTMLElement | null = null;
  if (tralbumDetails.is_purchasable && tralbumDetails.price !== undefined) {
    const { price, currency, id, title, type } = tralbumDetails;
    const minimumPrice = price > 0.0 ? price : CURRENCY_MINIMUMS[currency] || 0.5;

    const buyButtonElement = createAddToCartButton({
      price: minimumPrice,
      currency: currency,
      tralbumId: String(id),
      itemTitle: title,
      type: type,
      log
    });

    const container = document.createElement('div');
    container.className = 'bes-album-buy';

    const label = document.createElement('span');
    label.className = 'bes-album-buy-label';
    label.textContent = 'Buy Album';

    container.appendChild(label);
    container.appendChild(buyButtonElement);

    albumBuyButton = container;
  }

  log.info('Drawer player built successfully');

  return {
    transportElement: transport,
    centerElement: center,
    volumeElement: volumeCol,
    tracklistElement: trackTable,
    albumBuyButton: albumBuyButton
  };
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

export function injectTrackData(container: HTMLElement, tralbumDetails: TralbumDetailsResponse): void {
  if (!tralbumDetails.tracks) return;

  const trackDataScript = document.createElement('script');
  trackDataScript.type = 'application/json';
  trackDataScript.id = 'pagedata';

  const pageData = {
    data_tralbum: JSON.stringify({
      trackinfo: tralbumDetails.tracks,
      current: {
        title: tralbumDetails.title,
        artist: tralbumDetails.tralbum_artist,
        id: tralbumDetails.id,
        type: tralbumDetails.type
      }
    })
  };

  trackDataScript.textContent = JSON.stringify(pageData);
  container.appendChild(trackDataScript);

  log.info('Track data injected');
}
