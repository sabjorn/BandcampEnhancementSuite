import Logger from './logger';
import { getTralbumDetails, TralbumDetailsResponse, CURRENCY_MINIMUMS } from './bclient';
import { getPlayerDrawerElements, updatePlayerDrawerInfo, updateMinimizedPlayButton } from './components/playerDrawer';
import { createFetchFunction } from './utilities';
import { buildDrawerPlayer, buildTrackTable } from './nativePlayerBuilder';
import { KeyboardSettings, KeyboardAction, DEFAULT_KEYBOARD_SETTINGS, keyBindingToString } from './types/keyboard';
import { drawOverlay, generateAudioFeatures } from './audioFeatures';
import { createAddToCartButton } from './components/cartButton';

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

// Create persistent audio element once
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

// Update track info inside drawer player
function updateDrawerTrackInfo(albumName: string, artistName: string, trackTitle: string): void {
  const albumLabel = document.querySelector('.bes-album-label') as HTMLDivElement;
  const trackTitleEl = document.querySelector('.bes-now-playing-title') as HTMLDivElement;
  const artistNameEl = document.querySelector('.bes-artist-name') as HTMLDivElement;

  if (albumLabel) albumLabel.textContent = albumName;
  if (trackTitleEl) trackTitleEl.textContent = trackTitle;
  if (artistNameEl) artistNameEl.textContent = artistName;
}

// Update BPM badge inside drawer player
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
  // Store port for later use
  if (!configPort) {
    configPort = port;
  }

  const canvas = document.querySelector('.bes-player-drawer canvas.bes-waveform') as HTMLCanvasElement;
  const bpmDisplay = document.querySelector('.bes-player-drawer .bes-bpm-number') as HTMLSpanElement;

  if (!canvas || !bpmDisplay) {
    log.warn('Drawer audio feature elements not found');
    return;
  }

  const audio = ensureAudioElement();
  const currentTarget = { value: undefined as string | undefined };
  const waveformColour = '#e2e2e6'; // Grey base waveform (unplayed)
  const waveformOverlayColour = '#5b53e8'; // Purple accent (played portion)

  // Set up audio event listeners for waveform
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

export async function loadAlbumIntoDrawer(
  albumId: string,
  albumType: string,
  enableFetchCaching: boolean = false,
  keyboardSettings?: KeyboardSettings,
  port?: chrome.runtime.Port
): Promise<void> {
  log.info(`Loading album ${albumId} (${albumType}) into drawer`);

  try {
    const fetchFn = createFetchFunction(enableFetchCaching);
    const apiType = convertToApiType(albumType);
    const tralbumDetails = await getTralbumDetails(albumId, apiType, null, fetchFn);

    currentAlbumData = tralbumDetails;
    currentAlbumIndex = findAlbumIndexById(albumId);

    const elements = getPlayerDrawerElements();
    if (!elements.playerContainer || !elements.tracklistContainer) {
      log.error('Player drawer elements not found');
      return;
    }

    const albumArtUrl = extractAlbumArtFromPage(albumId, albumType);
    updatePlayerDrawerInfo(albumArtUrl);

    // Update track info inside player (if it exists)
    updateDrawerTrackInfo(tralbumDetails.title, tralbumDetails.tralbum_artist, tralbumDetails.title);

    // Create player controls ONCE on first load
    if (!drawerPlayerCreated) {
      const { transportElement, centerElement, volumeElement, tracklistElement, albumBuyButton } =
        buildDrawerPlayer(tralbumDetails);

      // Populate the three columns
      if (elements.transportControls) {
        elements.transportControls.innerHTML = '';
        elements.transportControls.appendChild(transportElement);
      }

      elements.playerContainer.innerHTML = '';
      elements.playerContainer.appendChild(centerElement);

      if (elements.rightColumn) {
        // Preserve header actions (minimize/close buttons) at top
        const headerActions = elements.rightColumn.querySelector('.bes-player-drawer-header-actions');
        elements.rightColumn.innerHTML = '';
        if (headerActions) {
          elements.rightColumn.appendChild(headerActions);
        }
        elements.rightColumn.appendChild(volumeElement);
      }

      if (elements.tracklistContainer) {
        elements.tracklistContainer.innerHTML = '';
        // Add album buy button ABOVE tracklist if it exists
        if (albumBuyButton) {
          elements.tracklistContainer.appendChild(albumBuyButton);
        }
        elements.tracklistContainer.appendChild(tracklistElement);
      }

      drawerPlayerCreated = true;

      // Ensure persistent audio element exists
      ensureAudioElement();

      // Initialize player event listeners ONCE
      if (!playerInitialized) {
        initializePlayer();
        playerInitialized = true;

        // Attach keyboard handlers
        const settings = keyboardSettings || DEFAULT_KEYBOARD_SETTINGS;
        attachGlobalKeyboardHandlers(settings);
      }

      // Initialize audio features ONCE
      if (port) {
        initDrawerAudioFeatures(port);
      }
    } else {
      // Just update the tracklist for subsequent albums
      const tracklistElement = buildTrackTable(tralbumDetails);

      // Rebuild album buy button if album is purchasable
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

      if (elements.tracklistContainer) {
        elements.tracklistContainer.innerHTML = '';
        // Add album buy button ABOVE tracklist if it exists
        if (albumBuyButton) {
          elements.tracklistContainer.appendChild(albumBuyButton);
        }
        elements.tracklistContainer.appendChild(tracklistElement);
      }
    }

    // Attach track list handlers (happens after every album load)
    attachTrackListHandlers();

    // Load first track (but don't play)
    loadTrack(0);

    log.info(`Album loaded: ${tralbumDetails.title} by ${tralbumDetails.tralbum_artist}`);
  } catch (error) {
    log.error(`Failed to load album: ${error}`);
    throw error;
  }
}

