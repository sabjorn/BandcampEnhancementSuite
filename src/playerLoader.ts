import { createLogger } from './logger';
import { getTralbumDetails, TralbumDetailsResponse } from './bclient';
import { getPlayerDrawerElements, updatePlayerDrawerInfo, updateMinimizedPlayButton } from './components/playerDrawer';
import { createFetchFunction } from './utilities';
import { buildDrawerPlayer, buildTrackTable } from './nativePlayerBuilder';
import { KeyboardSettings, KeyboardAction, DEFAULT_KEYBOARD_SETTINGS, keyBindingToString } from './types/keyboard';
import { analyze } from 'web-audio-beat-detector';

const log = createLogger();

interface KeyHandlers {
  [key: string]: () => void;
}

const metadataCache: Map<number, { waveform: number[]; bpm: number }> = new Map();

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
  const albumLabel = document.querySelector('.album-label') as HTMLDivElement;
  const trackTitleEl = document.querySelector('.track-title') as HTMLDivElement;
  const artistNameEl = document.querySelector('.artist-name') as HTMLDivElement;

  if (albumLabel) albumLabel.textContent = albumName;
  if (trackTitleEl) trackTitleEl.textContent = trackTitle;
  if (artistNameEl) artistNameEl.textContent = artistName;
}

// Update BPM badge inside drawer player
function updateDrawerBpmBadge(bpm: number | null): void {
  const bpmNumber = document.querySelector('.bpm-number') as HTMLSpanElement;
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

function extractTrackId(audioSrc: string): number | null {
  const match = audioSrc.match(/stream\/[^/]+\/[^/]+\/(\d+)/);
  if (!match) return null;

  const trackId = parseInt(match[1], 10);
  return isNaN(trackId) ? null : trackId;
}

async function fetchCachedMetadata(trackId: number): Promise<{ waveform: number[]; bpm: number } | null> {
  const memoryCached = metadataCache.get(trackId);
  if (memoryCached) {
    return memoryCached;
  }

  const apiMetadata = await chrome.runtime
    .sendMessage({
      contentScriptQuery: 'fetchTrackMetadata',
      trackId: trackId
    })
    .catch((error: Error) => {
      log.warn(`Failed to fetch cached metadata: ${error.message}`);
      return null;
    });

  if (apiMetadata && apiMetadata.waveform && apiMetadata.bpm) {
    metadataCache.set(trackId, apiMetadata);
  }

  return apiMetadata;
}

function fillBar(
  canvas: HTMLCanvasElement,
  amplitude: number,
  index: number,
  numElements: number,
  colour: string = 'white'
): void {
  const ctx = canvas.getContext('2d')!;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = colour;

  const graphHeight = canvas.height * amplitude;
  const barWidth = canvas.width / numElements;
  const position = index * barWidth;
  ctx.fillRect(position, canvas.height, barWidth, -graphHeight);
}

function drawOverlay(
  canvas: HTMLCanvasElement,
  progress: number,
  colour: string = 'red',
  clearColour: string = 'black'
): void {
  const ctx = canvas.getContext('2d')!;
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = clearColour;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, canvas.width * progress, canvas.height);
}

