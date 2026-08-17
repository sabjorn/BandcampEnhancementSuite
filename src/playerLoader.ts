import Logger from './logger';
import { getTralbumDetails, TralbumDetailsResponse, TralbumTrack } from './bclient';
import { getPlayerDrawerElements, updatePlayerDrawerInfo, updateMinimizedPlayButton } from './components/playerDrawer';
import { createFetchFunction, shouldHandleShortcut } from './utilities';
import { buildDrawerPlayer, buildTrackTable, buildAlbumBuyButton } from './nativePlayerBuilder';
import { KeyboardSettings, KeyboardAction, DEFAULT_KEYBOARD_SETTINGS, keyBindingToString } from './types/keyboard';
import { drawOverlay, generateAudioFeatures } from './audioFeatures';
import { volumeIcon, mutedVolumeIcon } from './components/playerIcons';
import { replaceChildren } from './components/dom';

const log = new Logger();

interface KeyHandlers {
  [key: string]: () => void;
}

interface DiscographyItem {
  id: string;
  type: string;
  element: Element;
}

let discographyOrder: DiscographyItem[] = [];
let currentAlbumIndex = -1;
let currentAlbumData: TralbumDetailsResponse | null = null;
let playerInitialized = false;
let currentTrackIndex = 0;
let audioElement: HTMLAudioElement | null = null;
let keyboardListenerAttached = false;
let activeKeyHandlers: KeyHandlers = {};
let configPort: chrome.runtime.Port | null = null;
let drawerPlayerCreated = false;
let previousVolume = 1.0;

const ALBUM_LOAD_SETTLE_MS = 300;

const inDrawer = <T extends HTMLElement>(selector: string): T | null =>
  document.querySelector<T>(`.bes-player-drawer ${selector}`);

const allInDrawer = <T extends HTMLElement>(selector: string): T[] =>
  Array.from(document.querySelectorAll<T>(`.bes-player-drawer ${selector}`));

const setText = (selector: string, text: string): void => {
  const element = inDrawer(selector);
  if (element) element.textContent = text;
};

const setStyle = (selector: string, apply: (style: CSSStyleDeclaration) => void): void => {
  const element = inDrawer(selector);
  if (element) apply(element.style);
};

function ensureAudioElement(): HTMLAudioElement {
  if (!audioElement) {
    audioElement = document.createElement('audio');
    audioElement.preload = 'none';
    audioElement.style.display = 'none';
    document.body.appendChild(audioElement);
    log.info('Created persistent audio element');
  }
  return audioElement;
}

function updateDrawerBpmBadge(bpm: number | null): void {
  const bpmNumber = document.querySelector('.bes-bpm-number') as HTMLSpanElement;
  if (bpmNumber) {
    if (bpm) {
      bpmNumber.textContent = bpm.toFixed(0);
    } else {
      bpmNumber.textContent = '';
    }
  }
}

export function extractDiscographyOrder(): DiscographyItem[] {
  const items: DiscographyItem[] = [];

  document.querySelectorAll('li.music-grid-item[data-item-id]').forEach(item => {
    const idAndType = (item as HTMLElement).dataset.itemId;
    if (!idAndType) return;

    const id = idAndType.split('-')[1];
    const type = idAndType.split('-')[0];
    items.push({ id, type, element: item });
  });

  document.querySelectorAll('li.music-grid-item[data-tralbumid][data-tralbumtype="a"]').forEach(item => {
    const id = (item as HTMLElement).dataset.tralbumid;
    if (!id) return;

    if (!items.find(i => i.id === id && i.type === 'album')) {
      items.push({ id, type: 'album', element: item });
    }
  });

  log.info(`Extracted ${items.length} items from discography`);
  return items;
}

export function updateDiscographyOrder(): void {
  discographyOrder = extractDiscographyOrder();
}

export function findAlbumIndexById(albumId: string): number {
  return discographyOrder.findIndex(item => item.id === albumId);
}