function isTrackPlayable(track: any): boolean {
  return Boolean(track?.streaming_url?.['mp3-128']);
}

function loadTrack(index: number): void {
  if (!currentAlbumData?.tracks || !audioElement) {
    log.warn('No album data or audio element available');
    return;
  }

  const tracks = currentAlbumData.tracks;
  if (index < 0 || index >= tracks.length) {
    log.warn(`Track index ${index} out of bounds (0-${tracks.length - 1})`);
    return;
  }

  const track = tracks[index];

  log.debug(`loadTrack(${index}): ${track.title}, isPlayable=${isTrackPlayable(track)}`);

  currentTrackIndex = index;

  // Set audio source - DO NOT call .play() here
  if (isTrackPlayable(track)) {
    log.info(`Loading track ${index}: ${track.title}`);
    audioElement.src = track.streaming_url!['mp3-128'];
  } else {
    log.warn(`No streaming URL for track: ${track.title} (pre-order or disabled)`);
    // Try to find next track with streaming URL
    const nextIndex = findNextPlayableTrack(index);
    log.debug(`Track ${index} unplayable, findNextPlayableTrack returned ${nextIndex}`);
    if (nextIndex !== -1 && nextIndex !== index) {
      log.info(`Skipping to next playable track: ${nextIndex}`);
      loadTrack(nextIndex);
      return;
    }
    return;
  }

  // Update UI
  updateTrackInfo(track.title);
  updateTrackRows(index);
  updatePrevNextButtons(index, tracks.length);
}

function findNextPlayableTrack(startIndex: number): number {
  if (!currentAlbumData?.tracks) return -1;

  const tracks = currentAlbumData.tracks;
  // Search forward
  for (let i = startIndex + 1; i < tracks.length; i++) {
    if (isTrackPlayable(tracks[i])) {
      return i;
    }
  }

  // Search backward (fallback if no forward playable track)
  for (let i = startIndex - 1; i >= 0; i--) {
    if (isTrackPlayable(tracks[i])) {
      return i;
    }
  }

  return -1;
}

function findPrevPlayableTrack(startIndex: number): number {
  if (!currentAlbumData?.tracks) return -1;

  const tracks = currentAlbumData.tracks;
  // Search backward
  for (let i = startIndex - 1; i >= 0; i--) {
    if (isTrackPlayable(tracks[i])) {
      return i;
    }
  }

  // Search forward (fallback if no backward playable track)
  for (let i = startIndex + 1; i < tracks.length; i++) {
    if (isTrackPlayable(tracks[i])) {
      return i;
    }
  }

  return -1;
}

