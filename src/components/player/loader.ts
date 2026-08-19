import Logger from '../../logger';
import { getTralbumDetails, TralbumDetailsResponse, TralbumTrack } from '../../bclient';
import { getPlayerDrawerElements, updatePlayerDrawerInfo, updateMinimizedPlayButton } from './drawer';
import { createFetchFunction } from '../../utilities';
import { buildDrawerPlayer, buildTrackTable, buildAlbumBuyButton } from './builder';
import { PlayerCommands, registerPlayerShortcuts } from '../../keyboardShortcuts';
import { drawOverlay, generateAudioFeatures } from '../../audioFeatures';
import { volumeIcon, mutedVolumeIcon } from './icons';
import { replaceChildren } from '../dom';
import { inDrawer, allInDrawer, setText, setStyle } from './query';
import { streamUrlOf, findPlayableTrackAfter, findPlayableTrackBefore } from './trackSelection';
import { applyTrackState, markRowPlayed } from './trackState';
import {
  selectAlbum,
  hasNextAlbum,
  hasPreviousAlbum,
  nextAlbum,
  previousAlbum,
  albumArtUrlFor
} from '../../discography';

const log = new Logger();

let currentAlbumData: TralbumDetailsResponse | null = null;
let playerInitialized = false;
let currentTrackIndex = 0;
let audioElement: HTMLAudioElement | null = null;
let drawerShortcutsRegistered = false;
let drawerPlayerCreated = false;
let previousVolume = 1.0;
let configPort: chrome.runtime.Port | null = null;
let waveformEnabled = true;

const ALBUM_LOAD_SETTLE_MS = 300;

const reportedPlays = new Set<number>();

async function loadTrackState(albumId: string): Promise<void> {
  try {
    const state = await chrome.runtime.sendMessage({
      contentScriptQuery: 'fetchAlbumTrackState',
      albumId
    });

    if (!state) {
      log.debug(`No track state available for album ${albumId}`);
      return;
    }

    applyTrackState(state);
  } catch (error) {
    log.warn(`Failed to load track state for album ${albumId}: ${error}`);
  }
}

async function reportPlay(): Promise<void> {
  const trackId = currentTrack()?.track_id;
  if (!trackId || reportedPlays.has(trackId)) return;

  reportedPlays.add(trackId);
  markRowPlayed(trackId);

  try {
    await chrome.runtime.sendMessage({ contentScriptQuery: 'postTrackPlayed', trackId });
  } catch (error) {
    log.warn(`Failed to report play for track ${trackId}: ${error}`);
  }
}

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

function convertToApiType(type: string): string {
  if (type === 'album' || type === 'a') return 'a';
  if (type === 'track' || type === 't') return 't';
  return type;
}

function showWaveform(enabled: boolean): void {
  waveformEnabled = enabled;

  inDrawer('.bes-waveform-container')?.classList.toggle('bes-visible', enabled);
  inDrawer('.bes-slider-container')?.classList.toggle('bes-visible', !enabled);
  inDrawer('.bes-toggle-waveform')?.classList.toggle('bes-toggle-active', enabled);
  inDrawer('.bes-toggle-slider')?.classList.toggle('bes-toggle-active', !enabled);
}

function bindViewToggle(): void {
  const requestWaveform = (enabled: boolean) => () => {
    if (enabled === waveformEnabled) return;

    showWaveform(enabled);
    configPort?.postMessage({ toggleWaveformDisplay: {} });
  };

  const waveformButton = inDrawer('.bes-toggle-waveform');
  const sliderButton = inDrawer('.bes-toggle-slider');

  if (waveformButton) waveformButton.onclick = requestWaveform(true);
  if (sliderButton) sliderButton.onclick = requestWaveform(false);
}

const drawerCommands: PlayerCommands = {
  playPause,
  prevTrack,
  nextTrack,
  seekBy,
  adjustVolumeBy
};

function drawerIsOpen(): boolean {
  return Boolean(document.querySelector('.bes-player-drawer.open'));
}

function registerDrawerShortcuts(): void {
  if (drawerShortcutsRegistered) return;

  registerPlayerShortcuts(drawerCommands, drawerIsOpen);
  drawerShortcutsRegistered = true;
}