function convertToApiType(type: string): string {
  if (type === 'album' || type === 'a') return 'a';
  if (type === 'track' || type === 't') return 't';
  return type;
}

function attachGlobalKeyboardHandlers(settings: KeyboardSettings): void {
  if (keyboardListenerAttached) return;

  activeKeyHandlers = buildKeyHandlersFromSettings(settings);
  const preventDefault = true;

  document.addEventListener('keydown', (e: KeyboardEvent) => keydownCallback(e, activeKeyHandlers, preventDefault));

  keyboardListenerAttached = true;
  log.info('Drawer keyboard handlers attached');
}

export function initDrawerAudioFeatures(port: chrome.runtime.Port): void {
  if (!configPort) {
    configPort = port;
  }

  const canvas = inDrawer<HTMLCanvasElement>('canvas.bes-waveform');
  const bpmDisplay = inDrawer<HTMLSpanElement>('.bes-bpm-number');

  if (!canvas || !bpmDisplay) {
    log.warn('Drawer audio feature elements not found');
    return;
  }

  const audio = ensureAudioElement();
  const currentTarget = { value: undefined as string | undefined };
  const waveformColour = '#e2e2e6'; // Grey base waveform (unplayed)
  const waveformOverlayColour = '#5b53e8'; // Purple accent (played portion)

  audio.addEventListener('canplay', () => {
    if (currentTarget.value !== audio.src) {
      generateAudioFeatures(
        () => audioElement,
        canvas,
        bpm => updateDrawerBpmBadge(bpm),
        waveformColour,
        log,
        currentTarget,
        audioSrc =>
          audioSrc.includes('t4.bcbits.com/stream/')
            ? { stream: { type: 'direct-path' as const, path: audioSrc.split('stream/')[1] } }
            : { stream: { type: 'full-url' as const, url: audioSrc } }
      );
    }
  });

  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      const progress = audio.currentTime / audio.duration;
      drawOverlay(canvas, progress, waveformOverlayColour, waveformColour);
    }
  });
}

type DrawerPlayerParts = ReturnType<typeof buildDrawerPlayer>;
type DrawerElements = ReturnType<typeof getPlayerDrawerElements>;

function mountDrawerPlayer(elements: DrawerElements, parts: DrawerPlayerParts): void {
  const headerActions = elements.rightColumn?.querySelector<HTMLElement>('.bes-player-drawer-header-actions') ?? null;

  replaceChildren(elements.transportControls, parts.transportElement);
  replaceChildren(elements.playerContainer, parts.centerElement);
  replaceChildren(elements.rightColumn, headerActions, parts.volumeElement);
}

function startPlayerOnce(keyboardSettings?: KeyboardSettings): void {
  if (playerInitialized) return;

  ensureAudioElement();
  initializePlayer();
  attachGlobalKeyboardHandlers(keyboardSettings || DEFAULT_KEYBOARD_SETTINGS);
  playerInitialized = true;
}

export async function loadAlbumIntoDrawer(
  albumId: string,
  albumType: string,
  enableFetchCaching: boolean = false,
  keyboardSettings?: KeyboardSettings,
  port?: chrome.runtime.Port
): Promise<void> {
  log.info(`Loading album ${albumId} (${albumType}) into drawer`);

  try {
    const tralbumDetails = await getTralbumDetails(
      albumId,
      convertToApiType(albumType),
      null,
      createFetchFunction(enableFetchCaching)
    );

    currentAlbumData = tralbumDetails;
    currentAlbumIndex = findAlbumIndexById(albumId);

    const elements = getPlayerDrawerElements();
    if (!elements.playerContainer || !elements.tracklistContainer) {
      log.error('Player drawer elements not found');
      return;
    }

    updatePlayerDrawerInfo(extractAlbumArtFromPage(albumId, albumType));

    if (drawerPlayerCreated) {
      replaceChildren(
        elements.tracklistContainer,
        buildAlbumBuyButton(tralbumDetails),
        buildTrackTable(tralbumDetails)
      );
    } else {
      const parts = buildDrawerPlayer(tralbumDetails);

      mountDrawerPlayer(elements, parts);
      replaceChildren(elements.tracklistContainer, parts.albumBuyButton, parts.tracklistElement);
      drawerPlayerCreated = true;

      startPlayerOnce(keyboardSettings);
      if (port) initDrawerAudioFeatures(port);
    }

    attachTrackListHandlers();
    loadTrack(0);

    log.info(`Album loaded: ${tralbumDetails.title} by ${tralbumDetails.tralbum_artist}`);
  } catch (error) {
    log.error(`Failed to load album: ${error}`);
    throw error;
  }
}