function updateTrackInfo(title: string): void {
  // Update track title, album, and artist in new player structure
  const trackTitleEl = document.querySelector('.bes-player-drawer .bes-now-playing-title') as HTMLDivElement;
  const albumLabel = document.querySelector('.bes-player-drawer .bes-album-label') as HTMLDivElement;
  const artistName = document.querySelector('.bes-player-drawer .bes-artist-name') as HTMLDivElement;

  if (trackTitleEl) {
    trackTitleEl.textContent = title;
  }

  if (currentAlbumData) {
    if (albumLabel) {
      albumLabel.textContent = currentAlbumData.title;
    }
    if (artistName) {
      artistName.textContent = currentAlbumData.tralbum_artist;
    }
  }
}

function updateTrackRows(index: number): void {
  const trackRows = document.querySelectorAll('.bes-player-drawer .bes-track-row');
  trackRows.forEach((row, i) => {
    row.classList.toggle('bes-track-playing', i === index);
  });
}

function updatePrevNextButtons(index: number, totalTracks: number): void {
  const prevButton = document.querySelector('.bes-player-drawer .bes-transport-prev');
  const nextButton = document.querySelector('.bes-player-drawer .bes-transport-next');

  // Prev button: hide only if at first track AND no previous album available
  const canGoPrev = index > 0 || currentAlbumIndex > 0;
  prevButton?.classList.toggle('bes-hidden', !canGoPrev);

  // Next button: hide only if at last track AND no next album available
  const canGoNext = index < totalTracks - 1 || currentAlbumIndex < discographyOrder.length - 1;
  nextButton?.classList.toggle('bes-hidden', !canGoNext);
}

// Core player control functions - shared by button clicks and keyboard shortcuts
function playPause(): void {
  if (!audioElement) return;

  if (audioElement.paused) {
    audioElement.play().catch(error => {
      log.error(`Failed to play: ${error}`);
    });
  } else {
    audioElement.pause();
  }
}

async function nextTrack(): Promise<void> {
  if (!audioElement) return;

  log.debug(`Next track: currentTrackIndex=${currentTrackIndex}, totalTracks=${currentAlbumData?.tracks?.length}`);

  if (currentAlbumData?.tracks && currentTrackIndex < currentAlbumData.tracks.length - 1) {
    // Not on last track - find next playable track within same album
    const nextIndex = findNextPlayableTrack(currentTrackIndex);
    log.debug(`findNextPlayableTrack(${currentTrackIndex}) returned ${nextIndex}`);

    if (nextIndex !== -1) {
      const wasPlaying = !audioElement.paused;
      log.debug(`Loading next track ${nextIndex}, wasPlaying=${wasPlaying}`);
      loadTrack(nextIndex);
      if (wasPlaying) {
        audioElement.play().catch(error => {
          log.error(`Failed to play: ${error}`);
        });
      }
    } else {
      log.debug(`No playable track found, staying on track ${currentTrackIndex}`);
    }
  } else if (currentAlbumData?.tracks && currentTrackIndex === currentAlbumData.tracks.length - 1) {
    // On last track - load next album if available (AC-N2)
    if (currentAlbumIndex < discographyOrder.length - 1) {
      const wasPlaying = !audioElement.paused;
      log.info('Next button on last track: loading next album in discography');
      await loadNextAlbum();
      // Load and play first track of next album
      setTimeout(() => {
        loadTrack(0);
        if (wasPlaying) {
          audioElement?.play().catch(error => {
            log.error(`Failed to play: ${error}`);
          });
        }
      }, 300);
    } else {
      log.debug(`Already on last track of last album, doing nothing`);
    }
  }
}

