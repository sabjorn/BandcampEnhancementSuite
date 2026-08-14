import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';
import {
  createPlayerDrawer,
  getPlayerDrawerElements,
  updatePlayerDrawerInfo,
  updateMinimizedPlayButton
} from '../src/components/playerDrawer';

vi.mock('../src/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }))
}));

describe('PlayerDrawer - Drawer State & Interactions', () => {
  beforeEach(() => {
    createDomNodes('<div></div>');
  });

  afterEach(() => {
    cleanupTestNodes();
  });

  describe('AC-S3: Drawer state management', () => {
    it('should create drawer with correct initial state', () => {
      const { drawer, getState } = createPlayerDrawer();

      expect(drawer).toBeDefined();
      expect(drawer.classList.contains('bes-player-drawer')).toBe(true);

      const state = getState();
      expect(state.isOpen).toBe(false);
      expect(state.isMinimized).toBe(false);
    });

    it('should open drawer correctly', () => {
      const { drawer, openDrawer, getState } = createPlayerDrawer();
      document.body.appendChild(drawer);

      openDrawer();

      expect(drawer.classList.contains('open')).toBe(true);
      expect(getState().isOpen).toBe(true);
      expect(getState().isMinimized).toBe(false);
    });

    it('should close drawer correctly', () => {
      const { drawer, openDrawer, closeDrawer, getState } = createPlayerDrawer();
      document.body.appendChild(drawer);

      openDrawer();
      closeDrawer();

      expect(drawer.classList.contains('open')).toBe(false);
      expect(getState().isOpen).toBe(false);
      expect(getState().isMinimized).toBe(false);
    });

    it('should minimize drawer correctly', () => {
      const { drawer, openDrawer, minimizeDrawer, getState } = createPlayerDrawer();
      document.body.appendChild(drawer);

      openDrawer();
      minimizeDrawer();

      expect(drawer.classList.contains('minimized')).toBe(true);
      expect(getState().isMinimized).toBe(true);
    });

    it('should maximize drawer correctly', () => {
      const { drawer, openDrawer, minimizeDrawer, maximizeDrawer, getState } = createPlayerDrawer();
      document.body.appendChild(drawer);

      openDrawer();
      minimizeDrawer();
      maximizeDrawer();

      expect(drawer.classList.contains('minimized')).toBe(false);
      expect(getState().isMinimized).toBe(false);
    });
  });

  describe('AC-P9: Minimize/close buttons', () => {
    it('should have minimize button that toggles state', () => {
      const { drawer, openDrawer, getState } = createPlayerDrawer();
      document.body.appendChild(drawer);
      openDrawer();

      const minimizeButton = drawer.querySelector('.bes-player-drawer-minimize') as HTMLButtonElement;
      expect(minimizeButton).toBeDefined();

      minimizeButton.click();
      expect(getState().isMinimized).toBe(true);

      minimizeButton.click();
      expect(getState().isMinimized).toBe(false);
    });

    it('should have close button that closes drawer', () => {
      const { drawer, openDrawer, getState } = createPlayerDrawer();
      document.body.appendChild(drawer);
      openDrawer();

      const closeButton = drawer.querySelector('.bes-player-drawer-close') as HTMLButtonElement;
      expect(closeButton).toBeDefined();

      closeButton.click();
      expect(getState().isOpen).toBe(false);
    });

    it('should pause audio when closing drawer', () => {
      const { drawer, openDrawer, closeDrawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const audio = document.createElement('audio');
      document.body.appendChild(audio);

      // Mock play
      const pauseSpy = vi.spyOn(audio, 'pause');
      Object.defineProperty(audio, 'paused', { value: false, writable: true });

      openDrawer();
      closeDrawer();

      expect(pauseSpy).toHaveBeenCalled();
    });
  });

  describe('AC-V3: Minimized bar (wedge layout)', () => {
    it('should create minimized bar with correct elements', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const minimizedBar = drawer.querySelector('.bes-player-drawer-minimized-bar');
      expect(minimizedBar).toBeDefined();

      const minimizedArt = drawer.querySelector('.bes-player-drawer-minimized-art');
      expect(minimizedArt).toBeDefined();

      const minimizedControls = drawer.querySelector('.bes-player-drawer-minimized-controls');
      expect(minimizedControls).toBeDefined();
    });

    it('should maximize drawer when clicking minimized bar', () => {
      const { drawer, openDrawer, minimizeDrawer, getState } = createPlayerDrawer();
      document.body.appendChild(drawer);

      openDrawer();
      minimizeDrawer();

      const minimizedBar = drawer.querySelector('.bes-player-drawer-minimized-bar') as HTMLElement;
      minimizedBar.click();

      expect(getState().isMinimized).toBe(false);
    });

    it('should NOT maximize when clicking controls in minimized bar', () => {
      const { drawer, openDrawer, minimizeDrawer, getState } = createPlayerDrawer();
      document.body.appendChild(drawer);

      openDrawer();
      minimizeDrawer();

      const playButton = drawer.querySelector('.bes-player-drawer-minimized-play') as HTMLElement;
      playButton.click();

      // Should stay minimized
      expect(getState().isMinimized).toBe(true);
    });
  });

  describe('AC-S3: Minimized bar state updates', () => {
    it('should update minimized play button icon based on playback state', () => {
      createDomNodes(`
        <button class="bes-player-drawer-minimized-play">▶</button>
      `);

      updateMinimizedPlayButton(true);

      const button = document.querySelector('.bes-player-drawer-minimized-play') as HTMLButtonElement;
      expect(button.innerHTML).toBe('⏸');
      expect(button.getAttribute('aria-label')).toBe('Pause');

      updateMinimizedPlayButton(false);
      expect(button.innerHTML).toBe('▶');
      expect(button.getAttribute('aria-label')).toBe('Play');
    });
  });

  describe('AC-S2: Album art extraction', () => {
    it('should update album art in both full and minimized views', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const testUrl = 'https://example.com/album.jpg';
      updatePlayerDrawerInfo(testUrl);

      const fullArt = drawer.querySelector('.bes-player-drawer-album-art') as HTMLImageElement;
      const minimizedArt = drawer.querySelector('.bes-player-drawer-minimized-art') as HTMLImageElement;

      expect(fullArt.src).toBe(testUrl);
      expect(minimizedArt.src).toBe(testUrl);
    });
  });

  describe('AC-V1: 3-column flexbox layout', () => {
    it('should create left column with album art and transport', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const leftColumn = drawer.querySelector('.bes-player-drawer-left') as HTMLElement;
      expect(leftColumn).toBeDefined();

      const albumArt = leftColumn.querySelector('.bes-player-drawer-album-art');
      expect(albumArt).toBeDefined();

      const transport = leftColumn.querySelector('.bes-player-drawer-transport');
      expect(transport).toBeDefined();
    });

    it('should create center column for player controls', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const centerColumn = drawer.querySelector('.bes-player-drawer-center') as HTMLElement;
      expect(centerColumn).toBeDefined();

      const playerContainer = drawer.querySelector('.bes-player-drawer-player');
      expect(playerContainer).toBeDefined();
    });

    it('should create right column with header actions', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const rightColumn = drawer.querySelector('.bes-player-drawer-right') as HTMLElement;
      expect(rightColumn).toBeDefined();

      const headerActions = rightColumn.querySelector('.bes-player-drawer-header-actions');
      expect(headerActions).toBeDefined();
    });
  });

  describe('AC-A2: Layout structure validation', () => {
    it('should have correct container max-width (624px)', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const playerMain = drawer.querySelector('.bes-player-drawer-main') as HTMLElement;
      expect(playerMain.style.maxWidth).toBe('624px');
    });

    it('should use flexbox display for main container', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const playerMain = drawer.querySelector('.bes-player-drawer-main') as HTMLElement;
      expect(playerMain.style.display).toBe('flex');
    });
  });
});