function streamUrlOf(track: TralbumTrack | undefined): string | undefined {
  return track?.streaming_url?.['mp3-128'];
}

function isTrackPlayable(track: TralbumTrack | undefined): boolean {
  return Boolean(streamUrlOf(track));
}

function loadTrack(index: number): void {
  const tracks = currentAlbumData?.tracks;
  if (!tracks || !audioElement) {
    log.warn('No album data or audio element available');
    return;
  }

  if (index < 0 || index >= tracks.length) {
    log.warn(`Track index ${index} out of bounds (0-${tracks.length - 1})`);
    return;
  }

  currentTrackIndex = index;

  const track = tracks[index];
  const streamUrl = streamUrlOf(track);

  if (!streamUrl) {
    log.warn(`No streaming URL for track: ${track.title} (pre-order or disabled)`);

    const playableInstead = findAnyPlayableTrack(index);
    if (playableInstead === -1 || playableInstead === index) return;

    log.info(`Skipping to playable track ${playableInstead}`);
    loadTrack(playableInstead);
    return;
  }

  log.info(`Loading track ${index}: ${track.title}`);
  audioElement.src = streamUrl;

  updateTrackInfo(track.title);
  updateTrackRows(index);
  updatePrevNextButtons(index, tracks.length);
}

export function findPlayableTrackAfter(tracks: TralbumTrack[] | undefined, startIndex: number): number {
  if (!tracks) return -1;

  for (let i = startIndex + 1; i < tracks.length; i++) {
    if (isTrackPlayable(tracks[i])) {
      return i;
    }
  }

  return -1;
}

export function findPlayableTrackBefore(tracks: TralbumTrack[] | undefined, startIndex: number): number {
  if (!tracks) return -1;

  for (let i = Math.min(startIndex, tracks.length) - 1; i >= 0; i--) {
    if (isTrackPlayable(tracks[i])) {
      return i;
    }
  }

  return -1;
}

function findAnyPlayableTrack(startIndex: number): number {
  const tracks = currentAlbumData?.tracks;
  const after = findPlayableTrackAfter(tracks, startIndex);
  return after !== -1 ? after : findPlayableTrackBefore(tracks, startIndex);
}

function updateTrackInfo(title: string): void {
  setText('.bes-now-playing-title', title);
  if (!currentAlbumData) return;

  setText('.bes-album-label', currentAlbumData.title);
  setText('.bes-artist-name', currentAlbumData.tralbum_artist);
}

function updateTrackRows(index: number): void {
  const trackRows = allInDrawer('.bes-track-row');
  trackRows.forEach((row, i) => {
    row.classList.toggle('bes-track-playing', i === index);
  });
}

function updatePrevNextButtons(index: number, totalTracks: number): void {
  const prevButton = inDrawer('.bes-transport-prev');
  const nextButton = inDrawer('.bes-transport-next');

  const hasEarlierTrackOrAlbum = index > 0 || currentAlbumIndex > 0;
  const hasLaterTrackOrAlbum = index < totalTracks - 1 || currentAlbumIndex < discographyOrder.length - 1;

  prevButton?.classList.toggle('bes-hidden', !hasEarlierTrackOrAlbum);
  nextButton?.classList.toggle('bes-hidden', !hasLaterTrackOrAlbum);
}