async function prevTrack(): Promise<void> {
  if (!audioElement) return;

  log.debug(`Prev track: currentTrackIndex=${currentTrackIndex}`);

  if (currentTrackIndex > 0) {
    // Not on first track - find previous playable track within same album
    const prevIndex = findPrevPlayableTrack(currentTrackIndex);
    log.debug(`findPrevPlayableTrack(${currentTrackIndex}) returned ${prevIndex}`);

    if (prevIndex !== -1) {
      const wasPlaying = !audioElement.paused;
      log.debug(`Loading prev track ${prevIndex}, wasPlaying=${wasPlaying}`);
      loadTrack(prevIndex);
      if (wasPlaying) {
        audioElement.play().catch(error => {
          log.error(`Failed to play: ${error}`);
        });
      }
    } else {
      log.debug(`No playable track found, staying on track ${currentTrackIndex}`);
    }
  } else if (currentTrackIndex === 0) {
    // On first track - load previous album if available (AC-N1)
    if (currentAlbumIndex > 0) {
      const wasPlaying = !audioElement.paused;
      log.info('Prev button on first track: loading previous album in discography');
      await loadPreviousAlbum();
      // Load and play last track of previous album
      setTimeout(() => {
        if (currentAlbumData?.tracks) {
          const lastTrackIndex = currentAlbumData.tracks.length - 1;
          loadTrack(lastTrackIndex);
          if (wasPlaying) {
            audioElement?.play().catch(error => {
              log.error(`Failed to play: ${error}`);
            });
          }
        }
      }, 300);
    } else {
      log.debug(`Already on first track of first album, doing nothing`);
    }
  }
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
  const timeElapsed = document.querySelector('.bes-player-drawer .bes-time-elapsed');
  if (timeElapsed) {
    timeElapsed.textContent = formatTime(currentTime);
  }

  const timeTotal = document.querySelector('.bes-player-drawer .bes-time-total');
  if (timeTotal && !isNaN(duration)) {
    timeTotal.textContent = formatTime(duration);
  }

  const timeSection = document.querySelector('.bes-player-drawer .bes-time-elapsed');
  if (timeSection) {
    timeSection.classList.remove('bes-hidden');
  }
}

function updateProgressBar(): void {
  if (!audioElement) return;

  const percent = (audioElement.currentTime / audioElement.duration) * 100;

  const progbarFill = document.querySelector('.bes-player-drawer .bes-progbar-fill') as HTMLElement;
  if (progbarFill) {
    progbarFill.style.width = `${percent}%`;
  }

  const thumb = document.querySelector('.bes-player-drawer .bes-slider-container .bes-progbar-thumb') as HTMLElement;
  if (thumb) {
    thumb.style.left = `${percent}%`;
  }

  updateTimeDisplay(audioElement.currentTime, audioElement.duration);
}

export function isPlaybackClick(target: HTMLElement | null): boolean {
  if (!target) return false;
  return !target.closest('.bes-track-link, .bes-track-buy-col');
}

function attachTrackListHandlers(): void {
  const trackRows = document.querySelectorAll('.bes-player-drawer .bes-track-row');

  trackRows.forEach((row, index) => {
    // Make entire row clickable
    row.addEventListener('click', (e: Event) => {
      if (!isPlaybackClick(e.target as HTMLElement)) {
        return;
      }

      loadTrack(index);
      if (audioElement) {
        if (currentTrackIndex === index) {
          // Clicking current track toggles play/pause
          if (audioElement.paused) {
            audioElement.play();
          } else {
            audioElement.pause();
          }
        } else {
          // Clicking different track plays it
          audioElement.play();
        }
      }
    });
  });
}

function updateVolumeDisplay(volume: number): void {
  const volumeFill = document.querySelector('.bes-player-drawer .bes-volume-fill') as HTMLElement;
  const volumeThumb = document.querySelector('.bes-player-drawer .bes-volume-thumb') as HTMLElement;
  const volumePercent = document.querySelector('.bes-player-drawer .bes-volume-percent') as HTMLElement;

  const percent = volume * 100;

  if (volumeFill) {
    volumeFill.style.height = `${percent}%`;
  }

  if (volumeThumb) {
    volumeThumb.style.bottom = `${percent}%`;
  }

  if (volumePercent) {
    volumePercent.textContent = `${Math.round(percent)}%`;
  }
}