async function generateDrawerWaveform(
  canvas: HTMLCanvasElement,
  bpmDisplay: HTMLSpanElement | HTMLDivElement,
  waveformColour: string,
  currentTarget: { value?: string }
): Promise<void> {
  const datapoints = 100;

  if (!audioElement) {
    log.warn('No audio element for waveform generation');
    return;
  }
  if (currentTarget.value === audioElement.src) {
    log.info('Waveform already generated for this track');
    return;
  }

  log.info(`Generating waveform for: ${audioElement.src}`);
  currentTarget.value = audioElement.src;
  bpmDisplay.textContent = '';
  canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);

  const trackId = extractTrackId(audioElement.src);
  if (trackId) {
    const cachedMetadata = await fetchCachedMetadata(trackId);
    if (cachedMetadata && cachedMetadata.waveform && cachedMetadata.bpm) {
      updateDrawerBpmBadge(cachedMetadata.bpm);

      const max = cachedMetadata.waveform.reduce((a: number, b: number) => Math.max(a, b));
      for (let i = 0; i < cachedMetadata.waveform.length; i++) {
        const amplitude = cachedMetadata.waveform[i] / max;
        fillBar(canvas, amplitude, i, cachedMetadata.waveform.length, waveformColour);
      }
      return;
    }
  }

  const ctx = new AudioContext();

  // Determine stream URL type for type-safe backend request
  const stream = audioElement.src.includes('t4.bcbits.com/stream/')
    ? { type: 'direct-path' as const, path: audioElement.src.split('stream/')[1] }
    : { type: 'full-url' as const, url: audioElement.src };

  log.info(`Requesting audio data for waveform generation (${stream.type})`);

  chrome.runtime.sendMessage(
    {
      contentScriptQuery: 'renderBuffer',
      stream
    },
    audioData => {
      const audioBuffer_ = new Uint8Array(audioData.data).buffer;
      const decodePromise = ctx.decodeAudioData(audioBuffer_);

      const bpmPromise = decodePromise.then(decodedAudio =>
        analyze(decodedAudio)
          .then(bpm => {
            updateDrawerBpmBadge(bpm);
            return bpm;
          })
          .catch(err => {
            log.error(`error finding bpm for track: ${err}`);
            updateDrawerBpmBadge(null);
            return null;
          })
      );

      const waveformPromise = decodePromise.then(decodedAudio => {
        const leftChannel = decodedAudio.getChannelData(0);

        const stepSize = Math.round(decodedAudio.length / datapoints);

        const rmsSize = Math.min(stepSize, 128);
        const subStepSize = Math.round(stepSize / rmsSize);
        const rmsBuffer = [];
        for (let i = 0; i < datapoints; i++) {
          let rms = 0.0;
          for (let sample = 0; sample < rmsSize; sample++) {
            const sampleIndex = i * stepSize + sample * subStepSize;
            const audioSample = leftChannel[sampleIndex];
            rms += audioSample ** 2;
          }
          rmsBuffer.push(Math.sqrt(rms / rmsSize));
        }

        const max = rmsBuffer.reduce((a, b) => Math.max(a, b));
        for (let i = 0; i < rmsBuffer.length; i++) {
          const amplitude = rmsBuffer[i] / max;
          fillBar(canvas, amplitude, i, datapoints, waveformColour);
        }

        return rmsBuffer;
      });

      Promise.all([bpmPromise, waveformPromise]).then(([bpm, waveform]) => {
        if (trackId && bpm !== null && waveform !== null) {
          chrome.runtime
            .sendMessage({
              contentScriptQuery: 'postTrackMetadata',
              trackId: trackId,
              waveform: waveform,
              bpm: bpm
            })
            .catch((error: Error) => {
              log.warn(`Failed to cache track metadata: ${error.message}`);
            });
        }
      });
    }
  );
}