function resumePlayback(): void {
  audioElement?.play().catch(error => log.error(`Failed to play: ${error}`));
}

function playPause(): void {
  if (!audioElement) return;

  if (audioElement.paused) {
    resumePlayback();
    return;
  }

  audioElement.pause();
}

interface TrackStep {
  name: string;
  nextWithinAlbum: (tracks: TralbumTrack[] | undefined, from: number) => number;
  hasAdjacentAlbum: () => boolean;
  loadAdjacentAlbum: () => Promise<boolean>;
  entryTrack: (tracks: TralbumTrack[] | undefined) => number;
}

const forward: TrackStep = {
  name: 'next',
  nextWithinAlbum: findPlayableTrackAfter,
  hasAdjacentAlbum: () => currentAlbumIndex < discographyOrder.length - 1,
  loadAdjacentAlbum: loadNextAlbum,
  entryTrack: tracks => findPlayableTrackAfter(tracks, -1)
};

const backward: TrackStep = {
  name: 'previous',
  nextWithinAlbum: findPlayableTrackBefore,
  hasAdjacentAlbum: () => currentAlbumIndex > 0,
  loadAdjacentAlbum: loadPreviousAlbum,
  entryTrack: tracks => findPlayableTrackBefore(tracks, tracks?.length ?? 0)
};

async function step(direction: TrackStep, keepPlaying: boolean): Promise<void> {
  const withinAlbum = direction.nextWithinAlbum(currentAlbumData?.tracks, currentTrackIndex);
  log.debug(`Stepping ${direction.name} from ${currentTrackIndex}, playable track is ${withinAlbum}`);

  if (withinAlbum !== -1) {
    loadTrack(withinAlbum);
    if (keepPlaying) resumePlayback();
    return;
  }

  if (!direction.hasAdjacentAlbum()) {
    log.debug(`No playable track ${direction.name} and no ${direction.name} album`);
    return;
  }

  log.info(`No playable track ${direction.name}: loading ${direction.name} album in discography`);
  await direction.loadAdjacentAlbum();

  setTimeout(() => {
    const entry = direction.entryTrack(currentAlbumData?.tracks);
    if (entry === -1) {
      log.warn(`The ${direction.name} album has no playable tracks`);
      return;
    }

    loadTrack(entry);
    if (keepPlaying) resumePlayback();
  }, ALBUM_LOAD_SETTLE_MS);
}

function nextTrack(): Promise<void> {
  return step(forward, Boolean(audioElement && !audioElement.paused));
}

function prevTrack(): Promise<void> {
  return step(backward, Boolean(audioElement && !audioElement.paused));
}

function toggleMute(): void {
  if (!audioElement) return;

  if (audioElement.volume > 0) {
    previousVolume = audioElement.volume;
    audioElement.volume = 0;
    updateVolumeDisplay(0);
    updateMuteButton(true);
  } else {
    audioElement.volume = previousVolume;
    updateVolumeDisplay(previousVolume);
    updateMuteButton(false);
  }
}

function updateTimeDisplay(currentTime: number, duration: number): void {
  setText('.bes-time-elapsed', formatTime(currentTime));
  if (!isNaN(duration)) setText('.bes-time-total', formatTime(duration));
}

function updateProgressBar(): void {
  if (!audioElement) return;

  const percent = (audioElement.currentTime / audioElement.duration) * 100;

  setStyle('.bes-progbar-fill', style => (style.width = `${percent}%`));
  setStyle('.bes-slider-container .bes-progbar-thumb', style => (style.left = `${percent}%`));

  updateTimeDisplay(audioElement.currentTime, audioElement.duration);
}

export function isPlaybackClick(target: HTMLElement | null): boolean {
  if (!target) return false;
  return !target.closest('.bes-track-link, .bes-track-buy-col');
}

