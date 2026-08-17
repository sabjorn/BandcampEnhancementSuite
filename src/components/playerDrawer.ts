import { createLogger } from '../logger';
import { prevIcon, nextIcon, playIcon, pauseIcon, minimizeIcon, closeIcon } from './playerIcons';
import { element } from './dom';

const log = createLogger();

export interface PlayerDrawerState {
  isOpen: boolean;
  isMinimized: boolean;
  currentAlbumId?: string;
  currentAlbumType?: string;
}

const drawerState: PlayerDrawerState = {
  isOpen: false,
  isMinimized: false
};

export function createPlayerDrawer(): {
  drawer: HTMLDivElement;
  overlay: HTMLDivElement;
  openDrawer: () => void;
  closeDrawer: () => void;
  minimizeDrawer: () => void;
  maximizeDrawer: () => void;
  getState: () => PlayerDrawerState;
} {
  const albumArt = element('img', {
    className: 'bes-player-drawer-album-art',
    attributes: { alt: 'Album artwork' }
  });
  const transportControls = element('div', { className: 'bes-player-drawer-transport' });
  const playerContainer = element('div', { className: 'bes-player-drawer-player' });
  const tracklistContainer = element('div', { className: 'bes-player-drawer-tracklist' });

  const minimizeButton = element('button', {
    className: 'bes-player-drawer-minimize',
    html: minimizeIcon(14),
    attributes: { 'aria-label': 'Minimize player', title: 'Minimize player' }
  });
  const closeButton = element('button', {
    className: 'bes-player-drawer-close',
    html: closeIcon(14),
    attributes: { 'aria-label': 'Close player', title: 'Close player' }
  });

  const minimizedArt = element('img', {
    className: 'bes-player-drawer-minimized-art',
    attributes: { alt: 'Album artwork' }
  });
  const minimizedPrevButton = element('button', {
    className: 'bes-player-drawer-minimized-prev',
    html: prevIcon(14),
    attributes: { 'aria-label': 'Previous track' }
  });
  const minimizedPlayButton = element('button', {
    className: 'bes-player-drawer-minimized-play',
    html: `${playIcon(16)}${pauseIcon(16)}`,
    attributes: { 'aria-label': 'Play/Pause' }
  });
  const minimizedNextButton = element('button', {
    className: 'bes-player-drawer-minimized-next',
    html: nextIcon(14),
    attributes: { 'aria-label': 'Next track' }
  });

  const minimizedBar = element('div', {
    className: 'bes-player-drawer-minimized-bar',
    children: [
      minimizedArt,
      element('div', {
        className: 'bes-player-drawer-minimized-controls',
        children: [minimizedPrevButton, minimizedPlayButton, minimizedNextButton]
      })
    ]
  });

  const drawer = element('div', {
    className: 'bes-player-drawer',
    children: [
      element('div', {
        className: 'bes-player-drawer-header',
        children: [
          element('div', {
            className: 'bes-player-drawer-main',
            children: [
              element('div', {
                className: 'bes-player-drawer-left',
                children: [albumArt, transportControls]
              }),
              element('div', {
                className: 'bes-player-drawer-center',
                children: [playerContainer]
              }),
              element('div', {
                className: 'bes-player-drawer-right',
                children: [
                  element('div', {
                    className: 'bes-player-drawer-header-actions',
                    children: [minimizeButton, closeButton]
                  })
                ]
              })
            ]
          })
        ]
      }),
      element('div', { className: 'bes-player-drawer-content', children: [tracklistContainer] }),
      minimizedBar
    ]
  });

  const overlay = element('div', { className: 'bes-player-drawer-overlay' });

  const openDrawer = () => {
    log.info('Opening player drawer');
    drawer.classList.add('open');
    drawer.classList.remove('minimized');
    drawerState.isOpen = true;
    drawerState.isMinimized = false;
  };

  const closeDrawer = () => {
    log.info('Closing player drawer');
    drawer.classList.remove('open');
    drawer.classList.remove('minimized');
    drawerState.isOpen = false;
    drawerState.isMinimized = false;

    const audio = document.querySelector('audio');
    if (audio && !audio.paused) {
      audio.pause();
    }
  };

  const minimizeDrawer = () => {
    log.info('Minimizing player drawer');
    drawer.classList.add('minimized');
    drawerState.isMinimized = true;
  };

  const maximizeDrawer = () => {
    log.info('Maximizing player drawer');
    drawer.classList.remove('minimized');
    drawerState.isMinimized = false;
  };

  const getState = (): PlayerDrawerState => ({ ...drawerState });

  minimizeButton.addEventListener('click', () => {
    if (drawerState.isMinimized) {
      maximizeDrawer();
    } else {
      minimizeDrawer();
    }
  });

  closeButton.addEventListener('click', closeDrawer);

  minimizedBar.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    if (!target.closest('.bes-player-drawer-minimized-controls')) {
      maximizeDrawer();
    }
  });

  const keepFocusOnBody = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('button')) {
      event.preventDefault();
    }
  };

  drawer.addEventListener('mousedown', keepFocusOnBody);

  minimizedPlayButton.addEventListener('click', e => {
    e.stopPropagation();
    const playButton = drawer.querySelector('.bes-transport-play') as HTMLElement;
    if (playButton) {
      playButton.click();
    }
  });

  minimizedPrevButton.addEventListener('click', e => {
    e.stopPropagation();
    const prevButton = drawer.querySelector('.bes-transport-prev') as HTMLElement;
    if (prevButton) {
      prevButton.click();
    }
  });

  minimizedNextButton.addEventListener('click', e => {
    e.stopPropagation();
    const nextButton = drawer.querySelector('.bes-transport-next') as HTMLElement;
    if (nextButton) {
      nextButton.click();
    }
  });

  return {
    drawer,
    overlay,
    openDrawer,
    closeDrawer,
    minimizeDrawer,
    maximizeDrawer,
    getState
  };
}

export function getPlayerDrawerElements() {
  return {
    drawer: document.querySelector('.bes-player-drawer') as HTMLDivElement,
    overlay: document.querySelector('.bes-player-drawer-overlay') as HTMLDivElement,
    playerContainer: document.querySelector('.bes-player-drawer-player') as HTMLDivElement,
    tracklistContainer: document.querySelector('.bes-player-drawer-tracklist') as HTMLDivElement,
    albumArt: document.querySelector('.bes-player-drawer-album-art') as HTMLImageElement,
    transportControls: document.querySelector('.bes-player-drawer-transport') as HTMLDivElement,
    rightColumn: document.querySelector('.bes-player-drawer-right') as HTMLDivElement,
    minimizedArt: document.querySelector('.bes-player-drawer-minimized-art') as HTMLImageElement,
    minimizedPlayButton: document.querySelector('.bes-player-drawer-minimized-play') as HTMLButtonElement
  };
}

export function updatePlayerDrawerInfo(albumArtUrl: string) {
  const elements = getPlayerDrawerElements();

  if (elements.albumArt) {
    elements.albumArt.src = albumArtUrl;
  }
  if (elements.minimizedArt) {
    elements.minimizedArt.src = albumArtUrl;
  }
}

export function updateMinimizedPlayButton(isPlaying: boolean) {
  const button = document.querySelector('.bes-player-drawer-minimized-play') as HTMLButtonElement;
  if (button) {
    button.classList.toggle('playing', isPlaying);
    button.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  }
}