function updateMuteButton(isMuted: boolean): void {
  const muteButton = document.querySelector('.bes-player-drawer .bes-volume-mute') as HTMLElement;
  if (!muteButton) return;

  const muteIcon = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`;
  const unmuteIcon = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;

  muteButton.innerHTML = isMuted ? muteIcon : unmuteIcon;
}

function initializePlayer(): void {
  log.info('Initializing player');

  const audio = audioElement;
  const playButton = document.querySelector('.bes-player-drawer .bes-transport-play') as HTMLElement;
  const prevButton = document.querySelector('.bes-player-drawer .bes-transport-prev') as HTMLElement;
  const nextButton = document.querySelector('.bes-player-drawer .bes-transport-next') as HTMLElement;
  const progbar = document.querySelector('.bes-player-drawer .bes-progbar') as HTMLElement;
  const volumeContainer = document.querySelector('.bes-player-drawer .bes-volume') as HTMLElement;
  const volumeMuteButton = document.querySelector('.bes-player-drawer .bes-volume-mute') as HTMLElement;

  if (!audio || !playButton) {
    log.error('Required player elements not found');
    return;
  }

  // Initialize volume to 100%
  audio.volume = 1.0;
  updateVolumeDisplay(1.0);

  // Play/pause button
  playButton.onclick = playPause;

  // Prev button
  if (prevButton) {
    prevButton.onclick = prevTrack;
  }

  // Next button
  if (nextButton) {
    nextButton.onclick = nextTrack;
  }

  // Progress bar seek
  if (progbar) {
    progbar.onclick = (e: MouseEvent) => {
      const rect = progbar.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      audio.currentTime = percent * audio.duration;
    };
  }

  // Volume slider - custom div-based slider
  if (volumeContainer) {
    let isVolumeChanging = false;

    const handleVolumeChange = (e: MouseEvent) => {
      const rect = volumeContainer.getBoundingClientRect();
      const percent = 1 - (e.clientY - rect.top) / rect.height;
      const volume = Math.max(0, Math.min(1, percent));
      audio.volume = volume;
      updateVolumeDisplay(volume);
    };

    volumeContainer.onpointerdown = (e: PointerEvent) => {
      isVolumeChanging = true;
      volumeContainer.setPointerCapture(e.pointerId);
      handleVolumeChange(e);
    };

    volumeContainer.onpointermove = (e: PointerEvent) => {
      if (isVolumeChanging) {
        handleVolumeChange(e);
      }
    };

    volumeContainer.onpointerup = (e: PointerEvent) => {
      isVolumeChanging = false;
      volumeContainer.releasePointerCapture(e.pointerId);
    };
  }

  // Mute button
  if (volumeMuteButton) {
    volumeMuteButton.onclick = toggleMute;
  }

  // Audio events
  audio.onplay = () => {
    playButton.classList.add('playing');
    updateMinimizedPlayButton(true);
  };
  audio.onpause = () => {
    playButton.classList.remove('playing');
    updateMinimizedPlayButton(false);
  };
  audio.onended = async () => {
    log.debug(`Track ended: currentTrackIndex=${currentTrackIndex}, totalTracks=${currentAlbumData?.tracks?.length}`);

    if (currentAlbumData?.tracks && currentTrackIndex < currentAlbumData.tracks.length - 1) {
      // Not at last track - advance to next playable track
      const nextIndex = findNextPlayableTrack(currentTrackIndex);
      log.debug(`Auto-advance: findNextPlayableTrack(${currentTrackIndex}) returned ${nextIndex}`);

      if (nextIndex !== -1) {
        log.debug(`Auto-advancing to track ${nextIndex}`);
        loadTrack(nextIndex);
        audio.play().catch(error => {
          log.error(`Failed to play: ${error}`);
        });
      } else if (currentAlbumIndex < discographyOrder.length - 1) {
        // No more playable tracks in this album, load next album
        log.info('No more playable tracks, loading next album in discography (auto-advance)');
        await loadNextAlbum();
        setTimeout(() => {
          loadTrack(0);
          audio.play().catch(error => {
            log.error(`Failed to play: ${error}`);
          });
        }, 300);
      }
    } else if (currentAlbumData?.tracks && currentTrackIndex === currentAlbumData.tracks.length - 1) {
      // At last track - load next album if available
      if (currentAlbumIndex < discographyOrder.length - 1) {
        log.info('Loading next album in discography (auto-advance from last track)');
        await loadNextAlbum();
        setTimeout(() => {
          loadTrack(0);
          audio.play().catch(error => {
            log.error(`Failed to play: ${error}`);
          });
        }, 300);
      }
    }
  };
  audio.ontimeupdate = () => {
    updateProgressBar();
  };
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function keyComboToString(combo: {
  key: string;
  alt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
}): string {
  const { key, alt = false, ctrl = false, shift = false, meta = false } = combo;
  const keyDisplay = key === ' ' ? 'Space' : key;
  return `${alt ? 'Alt+' : ''}${ctrl ? 'Ctrl+' : ''}${shift ? 'Shift+' : ''}${meta ? 'Meta+' : ''}${keyDisplay}`;
}

function buildKeyHandlersFromSettings(settings: KeyboardSettings): KeyHandlers {
  const handlers: KeyHandlers = {};

  settings.controls.forEach(control => {
    if (!control.enabled) return;

    const bindingKey = keyBindingToString(control.binding);

    switch (control.action) {
      case KeyboardAction.PLAY_PAUSE:
      case KeyboardAction.PLAY_PAUSE_ALT:
        handlers[bindingKey] = playPause;
        break;

      case KeyboardAction.PREV_TRACK:
        handlers[bindingKey] = prevTrack;
        break;

      case KeyboardAction.NEXT_TRACK:
        handlers[bindingKey] = nextTrack;
        break;

      case KeyboardAction.SEEK_FORWARD:
        handlers[bindingKey] = () => {
          if (!audioElement) return;
          audioElement.currentTime = audioElement.currentTime + settings.seekStepSize;
        };
        break;

      case KeyboardAction.SEEK_BACKWARD:
        handlers[bindingKey] = () => {
          if (!audioElement) return;
          audioElement.currentTime = audioElement.currentTime - settings.seekStepSize;
        };
        break;

      case KeyboardAction.SEEK_FORWARD_LARGE:
        handlers[bindingKey] = () => {
          if (!audioElement) return;
          audioElement.currentTime = audioElement.currentTime + settings.largeSeekStepSize;
        };
        break;

      case KeyboardAction.SEEK_BACKWARD_LARGE:
        handlers[bindingKey] = () => {
          if (!audioElement) return;
          audioElement.currentTime = audioElement.currentTime - settings.largeSeekStepSize;
        };
        break;

      case KeyboardAction.VOLUME_UP:
        handlers[bindingKey] = () => {
          if (!audioElement) return;
          const newVolume = audioElement.volume + settings.volumeStep;
          audioElement.volume = newVolume > 1.0 ? 1.0 : newVolume;
          updateVolumeDisplay(audioElement.volume);
          updateMuteButton(audioElement.volume === 0);
        };
        break;

      case KeyboardAction.VOLUME_DOWN:
        handlers[bindingKey] = () => {
          if (!audioElement) return;
          const newVolume = audioElement.volume - settings.volumeStep;
          audioElement.volume = newVolume < 0.0 ? 0.0 : newVolume;
          updateVolumeDisplay(audioElement.volume);
          updateMuteButton(audioElement.volume === 0);
        };
        break;
    }
  });

  return handlers;
}

function shouldIgnoreKeyboardEvent(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  return false;
}

function keydownCallback(e: KeyboardEvent, keyHandlers: KeyHandlers, preventDefault: boolean): void {
  // Only respond to keypresses when drawer is open
  const drawer = document.querySelector('.bes-player-drawer');
  if (!drawer || !(drawer as HTMLElement).classList.contains('open')) {
    return;
  }

  // Ignore keyboard events when focused on input elements (e.g., search bar)
  if (shouldIgnoreKeyboardEvent(e.target)) {
    return;
  }

  if (e.key === 'Meta' && !e.altKey && !e.ctrlKey && !e.shiftKey) {
    return;
  }

  const currentCombo = keyComboToString({
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