function playTrackFromList(index: number): void {
  if (!audioElement) return;

  if (currentTrackIndex === index) {
    playPause();
    return;
  }

  loadTrack(index);
  resumePlayback();
}

function attachTrackListHandlers(): void {
  allInDrawer('.bes-track-row').forEach((row, index) => {
    row.addEventListener('click', event => {
      if (!isPlaybackClick(event.target as HTMLElement)) return;

      playTrackFromList(index);
    });
  });
}

function updateVolumeDisplay(volume: number): void {
  const percent = volume * 100;

  setStyle('.bes-volume-fill', style => (style.height = `${percent}%`));
  setStyle('.bes-volume-thumb', style => (style.bottom = `${percent}%`));
  setText('.bes-volume-percent', `${Math.round(percent)}%`);
}

function updateMuteButton(isMuted: boolean): void {
  const muteButton = inDrawer('.bes-volume-mute');
  if (!muteButton) return;

  muteButton.innerHTML = isMuted ? mutedVolumeIcon(19) : volumeIcon(19);
}

function bindTransportControls(): void {
  const bind = (selector: string, handler: () => void) => {
    const button = inDrawer(selector);
    if (button) button.onclick = handler;
  };

  bind('.bes-transport-play', playPause);
  bind('.bes-transport-prev', prevTrack);
  bind('.bes-transport-next', nextTrack);
  bind('.bes-volume-mute', toggleMute);
}

function bindSeeking(audio: HTMLAudioElement): void {
  const progbar = inDrawer('.bes-progbar');
  if (!progbar) return;

  progbar.onclick = event => {
    const { left, width } = progbar.getBoundingClientRect();
    audio.currentTime = ((event.clientX - left) / width) * audio.duration;
  };
}

function bindVolumeSlider(audio: HTMLAudioElement): void {
  const slider = inDrawer('.bes-volume');
  if (!slider) return;

  let dragging = false;

  const volumeAt = (event: PointerEvent): number => {
    const { top, height } = slider.getBoundingClientRect();
    return Math.max(0, Math.min(1, 1 - (event.clientY - top) / height));
  };

  const applyVolume = (event: PointerEvent) => {
    audio.volume = volumeAt(event);
    updateVolumeDisplay(audio.volume);
  };

  slider.onpointerdown = event => {
    dragging = true;
    slider.setPointerCapture(event.pointerId);
    applyVolume(event);
  };

  slider.onpointermove = event => {
    if (dragging) applyVolume(event);
  };

  slider.onpointerup = event => {
    dragging = false;
    slider.releasePointerCapture(event.pointerId);
  };
}

function bindAudioEvents(audio: HTMLAudioElement, playButton: HTMLElement): void {
  const reflectPlaying = (isPlaying: boolean) => () => {
    playButton.classList.toggle('playing', isPlaying);
    updateMinimizedPlayButton(isPlaying);
  };

  audio.onplay = reflectPlaying(true);
  audio.onpause = reflectPlaying(false);
  audio.onended = () => step(forward, true);
  audio.ontimeupdate = updateProgressBar;
}

