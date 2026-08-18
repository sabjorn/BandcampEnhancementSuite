import { createLogger } from './logger';
import { loadNextAlbum, loadPreviousAlbum } from './playerLoader';
import { getCurrentAlbumIndex, getDiscographyLength } from './discography';

const log = createLogger();

let isProcessingBoundary = false;

export function initContinuousPlay(enableFetchCaching: boolean = false): void {
  log.info('Initializing continuous play');

  document.addEventListener('click', async (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    if (isProcessingBoundary) {
      return;
    }

    const isNextButton = target.closest('.nextbutton');
    const isPrevButton = target.closest('.prevbutton');

    if (!isNextButton && !isPrevButton) {
      return;
    }

    setTimeout(async () => {
      await checkAndHandleBoundary(enableFetchCaching);
    }, 100);
  });

  monitorAudioEnd(enableFetchCaching);

  log.info('Continuous play initialized');
}

async function checkAndHandleBoundary(enableFetchCaching: boolean): Promise<void> {
  const tracks = document.querySelectorAll('tr.track_row_view');
  const currentTrack = document.querySelector('tr.track_row_view.playing');

  if (!currentTrack) {
    return;
  }

  const currentIndex = Array.from(tracks).indexOf(currentTrack);

  const isFirstTrack = currentIndex === 0;
  const isLastTrack = currentIndex === tracks.length - 1;

  if (isFirstTrack && shouldLoadPrevious()) {
    await handleBoundaryLoad('previous', enableFetchCaching);
  } else if (isLastTrack && shouldLoadNext()) {
    await handleBoundaryLoad('next', enableFetchCaching);
  }
}

function shouldLoadPrevious(): boolean {
  const currentIndex = getCurrentAlbumIndex();
  return currentIndex > 0;
}

function shouldLoadNext(): boolean {
  const currentIndex = getCurrentAlbumIndex();
  const totalAlbums = getDiscographyLength();
  return currentIndex < totalAlbums - 1;
}

async function handleBoundaryLoad(direction: 'next' | 'previous', enableFetchCaching: boolean): Promise<void> {
  if (isProcessingBoundary) {
    return;
  }

  isProcessingBoundary = true;

  try {
    const currentIndex = getCurrentAlbumIndex();
    const totalAlbums = getDiscographyLength();

    if (direction === 'next' && currentIndex < totalAlbums - 1) {
      log.info('Loading next album in discography');
      await loadNextAlbum(enableFetchCaching);

      setTimeout(() => {
        const firstTrack = document.querySelector('tr.track_row_view');
        if (firstTrack) {
          const playButton = firstTrack.querySelector('.playbutton') as HTMLElement;
          if (playButton) {
            playButton.click();
          }
        }
      }, 500);
    } else if (direction === 'previous' && currentIndex > 0) {
      log.info('Loading previous album in discography');
      await loadPreviousAlbum(enableFetchCaching);

      setTimeout(() => {
        const tracks = document.querySelectorAll('tr.track_row_view');
        const lastTrack = tracks[tracks.length - 1];
        if (lastTrack) {
          const playButton = lastTrack.querySelector('.playbutton') as HTMLElement;
          if (playButton) {
            playButton.click();
          }
        }
      }, 500);
    }
  } catch (error) {
    log.error(`Failed to load ${direction} album: ${error}`);
  } finally {
    isProcessingBoundary = false;
  }
}

function monitorAudioEnd(enableFetchCaching: boolean): void {
  document.addEventListener(
    'ended',
    async (e: Event) => {
      if (!(e.target instanceof HTMLAudioElement)) {
        return;
      }

      const tracks = document.querySelectorAll('tr.track_row_view');
      const playingTrack = document.querySelector('tr.track_row_view.playing');

      if (!playingTrack) {
        return;
      }

      const currentIndex = Array.from(tracks).indexOf(playingTrack);
      const isLastTrack = currentIndex === tracks.length - 1;

      if (isLastTrack) {
        await handleBoundaryLoad('next', enableFetchCaching);
      }
    },
    true
  );
}
