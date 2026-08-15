import { createLogger } from '../logger';

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
  const drawer = document.createElement('div');
  drawer.className = 'bes-player-drawer';

  const header = document.createElement('div');
  header.className = 'bes-player-drawer-header';

  // Main player container (3 columns: left+center+right)
  const playerMain = document.createElement('div');
  playerMain.className = 'bes-player-drawer-main';
  playerMain.style.cssText = `
    display: flex;
    gap: 20px;
    min-width: 0;
    max-width: 624px;
    width: 100%;
  `;

  // LEFT COLUMN: Album art + transport controls
  const leftColumn = document.createElement('div');
  leftColumn.className = 'bes-player-drawer-left';
  leftColumn.style.cssText = `
    width: 96px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    align-items: center;
  `;

  const albumArt = document.createElement('img');
  albumArt.className = 'bes-player-drawer-album-art';
  albumArt.alt = 'Album artwork';
  albumArt.style.cssText = `
    width: 96px;
    height: 96px;
    border-radius: 16px;
    box-shadow: inset 0 0 0 1px rgba(24, 24, 27, 0.06);
    object-fit: cover;
  `;

  const transportControls = document.createElement('div');
  transportControls.className = 'bes-player-drawer-transport';

  leftColumn.appendChild(albumArt);
  leftColumn.appendChild(transportControls);

  // CENTER COLUMN: Player controls container (will be populated by nativePlayerBuilder)
  const centerColumn = document.createElement('div');
  centerColumn.className = 'bes-player-drawer-center';
  centerColumn.style.cssText = `
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 18px;
  `;

  // Player controls container (track info + waveform/progress area - populated by nativePlayerBuilder)
  const playerContainer = document.createElement('div');
  playerContainer.className = 'bes-player-drawer-player';
  playerContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 18px;
  `;

  centerColumn.appendChild(playerContainer);

  // RIGHT COLUMN: Action buttons + Volume controls
  const rightColumn = document.createElement('div');
  rightColumn.className = 'bes-player-drawer-right';

  // Header actions (minimize/close) - at top of right column
  const headerActions = document.createElement('div');
  headerActions.className = 'bes-player-drawer-header-actions';

  const minimizeButton = document.createElement('button');
  minimizeButton.className = 'bes-player-drawer-minimize';
  minimizeButton.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="11" width="14" height="2" rx="1" fill="currentColor"></rect>
    </svg>
  `;
  minimizeButton.setAttribute('aria-label', 'Minimize player');
  minimizeButton.setAttribute('title', 'Minimize player');

  const closeButton = document.createElement('button');
  closeButton.className = 'bes-player-drawer-close';
  closeButton.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6 18 18 M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"></path>
    </svg>
  `;
  closeButton.setAttribute('aria-label', 'Close player');
  closeButton.setAttribute('title', 'Close player');

  headerActions.appendChild(minimizeButton);
  headerActions.appendChild(closeButton);

  rightColumn.appendChild(headerActions);

  playerMain.appendChild(leftColumn);
  playerMain.appendChild(centerColumn);
  playerMain.appendChild(rightColumn);

  header.appendChild(playerMain);

  const content = document.createElement('div');
  content.className = 'bes-player-drawer-content';

  const tracklistContainer = document.createElement('div');
  tracklistContainer.className = 'bes-player-drawer-tracklist';

  content.appendChild(tracklistContainer);

  const minimizedBar = document.createElement('div');
  minimizedBar.className = 'bes-player-drawer-minimized-bar';

  const minimizedArt = document.createElement('img');
  minimizedArt.className = 'bes-player-drawer-minimized-art';
  minimizedArt.alt = 'Album artwork';

  const minimizedControls = document.createElement('div');
  minimizedControls.className = 'bes-player-drawer-minimized-controls';

  const minimizedPrevButton = document.createElement('button');
  minimizedPrevButton.className = 'bes-player-drawer-minimized-prev';
  minimizedPrevButton.setAttribute('aria-label', 'Previous track');
  minimizedPrevButton.innerHTML = '⏮';

  const minimizedPlayButton = document.createElement('button');
  minimizedPlayButton.className = 'bes-player-drawer-minimized-play';
  minimizedPlayButton.setAttribute('aria-label', 'Play/Pause');
  minimizedPlayButton.innerHTML = '▶';

  const minimizedNextButton = document.createElement('button');
  minimizedNextButton.className = 'bes-player-drawer-minimized-next';
  minimizedNextButton.setAttribute('aria-label', 'Next track');
  minimizedNextButton.innerHTML = '⏭';

  minimizedControls.appendChild(minimizedPrevButton);
  minimizedControls.appendChild(minimizedPlayButton);
  minimizedControls.appendChild(minimizedNextButton);

  minimizedBar.appendChild(minimizedArt);
  minimizedBar.appendChild(minimizedControls);

  drawer.appendChild(header);
  drawer.appendChild(content);
  drawer.appendChild(minimizedBar);

  const overlay = document.createElement('div');
  overlay.className = 'bes-player-drawer-overlay';

  const openDrawer = () => {
    log.info('Opening player drawer');
    drawer.classList.add('open');
    drawerState.isOpen = true;
    drawerState.isMinimized = false;
  };

  const closeDrawer = () => {
    log.info('Closing player drawer');
    drawer.classList.remove('open');
    drawer.classList.remove('minimized');
    drawerState.isOpen = false;
    drawerState.isMinimized = false;

    // Pause audio when closing drawer
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
    button.innerHTML = isPlaying ? '⏸' : '▶';
    button.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  }
}