export function initDrawerAudioFeatures(port: chrome.runtime.Port): void {
  // Store port for later use
  if (!configPort) {
    configPort = port;
  }

  const canvas = document.querySelector('.bes-player-drawer canvas.waveform') as HTMLCanvasElement;
  const bpmDisplay = document.querySelector('.bes-player-drawer .bpm-number') as HTMLSpanElement;

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
      generateDrawerWaveform(canvas, bpmDisplay, waveformColour, currentTarget);
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
      const { transportElement, centerElement, volumeElement, tracklistElement } = buildDrawerPlayer(tralbumDetails);

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
      if (elements.tracklistContainer) {
        elements.tracklistContainer.innerHTML = '';
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

  currentTrackIndex = index;

  // Set audio source - DO NOT call .play() here
  if (track.streaming_url?.['mp3-128']) {
    log.info(`Loading track ${index}: ${track.title}`);
    audioElement.src = track.streaming_url['mp3-128'];
  } else {
    log.warn(`No streaming URL for track: ${track.title}`);
    // Try to find next track with streaming URL
    const nextIndex = findNextPlayableTrack(index);
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
    if (tracks[i].streaming_url?.['mp3-128']) {
      return i;
    }
  }

  // Search backward
  for (let i = startIndex - 1; i >= 0; i--) {
    if (tracks[i].streaming_url?.['mp3-128']) {
      return i;
    }
  }

  return -1;
}

function updateTrackInfo(title: string): void {
  // Update track title, album, and artist in new player structure
  const trackTitleEl = document.querySelector('.bes-player-drawer .track-title') as HTMLDivElement;
  const albumLabel = document.querySelector('.bes-player-drawer .album-label') as HTMLDivElement;
  const artistName = document.querySelector('.bes-player-drawer .artist-name') as HTMLDivElement;

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
  const trackRows = document.querySelectorAll('.bes-player-drawer .track_row_view');
  trackRows.forEach((row, i) => {
    row.classList.toggle('playing', i === index);
  });
}

function updatePrevNextButtons(index: number, totalTracks: number): void {
  const prevButton = document.querySelector('.bes-player-drawer .prevbutton');
  const nextButton = document.querySelector('.bes-player-drawer .nextbutton');

  // Prev button: hide only if at first track AND no previous album available
  const canGoPrev = index > 0 || currentAlbumIndex > 0;
  prevButton?.classList.toggle('hiddenelem', !canGoPrev);

  // Next button: hide only if at last track AND no next album available
  const canGoNext = index < totalTracks - 1 || currentAlbumIndex < discographyOrder.length - 1;
  nextButton?.classList.toggle('hiddenelem', !canGoNext);
}

function updateTimeDisplay(currentTime: number, duration: number): void {
  const timeElapsed = document.querySelector('.bes-player-drawer .time_elapsed');
  if (timeElapsed) {
    timeElapsed.textContent = formatTime(currentTime);
  }

  const timeTotal = document.querySelector('.bes-player-drawer .time_total');
  if (timeTotal && !isNaN(duration)) {
    timeTotal.textContent = formatTime(duration);
  }

  const timeSection = document.querySelector('.bes-player-drawer .time');
  if (timeSection) {
    timeSection.classList.remove('hiddenelem');
  }
}

function updateProgressBar(): void {
  if (!audioElement) return;

  const percent = (audioElement.currentTime / audioElement.duration) * 100;

  const progbarFill = document.querySelector('.bes-player-drawer .progbar_fill') as HTMLElement;
  if (progbarFill) {
    progbarFill.style.width = `${percent}%`;
  }

  const thumb = document.querySelector('.bes-player-drawer .slider-container .thumb') as HTMLElement;
  if (thumb) {
    thumb.style.left = `${percent}%`;
  }

  updateTimeDisplay(audioElement.currentTime, audioElement.duration);
}

function attachTrackListHandlers(): void {
  const trackRows = document.querySelectorAll('.bes-player-drawer .track_row_view');

  trackRows.forEach((row, index) => {
    // Make entire row clickable
    row.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      // Don't trigger if clicking the track link icon
      if (target.closest('.track-link-icon')) {
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
  const volumeFill = document.querySelector('.bes-player-drawer .volume-fill') as HTMLElement;
  const volumeThumb = document.querySelector('.bes-player-drawer .volume-thumb') as HTMLElement;
  const volumePercent = document.querySelector('.bes-player-drawer .volume-percent') as HTMLElement;

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
  const muteButton = document.querySelector('.bes-player-drawer .volume-mute') as HTMLElement;
  if (!muteButton) return;

  const muteIcon = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`;
  const unmuteIcon = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;

  muteButton.innerHTML = isMuted ? muteIcon : unmuteIcon;
}

function initializePlayer(): void {
  log.info('Initializing player');

  const audio = audioElement;
  const playButton = document.querySelector('.bes-player-drawer .playbutton') as HTMLElement;
  const prevButton = document.querySelector('.bes-player-drawer .prevbutton') as HTMLElement;
  const nextButton = document.querySelector('.bes-player-drawer .nextbutton') as HTMLElement;
  const progbar = document.querySelector('.bes-player-drawer .progbar') as HTMLElement;
  const volumeContainer = document.querySelector('.bes-player-drawer .volume') as HTMLElement;
  const volumeMuteButton = document.querySelector('.bes-player-drawer .volume-mute') as HTMLElement;

  if (!audio || !playButton) {
    log.error('Required player elements not found');
    return;
  }

  // Initialize volume to 100%
  audio.volume = 1.0;
  updateVolumeDisplay(1.0);

  // Play/pause
  playButton.onclick = () => {
    if (audio.paused) {
      audio.play().catch(error => {
        log.error(`Failed to play: ${error}`);
      });
    } else {
      audio.pause();
    }
  };

  // Prev
  if (prevButton) {
    prevButton.onclick = async () => {
      if (currentTrackIndex > 0) {
        loadTrack(currentTrackIndex - 1);
        audio.play().catch(error => {
          log.error(`Failed to play: ${error}`);
        });
      } else if (currentTrackIndex === 0 && audio.currentTime < 1) {
        // At first track and near beginning - load previous album
        if (currentAlbumIndex > 0) {
          log.info('Loading previous album in discography');
          await loadPreviousAlbum();
          // Load and play last track of previous album
          setTimeout(() => {
            if (currentAlbumData?.tracks) {
              const lastTrackIndex = currentAlbumData.tracks.length - 1;
              loadTrack(lastTrackIndex);
              audio.play().catch(error => {
                log.error(`Failed to play: ${error}`);
              });
            }
          }, 300);
        }
      }
    };
  }

  // Next
  if (nextButton) {
    nextButton.onclick = async () => {
      if (currentAlbumData?.tracks && currentTrackIndex < currentAlbumData.tracks.length - 1) {
        loadTrack(currentTrackIndex + 1);
        audio.play().catch(error => {
          log.error(`Failed to play: ${error}`);
        });
      } else if (currentAlbumData?.tracks && currentTrackIndex === currentAlbumData.tracks.length - 1) {
        // At last track - check if near end, then load next album
        const duration = audio.duration;
        const remaining = duration - audio.currentTime;
        if (remaining < 1 || isNaN(remaining)) {
          if (currentAlbumIndex < discographyOrder.length - 1) {
            log.info('Loading next album in discography');
            await loadNextAlbum();
            // Load and play first track of next album
            setTimeout(() => {
              loadTrack(0);
              audio.play().catch(error => {
                log.error(`Failed to play: ${error}`);
              });
            }, 300);
          }
        }
      }
    };
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
  let previousVolume = 1.0;
  if (volumeMuteButton) {
    volumeMuteButton.onclick = () => {
      if (audio.volume > 0) {
        previousVolume = audio.volume;
        audio.volume = 0;
        updateVolumeDisplay(0);
        updateMuteButton(true);
      } else {
        audio.volume = previousVolume;
        updateVolumeDisplay(previousVolume);
        updateMuteButton(false);
      }
    };
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
    if (currentAlbumData?.tracks && currentTrackIndex < currentAlbumData.tracks.length - 1) {
      // Not at last track - advance to next track
      loadTrack(currentTrackIndex + 1);
      audio.play().catch(error => {
        log.error(`Failed to play: ${error}`);
      });
    } else if (currentAlbumData?.tracks && currentTrackIndex === currentAlbumData.tracks.length - 1) {
      // At last track - load next album if available
      if (currentAlbumIndex < discographyOrder.length - 1) {
        log.info('Loading next album in discography (auto-advance)');
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
        handlers[bindingKey] = () => {
          const playButton = document.querySelector('.bes-player-drawer .playbutton');
          if (!playButton) return;
          (playButton as HTMLElement).click();
        };
        break;

      case KeyboardAction.PREV_TRACK:
        handlers[bindingKey] = () => {
          const prevButton = document.querySelector('.bes-player-drawer .prevbutton');
          if (!prevButton) return;
          (prevButton as HTMLElement).click();
        };
        break;

      case KeyboardAction.NEXT_TRACK:
        handlers[bindingKey] = () => {
          const nextButton = document.querySelector('.bes-player-drawer .nextbutton');
          if (!nextButton) return;
          (nextButton as HTMLElement).click();
        };
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

function keydownCallback(e: KeyboardEvent, keyHandlers: KeyHandlers, preventDefault: boolean): void {
  // Only respond to keypresses when drawer is open and focus is on body
  const drawer = document.querySelector('.bes-player-drawer');
  if (!drawer || !(drawer as HTMLElement).classList.contains('open')) {
    return;
  }

  if (e.target !== document.body) {
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

export function getDiscographyLength(): number {
  return discographyOrder.length;
}
