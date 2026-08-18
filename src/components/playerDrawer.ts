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

export const DRAWER_MIN_WIDTH = 520;
export const WIDTH_TRANSITION_MS = 300;

export function expandedDrawerWidth(viewportWidth: number, contentRightEdge: number): number {
  const gutter = viewportWidth - contentRightEdge;
  return Math.max(DRAWER_MIN_WIDTH, gutter);
}

function pageContentRightEdge(): number | null {
  const page = document.querySelector<HTMLElement>('#pgBd');
  if (!page) return null;

  const { right } = page.getBoundingClientRect();
  return right - parseFloat(getComputedStyle(page).paddingRight || '0');
}

function sizeDrawerToPageGutter(): void {
  const contentRightEdge = pageContentRightEdge();
  const width =
    contentRightEdge === null
      ? DRAWER_MIN_WIDTH
      : expandedDrawerWidth(document.documentElement.clientWidth, contentRightEdge);

  document.documentElement.style.setProperty('--bes-drawer-width', `${width}px`);
}

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
      minimizedBar,
      element('div', {
        className: 'bes-player-drawer-footer',
        children: [
          element('span', {
            className: 'bes-player-drawer-logo',
            attributes: {
              role: 'img',
              'aria-label': 'Bandcamp Enhancement Suite',
              title: 'Bandcamp Enhancement Suite'
            }
          })
        ]
      })
    ]
  });

  const overlay = element('div', { className: 'bes-player-drawer-overlay' });

  document.body.classList.add('bes-drawer-host');

  let widthAnimationTimer: ReturnType<typeof setTimeout> | undefined;

  const animateNextWidthChange = () => {
    drawer.classList.add('bes-animating-width');
    clearTimeout(widthAnimationTimer);
    widthAnimationTimer = setTimeout(() => drawer.classList.remove('bes-animating-width'), WIDTH_TRANSITION_MS);
  };

  let pendingMeasurement = 0;

  const trackPageGutter = () => {
    if (!drawerState.isOpen || drawerState.isMinimized || pendingMeasurement) return;

    pendingMeasurement = requestAnimationFrame(() => {
      pendingMeasurement = 0;
      sizeDrawerToPageGutter();
    });
  };

  const reflowPageAroundDrawer = () => {
    const isExpanded = drawerState.isOpen && !drawerState.isMinimized;

    document.body.classList.toggle('bes-drawer-expanded', isExpanded);
    if (isExpanded) sizeDrawerToPageGutter();
  };

  window.addEventListener('resize', trackPageGutter);

  const openDrawer = () => {
    animateNextWidthChange();
    log.info('Opening player drawer');
    drawer.classList.add('open');
    drawer.classList.remove('minimized');
    drawerState.isOpen = true;
    drawerState.isMinimized = false;
    reflowPageAroundDrawer();
  };

  const closeDrawer = () => {
    animateNextWidthChange();
    log.info('Closing player drawer');
    drawer.classList.remove('open');
    drawer.classList.remove('minimized');
    drawerState.isOpen = false;
    drawerState.isMinimized = false;
    reflowPageAroundDrawer();

    const audio = document.querySelector('audio');
    if (audio && !audio.paused) {
      audio.pause();
    }
  };

  const minimizeDrawer = () => {
    animateNextWidthChange();
    log.info('Minimizing player drawer');
    drawer.classList.add('minimized');
    drawerState.isMinimized = true;
    reflowPageAroundDrawer();
  };

  const maximizeDrawer = () => {
    animateNextWidthChange();
    log.info('Maximizing player drawer');
    drawer.classList.remove('minimized');
    drawerState.isMinimized = false;
    reflowPageAroundDrawer();
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
