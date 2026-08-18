import Logger from './logger';
import { mousedownCallback, extractBandFollowInfo, extractFanTralbumData, createFetchFunction } from './utilities';
import { CURRENCY_MINIMUMS, getTralbumDetails } from './bclient';
import { createAddToCartButton } from './components/cartButton';
import { KeyboardSettings, DEFAULT_KEYBOARD_SETTINGS } from './types/keyboard';
import { PlayerCommands, registerPlayerShortcuts, updateKeyboardSettings } from './keyboardShortcuts';

let nativeShortcutsRegistered = false;

function registerNativePlayerShortcuts(settings: KeyboardSettings): void {
  updateKeyboardSettings(settings);

  if (nativeShortcutsRegistered) return;

  registerPlayerShortcuts(nativePlayerCommands);
  nativeShortcutsRegistered = true;
}

function clickIfPresent(selector: string): void {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return;

  element.click();
}

const nativePlayerCommands: PlayerCommands = {
  playPause: () => clickIfPresent('div.playbutton'),
  prevTrack: () => clickIfPresent('div.prevbutton'),
  nextTrack: () => clickIfPresent('div.nextbutton'),

  seekBy: seconds => {
    const audio = document.querySelector('audio');
    if (!audio) return;

    audio.currentTime += seconds;
  },

  adjustVolumeBy: delta => {
    const input = document.querySelector<HTMLInputElement>('input.volume');
    if (!input) return;

    input.value = Math.min(1, Math.max(0, parseFloat(input.value) + delta)).toString();
    input.dispatchEvent(new Event('input'));
  }
};

export function volumeSliderCallback(e: Event): void {
  const target = e.target as HTMLInputElement;
  if (!target || !target.value) return;

  const volume = target.value;
  const audio = document.querySelector('audio') as HTMLAudioElement;
  if (!audio) return;

  audio.volume = parseFloat(volume);
}

export async function initPlayer(
  keyboardSettings?: KeyboardSettings,
  enableFetchCaching: boolean = false
): Promise<void> {
  const log = new Logger();

  const settings = keyboardSettings || DEFAULT_KEYBOARD_SETTINGS;

  log.info('Starting BES Player');

  registerNativePlayerShortcuts(settings);

  const progressBar = document.querySelector('.progbar') as HTMLElement;
  if (progressBar) {
    progressBar.style.cursor = 'pointer';
    progressBar.addEventListener('click', mousedownCallback);
  }

  movePlaylist();

  updatePlayerControlInterface();

  const { is_purchased, part_of_purchased_album } = extractFanTralbumData();
  if (is_purchased || part_of_purchased_album) return;

  const bandFollowInfo = extractBandFollowInfo();
  const tralbumId = bandFollowInfo.tralbum_id;
  const tralbumType = bandFollowInfo.tralbum_type;

  try {
    const fetchFn = createFetchFunction(enableFetchCaching);
    const tralbumDetails = await getTralbumDetails(tralbumId, tralbumType, null, fetchFn);
    document.querySelectorAll('tr.track_row_view').forEach((row, i) => {
      if (tralbumDetails.tracks[i] === undefined) return;

      const { price, currency, track_id: trackId, title: itemTitle, is_purchasable } = tralbumDetails.tracks[i];
      const type = 't';

      if (!is_purchasable) return;

      const infoCol = row.querySelector('.info-col');
      if (infoCol) infoCol.remove();

      const minimumPrice = price > 0.0 ? price : CURRENCY_MINIMUMS[currency];
      if (!minimumPrice) return;

      const oneClick = createAddToCartButton({
        price: minimumPrice,
        currency,
        tralbumId: String(trackId),
        itemTitle,
        type,
        log
      });

      const downloadCol = row.querySelector('.download-col');
      downloadCol.innerHTML = '';
      downloadCol.append(oneClick);
    });

    const { price, currency, id: albumId, title: itemTitle, is_purchasable, type } = tralbumDetails;
    if (!is_purchasable) return;

    const minimumPrice = price > 0.0 ? price : CURRENCY_MINIMUMS[currency];
    if (!minimumPrice) return;

    const oneClick = createAddToCartButton({
      price: minimumPrice,
      currency,
      tralbumId: String(albumId),
      itemTitle,
      type,
      log
    });

    const buyItemElement = document.querySelector('ul.tralbumCommands .buyItem.digital h3.hd');
    if (buyItemElement) {
      buyItemElement.append(oneClick);
    }
  } catch (error) {
    log.error(error);
  }
}

export function updatePlayerControlInterface(): void {
  const controls = document.createElement('div');
  controls.classList.add('controls');

  const volumeSlider = createVolumeSlider();
  volumeSlider.addEventListener('input', volumeSliderCallback);
  controls.append(volumeSlider);

  const playButton = transferPlayButton();
  controls.append(playButton);

  const prevNext = transferPreviousNextButtons();
  controls.append(prevNext);

  const inlineplayer = document.querySelector('div.inline_player');
  if (inlineplayer && !inlineplayer.classList.contains('hidden')) {
    inlineplayer.prepend(controls);
  }
}

export function movePlaylist(): void {
  const playlist = document.querySelector('table#track_table');
  if (playlist) {
    const player = document.querySelector('div.inline_player');
    if (player) {
      player.after(playlist);
    }
  }
}

export function createVolumeSlider(): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'range';
  input.classList.add('volume', 'thumb', 'progbar_empty');
  input.min = '0';
  input.max = '1';
  input.step = '0.01';
  input.title = 'volume control';

  const audio = document.querySelector('audio') as HTMLAudioElement;
  if (audio) {
    input.value = audio.volume.toString();
  }

  return input;
}

export function transferPlayButton(): HTMLDivElement {
  const play_cell = document.querySelector('td.play_cell') as HTMLTableCellElement;
  if (!play_cell || !play_cell.parentNode) {
    return document.createElement('div');
  }

  play_cell.parentNode.removeChild(play_cell);
  const play_button = play_cell.querySelector('a');
  const play_div = document.createElement('div');
  play_div.classList.add('play_cell');
  if (play_button) {
    play_div.append(play_button);
  }

  return play_div;
}

export function transferPreviousNextButtons(): HTMLDivElement {
  const prev_cell = document.querySelector('td.prev_cell') as HTMLTableCellElement;
  const prev_div = document.createElement('div');
  prev_div.classList.add('prev');

  if (prev_cell && prev_cell.parentNode) {
    prev_cell.parentNode.removeChild(prev_cell);
    const prev_button = prev_cell.querySelector('a');
    if (prev_button) {
      prev_div.append(prev_button);
    }
  }

  const next_cell = document.querySelector('td.next_cell') as HTMLTableCellElement;
  const next_div = document.createElement('div');
  next_div.classList.add('next');

  if (next_cell && next_cell.parentNode) {
    next_cell.parentNode.removeChild(next_cell);
    const next_button = next_cell.querySelector('a');
    if (next_button) {
      next_div.append(next_button);
    }
  }

  const div = document.createElement('div');
  div.append(prev_div);
  div.append(next_div);
  return div;
}