export function initDrawerAudioFeatures(port: chrome.runtime.Port): void {
  const canvas = inDrawer<HTMLCanvasElement>('canvas.bes-waveform');
  const bpmDisplay = inDrawer<HTMLSpanElement>('.bes-bpm-number');

  if (!canvas || !bpmDisplay) {
    log.warn('Drawer audio feature elements not found');
    return;
  }

  configPort = port;

  const audio = ensureAudioElement();
  const currentTarget = { value: undefined as string | undefined };
  const waveformColour = '#e2e2e6';
  const waveformOverlayColour = '#5b53e8';

  audio.addEventListener('canplay', () => {
    if (!waveformEnabled || currentTarget.value === audio.src) return;

    generateAudioFeatures(() => audioElement, canvas, updateDrawerBpmBadge, waveformColour, log, currentTarget, {
      trackId: currentTrack()?.track_id,
      urlFormatter: audioSrc =>
        audioSrc.includes('t4.bcbits.com/stream/')
          ? { stream: { type: 'direct-path' as const, path: audioSrc.split('stream/')[1] } }
          : { stream: { type: 'full-url' as const, url: audioSrc } }
    });
  });

  audio.addEventListener('timeupdate', () => {
    if (!waveformEnabled || !audio.duration) return;

    drawOverlay(canvas, audio.currentTime / audio.duration, waveformOverlayColour, waveformColour);
  });

  bindViewToggle();

  port.onMessage.addListener((message: { config?: { displayWaveform?: boolean } }) => {
    if (typeof message?.config?.displayWaveform !== 'boolean') return;

    showWaveform(message.config.displayWaveform);
  });
  port.postMessage({ requestConfig: {} });
}

type DrawerPlayerParts = ReturnType<typeof buildDrawerPlayer>;
type DrawerElements = ReturnType<typeof getPlayerDrawerElements>;

function mountDrawerPlayer(elements: DrawerElements, parts: DrawerPlayerParts): void {
  const headerActions = elements.rightColumn?.querySelector<HTMLElement>('.bes-player-drawer-header-actions') ?? null;

  replaceChildren(elements.transportControls, parts.transportElement);
  replaceChildren(elements.playerContainer, parts.centerElement);
  replaceChildren(elements.rightColumn, headerActions, parts.volumeElement);
}

function startPlayerOnce(): void {
  if (playerInitialized) return;

  ensureAudioElement();
  initializePlayer();
  registerDrawerShortcuts();
  playerInitialized = true;
}

export async function loadAlbumIntoDrawer(
  albumId: string,
  albumType: string,
  enableFetchCaching: boolean = false,
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
    selectAlbum(albumId);

    const elements = getPlayerDrawerElements();
    if (!elements.playerContainer || !elements.tracklistContainer) {
      log.error('Player drawer elements not found');
      return;
    }

    updatePlayerDrawerInfo(albumArtUrlFor(albumId, albumType));

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

      startPlayerOnce();
      if (port) initDrawerAudioFeatures(port);
    }

    attachTrackListHandlers();
    loadTrack(0);
    loadTrackState(albumId);

    log.info(`Album loaded: ${tralbumDetails.title} by ${tralbumDetails.tralbum_artist}`);
  } catch (error) {
    log.error(`Failed to load album: ${error}`);
    throw error;
  }
}

function currentTrack(): TralbumTrack | undefined {
  return currentAlbumData?.tracks?.[currentTrackIndex];
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

  const hasEarlierTrackOrAlbum = index > 0 || hasPreviousAlbum();
  const hasLaterTrackOrAlbum = index < totalTracks - 1 || hasNextAlbum();

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
  hasAdjacentAlbum: hasNextAlbum,
  loadAdjacentAlbum: loadNextAlbum,
  entryTrack: tracks => findPlayableTrackAfter(tracks, -1)
};

const backward: TrackStep = {
  name: 'previous',
  nextWithinAlbum: findPlayableTrackBefore,
  hasAdjacentAlbum: hasPreviousAlbum,
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

  audio.onplay = () => {
    reflectPlaying(true)();
    reportPlay();
  };
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

export async function loadNextAlbum(enableFetchCaching: boolean = false): Promise<boolean> {
  const item = nextAlbum();
  if (!item) {
    log.info('No next album available');
    return false;
  }

  await loadAlbumIntoDrawer(item.id, item.type, enableFetchCaching);
  return true;
}

export async function loadPreviousAlbum(enableFetchCaching: boolean = false): Promise<boolean> {
  const item = previousAlbum();
  if (!item) {
    log.info('No previous album available');
    return false;
  }

  await loadAlbumIntoDrawer(item.id, item.type, enableFetchCaching);
  return true;
}

export function getCurrentAlbumData(): TralbumDetailsResponse | null {
  return currentAlbumData;
}

export function getCurrentTrackIndex(): number {
  return currentTrackIndex;
}
