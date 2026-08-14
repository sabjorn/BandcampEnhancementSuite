import Logger from './logger';
import { TralbumDetailsResponse, CURRENCY_MINIMUMS } from './bclient';
import { createAddToCartButton } from './components/cartButton';

const log = new Logger();

export function buildNativePlayer(tralbumDetails: TralbumDetailsResponse): {
  playerElement: HTMLElement;
  tracklistElement: HTMLElement;
} {
  const playerDiv = buildInlinePlayer();
  const trackTable = buildTrackTable(tralbumDetails);

  log.info('Native player built successfully');

  return {
    playerElement: playerDiv,
    tracklistElement: trackTable
  };
}

export function buildDrawerPlayer(tralbumDetails: TralbumDetailsResponse): {
  transportElement: HTMLElement;
  centerElement: HTMLElement;
  volumeElement: HTMLElement;
  tracklistElement: HTMLElement;
  albumBuyButton: HTMLElement | null;
} {
  // LEFT COLUMN: Transport buttons only (drawer already has the column wrapper and art)
  // Buttons should be centered under 96px album art with play button as center point
  const transport = document.createElement('div');
  transport.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 4px; width: 96px;';
  transport.innerHTML = `
    <button class="prevbutton hiddenelem" style="border: none; background: transparent; padding: 4px; cursor: pointer; color: rgb(82, 82, 91); display: flex; border-radius: 8px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"></path></svg>
    </button>
    <button class="playbutton" style="border: none; width: 40px; height: 40px; border-radius: 50%; background: rgb(24, 24, 27); color: rgb(255, 255, 255); cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: rgba(24, 24, 27, 0.5) 0px 5px 13px -5px;">
      <svg class="play-icon" width="16" height="16" viewBox="0 0 24 24" style="margin-left: 2px;"><path d="M8 5v14l11-7z" fill="#ffffff"></path></svg>
      <svg class="pause-icon" width="16" height="16" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" fill="#ffffff"></rect><rect x="14" y="5" width="4" height="14" rx="1" fill="#ffffff"></rect></svg>
    </button>
    <button class="nextbutton" style="border: none; background: transparent; padding: 4px; cursor: pointer; color: rgb(82, 82, 91); display: flex; border-radius: 8px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"></path></svg>
    </button>
  `;

  // CENTER COLUMN - content only (drawer already has the column wrapper)
  const center = document.createElement('div');
  center.className = 'inline_player';
  center.style.cssText = 'display: flex; flex-direction: column; gap: 18px;';
  center.innerHTML = `
    <div style="display: flex; gap: 15px; align-items: flex-start;">
      <div class="track_info" style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; align-items: flex-start !important;">
        <div class="album-label" style="width: 100%; font-size: 11px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: rgb(161, 161, 170); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
        <div class="track-title" style="width: 100%; font-size: 21px; font-weight: 800; color: rgb(24, 24, 27); letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
        <div class="artist-name" style="width: 100%; font-size: 14px; font-weight: 500; color: rgb(113, 113, 122); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
      </div>
      <div class="bpm-badge" style="flex-shrink: 0; display: flex; flex-direction: column; align-items: center; padding: 6px 12px; border-radius: 11px; background: rgb(244, 244, 245); border: 1px solid rgb(236, 236, 239);">
        <span class="bpm-number" style="font-family: 'Space Grotesk', monospace; font-size: 18px; font-weight: 600; color: rgb(24, 24, 27); line-height: 1;"></span>
        <span style="font-size: 9px; font-weight: 700; letter-spacing: 0.1em; color: rgb(161, 161, 170); margin-top: 3px;">BPM</span>
      </div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 9px;">
      <div class="progbar" style="position: relative; height: 40px; display: flex; align-items: center; cursor: pointer; touch-action: none; background: none;">
        <div class="slider-container" style="position: relative; width: 100%; height: 5px; border-radius: 5px; background: rgb(236, 236, 239); display: none;">
          <div class="progbar_fill" style="position: absolute; left: 0; top: 0; bottom: 0; border-radius: 5px; background: rgb(91, 83, 232); width: 0%;"></div>
          <div class="thumb" style="position: absolute; top: 50%; left: 0%; transform: translate(-50%, -50%); width: 15px; height: 15px; border-radius: 50%; background: rgb(255, 255, 255); box-shadow: rgba(24, 24, 27, 0.28) 0px 1px 4px 0px, rgb(91, 83, 232) 0px 0px 0px 4px inset;"></div>
        </div>
        <div class="waveform-container" style="position: relative; width: 100%; height: 40px;">
          <canvas class="waveform" width="600" height="30" style="width: 100%; height: 40px; cursor: pointer; display: block;"></canvas>
        </div>
        <div class="bpm" style="display: none;"></div>
      </div>
      <div class="controls" style="display: flex; align-items: center; gap: 10px;">
        <div style="display: flex; padding: 3px; gap: 2px; background: rgb(244, 244, 245); border-radius: 9px; border: 1px solid rgb(236, 236, 239);">
          <button class="toggle-slider" title="Slider" style="border-width: medium; border-style: none; border-color: currentcolor; border-image: initial; background: transparent; padding: 6px 8px; border-radius: 7px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"></line><circle cx="15" cy="12" r="3" fill="currentColor" stroke="none"></circle></svg>
          </button>
          <button class="toggle-waveform active" title="Waveform" style="border-width: medium; border-style: none; border-color: currentcolor; border-image: initial; background: rgb(255, 255, 255); padding: 6px 8px; border-radius: 7px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="9" x2="4" y2="15"></line><line x1="9" y1="5" x2="9" y2="19"></line><line x1="14" y1="8" x2="14" y2="16"></line><line x1="19" y1="6" x2="19" y2="18"></line></svg>
          </button>
        </div>
        <div style="flex: 1;"></div>
        <span class="time_elapsed" style="font-family: 'Space Grotesk', monospace; font-size: 12.5px; font-weight: 500; color: rgb(24, 24, 27); font-variant-numeric: tabular-nums;">00:00</span>
        <span style="font-family: 'Space Grotesk', monospace; font-size: 12.5px; font-weight: 500; color: rgb(161, 161, 170); font-variant-numeric: tabular-nums;">/ </span>
        <span class="time_total" style="font-family: 'Space Grotesk', monospace; font-size: 12.5px; font-weight: 500; color: rgb(161, 161, 170); font-variant-numeric: tabular-nums;">00:00</span>
      </div>
    </div>
  `;

  // Add toggle functionality
  const sliderButton = center.querySelector('.toggle-slider') as HTMLButtonElement;
  const waveformButton = center.querySelector('.toggle-waveform') as HTMLButtonElement;
  const sliderContainer = center.querySelector('.slider-container') as HTMLDivElement;
  const waveformContainer = center.querySelector('.waveform-container') as HTMLDivElement;

  if (sliderButton && waveformButton) {
    sliderButton.onclick = () => {
      sliderButton.style.background = '#ffffff';
      sliderButton.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
      waveformButton.style.background = 'transparent';
      waveformButton.style.boxShadow = 'none';
      if (sliderContainer) sliderContainer.style.display = 'block';
      if (waveformContainer) waveformContainer.style.display = 'none';
    };

    waveformButton.onclick = () => {
      waveformButton.style.background = '#ffffff';
      waveformButton.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
      sliderButton.style.background = 'transparent';
      sliderButton.style.boxShadow = 'none';
      if (waveformContainer) waveformContainer.style.display = 'block';
      if (sliderContainer) sliderContainer.style.display = 'none';
    };
  }

  // VOLUME COLUMN - content only (drawer already has the column wrapper)
  const volumeCol = document.createElement('div');
  volumeCol.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 12px; flex: 1;';
  volumeCol.innerHTML = `
    <button class="volume-mute" style="border-width: medium; border-style: none; border-color: currentcolor; border-image: initial; background: transparent; padding: 4px; cursor: pointer; color: rgb(82, 82, 91); display: flex;">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
    </button>
    <div class="volume" style="flex: 1; width: 34px; display: flex; align-items: flex-end; justify-content: center; cursor: pointer; touch-action: none; padding: 8px 0px;">
      <div style="position: relative; width: 6px; height: 100%; border-radius: 6px; background: rgb(236, 236, 239);">
        <div class="volume-fill" style="position: absolute; left: 0px; right: 0px; bottom: 0px; border-radius: 6px; background: rgb(24, 24, 27); height: 100%;"></div>
        <div class="volume-thumb" style="position: absolute; left: 50%; bottom: 100%; transform: translate(-50%, 50%); width: 15px; height: 15px; border-radius: 50%; background: rgb(255, 255, 255); box-shadow: rgba(24, 24, 27, 0.28) 0px 1px 4px 0px, rgb(24, 24, 27) 0px 0px 0px 4px inset;"></div>
      </div>
    </div>
    <span class="volume-percent" style="font-family: 'Space Grotesk', monospace; font-size: 11px; font-weight: 500; color: rgb(161, 161, 170); font-variant-numeric: tabular-nums;">100%</span>
  `;

  const trackTable = buildTrackTable(tralbumDetails);

  // Create album buy button if album is purchasable
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

    // Wrap in container with label for styling
    const container = document.createElement('div');
    container.className = 'album-buy-button-container';
    container.style.cssText = 'margin-bottom: 16px; display: flex; align-items: center; gap: 8px;';

    const label = document.createElement('span');
    label.className = 'album-buy-label';
    label.textContent = 'Buy Album';
    label.style.cssText = 'font-size: 13px; font-weight: 500; color: #333;';

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

function createTransportButton(type: string, ariaLabel: string, buttonClass: string): HTMLElement {
  const container = document.createElement('div');
  container.className = type === 'play' ? 'play_cell' : type;
  container.style.cssText = 'display: flex;';

  const link = document.createElement('a');
  link.setAttribute('role', 'button');
  link.setAttribute('aria-label', ariaLabel);

  const button = document.createElement('div');
  button.className = buttonClass;

  // Inline styles for transport buttons
  if (type === 'play') {
    button.style.cssText = `
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: #18181b;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 5px 13px -5px rgba(24, 24, 27, 0.5);
      transition: background-color 0.2s ease;
      position: relative;
    `;
    // Add play icon
    const playIcon = document.createElement('div');
    playIcon.style.cssText = `
      width: 17px;
      height: 17px;
      -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M8 5v14l11-7z'/%3E%3C/svg%3E") no-repeat center;
      mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M8 5v14l11-7z'/%3E%3C/svg%3E") no-repeat center;
      -webkit-mask-size: contain;
      mask-size: contain;
      background-color: #ffffff;
      margin-left: 2px;
    `;
    button.appendChild(playIcon);
  } else {
    button.style.cssText = `
      width: 19px;
      height: 19px;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 4px;
      border-radius: 8px;
      transition: background-color 0.2s ease;
      -webkit-mask-size: contain;
      mask-size: contain;
      background-color: #52525b;
    `;

    if (type === 'prev') {
      button.style.webkitMask = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M6 6h2v12H6zm3.5 6l8.5 6V6z'/%3E%3C/svg%3E") no-repeat center`;
      button.style.mask = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M6 6h2v12H6zm3.5 6l8.5 6V6z'/%3E%3C/svg%3E") no-repeat center`;
    } else if (type === 'next') {
      button.style.webkitMask = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M16 6h2v12h-2zM6 18l8.5-6L6 6z'/%3E%3C/svg%3E") no-repeat center`;
      button.style.mask = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M16 6h2v12h-2zM6 18l8.5-6L6 6z'/%3E%3C/svg%3E") no-repeat center`;
    }
  }

  link.appendChild(button);
  container.appendChild(link);

  return container;
}

function createProgbarWithWaveform(): HTMLElement {
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');

  // Track info row (will be hidden in drawer since we have it in header)
  const trackInfoRow = document.createElement('tr');
  const trackCell = document.createElement('td');
  trackCell.className = 'track_cell';
  trackCell.colSpan = 3;

  const trackInfo = document.createElement('div');
  trackInfo.className = 'track_info';

  const titleSection = document.createElement('span');
  titleSection.className = 'title-section';
  const titleSpan = document.createElement('span');
  titleSpan.className = 'title';
  titleSection.appendChild(titleSpan);

  const timeSection = document.createElement('span');
  timeSection.className = 'time secondaryText';
  const timeElapsed = document.createElement('span');
  timeElapsed.className = 'time_elapsed';
  timeElapsed.textContent = '00:00';
  const timeSeparator = document.createTextNode(' / ');
  const timeTotal = document.createElement('span');
  timeTotal.className = 'time_total';
  timeTotal.textContent = '00:00';
  timeSection.appendChild(timeElapsed);
  timeSection.appendChild(timeSeparator);
  timeSection.appendChild(timeTotal);

  trackInfo.appendChild(titleSection);
  trackInfo.appendChild(document.createTextNode(' '));
  trackInfo.appendChild(timeSection);

  // Inline styles for track info
  trackInfo.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 0;
    padding: 0;
  `;
  titleSection.style.display = 'none';
  timeSection.style.cssText = `
    white-space: nowrap;
    margin-left: auto;
    font-family: 'Space Grotesk', monospace;
    font-size: 12.5px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  `;
  timeElapsed.style.color = '#18181b';
  timeTotal.style.color = '#a1a1aa';

  trackCell.appendChild(trackInfo);
  trackInfoRow.appendChild(trackCell);
  tbody.appendChild(trackInfoRow);

  // Progbar row
  const progbarRow = document.createElement('tr');
  const progbarCell = document.createElement('td');
  progbarCell.className = 'progbar_cell';

  const progbar = document.createElement('div');
  progbar.className = 'progbar waveform';
  progbar.style.cssText = `
    position: relative;
    height: 40px;
    display: flex;
    align-items: center;
    cursor: pointer;
    touch-action: none;
    margin-top: 0;
  `;

  // Canvas container
  const canvasContainer = document.createElement('div');
  canvasContainer.style.cssText = `
    position: relative;
    width: 100%;
    height: 40px;
  `;
  const canvas = document.createElement('canvas');
  canvas.className = 'waveform';
  canvas.style.cssText = `
    width: 100%;
    height: 40px;
    cursor: pointer;
    display: block;
  `;
  canvas.width = 600;
  canvas.height = 30;
  canvasContainer.appendChild(canvas);
  progbar.appendChild(canvasContainer);

  // Progbar empty
  const progbarEmpty = document.createElement('div');
  progbarEmpty.className = 'progbar_empty';
  progbarEmpty.style.cssText = `
    position: relative;
    height: 5px;
    width: 100%;
    background: #ececef;
    border-radius: 5px;
    cursor: pointer;
  `;
  const progbarFill = document.createElement('div');
  progbarFill.className = 'progbar_fill';
  progbarFill.style.cssText = `
    background: #1da0c3;
    height: 100%;
    border-radius: 5px;
    transition: width 0.1s linear;
  `;
  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  thumb.style.cssText = `
    position: absolute;
    top: 50%;
    left: 0;
    transform: translate(-50%, -50%);
    width: 15px;
    height: 15px;
    background: #ffffff;
    border: none;
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(24, 24, 27, 0.28), inset 0 0 0 4px #1da0c3;
    cursor: pointer;
  `;
  progbarEmpty.appendChild(progbarFill);
  progbarEmpty.appendChild(thumb);
  progbar.appendChild(progbarEmpty);

  // BPM display
  const bpmDisplay = document.createElement('div');
  bpmDisplay.className = 'bpm';
  bpmDisplay.style.display = 'none';
  progbar.appendChild(bpmDisplay);

  progbarCell.appendChild(progbar);
  progbarRow.appendChild(progbarCell);
  tbody.appendChild(progbarRow);

  table.appendChild(tbody);
  return table;
}

function buildInlinePlayer(): HTMLElement {
  const playerDiv = document.createElement('div');
  playerDiv.className = 'inline_player';

  // Controls
  const controls = document.createElement('div');
  controls.className = 'controls';

  // Volume slider
  const volumeSlider = createVolumeSlider();
  controls.appendChild(volumeSlider);

  // Play cell
  const playCell = document.createElement('div');
  playCell.className = 'play_cell';
  const playLink = document.createElement('a');
  playLink.setAttribute('role', 'button');
  playLink.setAttribute('aria-label', 'Play/pause');
  const playButton = document.createElement('div');
  playButton.className = 'playbutton';
  playLink.appendChild(playButton);
  playCell.appendChild(playLink);
  controls.appendChild(playCell);

  // Prev/Next container
  const prevNextContainer = document.createElement('div');

  const prevDiv = document.createElement('div');
  prevDiv.className = 'prev';
  const prevLink = document.createElement('a');
  prevLink.setAttribute('role', 'button');
  prevLink.setAttribute('aria-label', 'Previous track');
  const prevButton = document.createElement('div');
  prevButton.className = 'prevbutton hiddenelem';
  prevLink.appendChild(prevButton);
  prevDiv.appendChild(prevLink);
  prevNextContainer.appendChild(prevDiv);

  const nextDiv = document.createElement('div');
  nextDiv.className = 'next';
  const nextLink = document.createElement('a');
  nextLink.setAttribute('role', 'button');
  nextLink.setAttribute('aria-label', 'Next track');
  const nextButton = document.createElement('div');
  nextButton.className = 'nextbutton';
  nextLink.appendChild(nextButton);
  nextDiv.appendChild(nextLink);
  prevNextContainer.appendChild(nextDiv);

  controls.appendChild(prevNextContainer);

  // Waveform toggle
  const toggleDiv = createWaveformToggle();
  controls.appendChild(toggleDiv);

  playerDiv.appendChild(controls);

  // Table with track info and progbar
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');

  // Track info row
  const trackInfoRow = document.createElement('tr');
  const trackCell = document.createElement('td');
  trackCell.className = 'track_cell';
  trackCell.colSpan = 3;

  const trackInfo = document.createElement('div');
  trackInfo.className = 'track_info';

  const titleSection = document.createElement('span');
  titleSection.className = 'title-section';
  const titleSpan = document.createElement('span');
  titleSpan.className = 'title';
  titleSection.appendChild(titleSpan);

  const timeSection = document.createElement('span');
  timeSection.className = 'time secondaryText';
  const timeElapsed = document.createElement('span');
  timeElapsed.className = 'time_elapsed';
  timeElapsed.textContent = '00:00';
  const timeSeparator = document.createTextNode(' / ');
  const timeTotal = document.createElement('span');
  timeTotal.className = 'time_total';
  timeTotal.textContent = '00:00';
  timeSection.appendChild(timeElapsed);
  timeSection.appendChild(timeSeparator);
  timeSection.appendChild(timeTotal);

  trackInfo.appendChild(titleSection);
  trackInfo.appendChild(document.createTextNode(' '));
  trackInfo.appendChild(timeSection);

  // Inline styles for track info
  trackInfo.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 0;
    padding: 0;
  `;
  titleSection.style.display = 'none';
  timeSection.style.cssText = `
    white-space: nowrap;
    margin-left: auto;
    font-family: 'Space Grotesk', monospace;
    font-size: 12.5px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  `;
  timeElapsed.style.color = '#18181b';
  timeTotal.style.color = '#a1a1aa';

  trackCell.appendChild(trackInfo);
  trackInfoRow.appendChild(trackCell);
  tbody.appendChild(trackInfoRow);

  // Progbar row
  const progbarRow = document.createElement('tr');
  const progbarCell = document.createElement('td');
  progbarCell.className = 'progbar_cell';

  const progbar = document.createElement('div');
  progbar.className = 'progbar waveform';
  progbar.style.cssText = `
    position: relative;
    height: 40px;
    display: flex;
    align-items: center;
    cursor: pointer;
    touch-action: none;
    margin-top: 0;
  `;

  // Canvas container
  const canvasContainer = document.createElement('div');
  canvasContainer.style.cssText = `
    position: relative;
    width: 100%;
    height: 40px;
  `;
  const canvas = document.createElement('canvas');
  canvas.className = 'waveform';
  canvas.style.cssText = `
    width: 100%;
    height: 40px;
    cursor: pointer;
    display: block;
  `;
  canvas.width = 600;
  canvas.height = 30;
  canvasContainer.appendChild(canvas);
  progbar.appendChild(canvasContainer);

  // Progbar empty
  const progbarEmpty = document.createElement('div');
  progbarEmpty.className = 'progbar_empty';
  progbarEmpty.style.cssText = `
    position: relative;
    height: 5px;
    width: 100%;
    background: #ececef;
    border-radius: 5px;
    cursor: pointer;
  `;
  const progbarFill = document.createElement('div');
  progbarFill.className = 'progbar_fill';
  progbarFill.style.cssText = `
    background: #1da0c3;
    height: 100%;
    border-radius: 5px;
    transition: width 0.1s linear;
  `;
  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  thumb.style.cssText = `
    position: absolute;
    top: 50%;
    left: 0;
    transform: translate(-50%, -50%);
    width: 15px;
    height: 15px;
    background: #ffffff;
    border: none;
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(24, 24, 27, 0.28), inset 0 0 0 4px #1da0c3;
    cursor: pointer;
  `;
  progbarEmpty.appendChild(progbarFill);
  progbarEmpty.appendChild(thumb);
  progbar.appendChild(progbarEmpty);

  // BPM display
  const bpmDisplay = document.createElement('div');
  bpmDisplay.className = 'bpm';
  bpmDisplay.style.display = 'none';
  progbar.appendChild(bpmDisplay);

  progbarCell.appendChild(progbar);
  progbarRow.appendChild(progbarCell);
  tbody.appendChild(progbarRow);

  table.appendChild(tbody);
  playerDiv.appendChild(table);

  return playerDiv;
}

function createVolumeSlider(): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'volume';
  input.min = '0';
  input.max = '1';
  input.step = '0.01';
  input.setAttribute('title', 'volume control');
  input.value = '1.0';

  return input;
}