function initializePlayer(): void {
  log.info('Initializing player');

  const audio = audioElement;
  const playButton = inDrawer('.bes-transport-play');
  if (!audio || !playButton) {
    log.error('Required player elements not found');
    return;
  }

  audio.volume = 1.0;
  updateVolumeDisplay(audio.volume);

  bindTransportControls();
  bindSeeking(audio);
  bindVolumeSlider(audio);
  bindAudioEvents(audio, playButton);
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function seekBy(seconds: number): void {
  if (!audioElement) return;

  audioElement.currentTime += seconds;
}

function adjustVolumeBy(delta: number): void {
  if (!audioElement) return;

  audioElement.volume = Math.min(1, Math.max(0, audioElement.volume + delta));
  updateVolumeDisplay(audioElement.volume);
  updateMuteButton(audioElement.volume === 0);
}

function handlerForEachAction(settings: KeyboardSettings): Record<KeyboardAction, () => void> {
  return {
    [KeyboardAction.PLAY_PAUSE]: playPause,
    [KeyboardAction.PLAY_PAUSE_ALT]: playPause,
    [KeyboardAction.PREV_TRACK]: prevTrack,
    [KeyboardAction.NEXT_TRACK]: nextTrack,
    [KeyboardAction.SEEK_FORWARD]: () => seekBy(settings.seekStepSize),
    [KeyboardAction.SEEK_BACKWARD]: () => seekBy(-settings.seekStepSize),
    [KeyboardAction.SEEK_FORWARD_LARGE]: () => seekBy(settings.largeSeekStepSize),
    [KeyboardAction.SEEK_BACKWARD_LARGE]: () => seekBy(-settings.largeSeekStepSize),
    [KeyboardAction.VOLUME_UP]: () => adjustVolumeBy(settings.volumeStep),
    [KeyboardAction.VOLUME_DOWN]: () => adjustVolumeBy(-settings.volumeStep)
  };
}

function buildKeyHandlersFromSettings(settings: KeyboardSettings): KeyHandlers {
  const byAction = handlerForEachAction(settings);

  return settings.controls
    .filter(control => control.enabled)
    .reduce<KeyHandlers>((handlers, control) => {
      handlers[keyBindingToString(control.binding)] = byAction[control.action];
      return handlers;
    }, {});
}

function keydownCallback(e: KeyboardEvent, keyHandlers: KeyHandlers, preventDefault: boolean): void {
  const drawer = document.querySelector('.bes-player-drawer');
  if (!drawer || !(drawer as HTMLElement).classList.contains('open')) {
    return;
  }

  if (!shouldHandleShortcut(e.target)) {
    return;
  }

  if (e.key === 'Meta' && !e.altKey && !e.ctrlKey && !e.shiftKey) {
    return;
  }

  const currentCombo = keyBindingToString({
    key: e.key,
    alt: e.altKey,
    ctrl: e.ctrlKey,
    shift: e.shiftKey,
    meta: e.metaKey
  });

  log.info(`Drawer keydown: ${currentCombo}`);

  const handler = keyHandlers[currentCombo] || keyHandlers[e.key];

  if (!handler) {
    return;
  }
  handler();

  if (preventDefault) {
    e.preventDefault();
  }
}

function extractAlbumArtFromPage(albumId: string, albumType: string): string {
  const itemId = `${albumType}-${albumId}`;

  let gridItem = document.querySelector(`li.music-grid-item[data-item-id="${itemId}"]`);

  if (!gridItem) {
    gridItem = document.querySelector(`li.music-grid-item[data-tralbumid="${albumId}"]`);
  }

  if (gridItem) {
    const img = gridItem.querySelector('img');
    if (img) {
      return img.src;
    }
  }

  return '';
}

export async function loadNextAlbum(enableFetchCaching: boolean = false): Promise<boolean> {
  if (currentAlbumIndex === -1 || currentAlbumIndex >= discographyOrder.length - 1) {
    log.info('No next album available');
    return false;
  }

  const nextItem = discographyOrder[currentAlbumIndex + 1];
  await loadAlbumIntoDrawer(nextItem.id, nextItem.type, enableFetchCaching);
  return true;
}

export async function loadPreviousAlbum(enableFetchCaching: boolean = false): Promise<boolean> {
  if (currentAlbumIndex <= 0) {
    log.info('No previous album available');
    return false;
  }

  const prevItem = discographyOrder[currentAlbumIndex - 1];
  await loadAlbumIntoDrawer(prevItem.id, prevItem.type, enableFetchCaching);
  return true;
}

export function getCurrentAlbumData(): TralbumDetailsResponse | null {
  return currentAlbumData;
}

export function getCurrentAlbumIndex(): number {
  return currentAlbumIndex;
}

export function getCurrentTrackIndex(): number {
  return currentTrackIndex;
}

export function getDiscographyLength(): number {
  return discographyOrder.length;
}