function createWaveformToggle(): HTMLDivElement {
  const toggle = document.createElement('input');
  toggle.setAttribute('title', 'toggle waveform display');
  toggle.setAttribute('type', 'checkbox');
  toggle.setAttribute('class', 'bes-toggle');
  toggle.setAttribute('id', 'drawer-waveform-switch');

  const label = document.createElement('label');
  label.setAttribute('class', 'bes-toggle');
  label.htmlFor = 'drawer-waveform-switch';
  label.innerHTML = 'Toggle';

  const toggleDiv = document.createElement('div');
  toggleDiv.appendChild(toggle);
  toggleDiv.appendChild(label);

  return toggleDiv;
}

export function buildTrackTable(tralbumDetails: TralbumDetailsResponse): HTMLElement {
  const table = document.createElement('table');
  table.className = 'track_list track_table';
  table.id = 'track_table';
  table.style.cssText = 'width: 100%; border-collapse: collapse;';

  if (!tralbumDetails.tracks || tralbumDetails.tracks.length === 0) {
    return table;
  }

  tralbumDetails.tracks.forEach((track, index) => {
    const row = document.createElement('tr');
    row.className = 'track_row_view linked';
    row.setAttribute('rel', `tracknum=${index + 1}`);

    // Check if track is playable (same logic as in playerLoader.ts)
    const isPlayable = Boolean(track?.streaming_url?.['mp3-128']);

    // Column 1: Track number
    const trackNumCol = document.createElement('td');
    trackNumCol.className = 'track-number-col';
    trackNumCol.style.cssText = 'width: 28px; text-align: right; padding: 8px 8px 8px 0; vertical-align: middle;';

    const trackNumDiv = document.createElement('div');
    trackNumDiv.className = 'track_number secondaryText';
    trackNumDiv.textContent = `${index + 1}.`;
    trackNumDiv.style.cssText = 'color: #71717a; font-size: 13px;';

    trackNumCol.appendChild(trackNumDiv);

    // Column 2: Track title (flexible width)
    const titleCol = document.createElement('td');
    titleCol.className = 'title-col';
    titleCol.style.cssText =
      'padding: 8px 8px; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'track-title';
    titleSpan.textContent = track.title;
    titleSpan.style.cssText = 'color: #333; font-weight: 500; font-size: 14px;';

    titleCol.appendChild(titleSpan);

    // Column 3: Duration
    const durationCol = document.createElement('td');
    durationCol.className = 'duration-col';
    durationCol.style.cssText = 'width: 45px; text-align: right; padding: 8px 8px; vertical-align: middle;';

    if (track.duration) {
      const timeSpan = document.createElement('span');
      timeSpan.className = 'time secondaryText';
      timeSpan.textContent = formatDuration(track.duration);
      timeSpan.style.cssText = 'color: #999; font-size: 13px;';
      durationCol.appendChild(timeSpan);
    }

    // Column 4: Link icon (with visual separation)
    const linkCol = document.createElement('td');
    linkCol.className = 'link-col';
    linkCol.style.cssText = 'width: 32px; text-align: center; padding: 8px 4px; vertical-align: middle;';

    if (track.track_url) {
      const linkIcon = document.createElement('a');
      linkIcon.className = 'track-link-icon';
      linkIcon.href = track.track_url;
      linkIcon.target = '_blank';
      linkIcon.setAttribute('aria-label', `Open ${track.title} in new tab`);
      linkIcon.setAttribute('title', 'Open track page');
      linkIcon.innerHTML = '↗';
      linkIcon.style.cssText =
        'display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; color: #0687f5; text-decoration: none; font-size: 14px; border-radius: 4px; border: 1px solid transparent; transition: all 0.15s ease;';
      linkIcon.onmouseenter = () => {
        linkIcon.style.backgroundColor = '#f0f7ff';
        linkIcon.style.borderColor = '#0687f5';
      };
      linkIcon.onmouseleave = () => {
        linkIcon.style.backgroundColor = 'transparent';
        linkIcon.style.borderColor = 'transparent';
      };
      linkCol.appendChild(linkIcon);
    }

    // Column 5: Buy button (if purchasable)
    const buyCol = document.createElement('td');
    buyCol.className = 'download-col';
    buyCol.style.cssText = 'width: 70px; text-align: right; padding: 8px 0 8px 4px; vertical-align: middle;';

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

    // Apply visual indication for unplayable tracks
    if (!isPlayable) {
      row.classList.add('unplayable-track');
      row.style.opacity = '0.5';
      row.style.cursor = 'not-allowed';
      trackNumDiv.style.color = '#a1a1aa';
      titleSpan.style.color = '#a1a1aa';
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
