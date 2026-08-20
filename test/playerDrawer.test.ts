import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';
import { prevIcon, nextIcon } from '../src/components/player/icons';
import {
  createPlayerDrawer,
  updatePlayerDrawerInfo,
  updateMinimizedPlayButton,
  expandedDrawerWidth,
  DRAWER_MIN_WIDTH,
  CONTENT_GAP
} from '../src/components/player/drawer';

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

  describe('drawer state', () => {
    it('should create drawer with correct initial state', () => {
      const { drawer, getState } = createPlayerDrawer();

      expect(drawer).toBeTruthy();
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

    it('should expand a minimized drawer when opened again', () => {
      const { drawer, openDrawer, minimizeDrawer, getState } = createPlayerDrawer();
      document.body.appendChild(drawer);

      openDrawer();
      minimizeDrawer();
      openDrawer();

      expect(drawer.classList.contains('minimized')).toBe(false);
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

  describe('Filling the page gutter before covering any content', () => {
    const widthWhenGutterIs = (gutter: number, viewport = 1800) => expandedDrawerWidth(viewport, viewport - gutter);

    it('should stretch across the gutter, stopping short of the content', () => {
      expect(widthWhenGutterIs(900)).toBe(900 - CONTENT_GAP);
    });

    it('should leave the same breathing room at any gutter width', () => {
      expect(widthWhenGutterIs(900)).toBe(900 - CONTENT_GAP);
      expect(widthWhenGutterIs(700)).toBe(700 - CONTENT_GAP);
    });

    it('should narrow with the gutter as the window shrinks', () => {
      expect(widthWhenGutterIs(700)).toBeLessThan(widthWhenGutterIs(900));
    });

    it('should stop shrinking once it reaches its minimum width', () => {
      expect(widthWhenGutterIs(DRAWER_MIN_WIDTH + CONTENT_GAP)).toBe(DRAWER_MIN_WIDTH);
    });

    it('should hold the minimum width as the window keeps shrinking', () => {
      expect(widthWhenGutterIs(400)).toBe(DRAWER_MIN_WIDTH);
      expect(widthWhenGutterIs(200, 800)).toBe(DRAWER_MIN_WIDTH);
    });

    it('should never be narrower than the minimum, even with no gutter at all', () => {
      expect(expandedDrawerWidth(600, 600)).toBe(DRAWER_MIN_WIDTH);
    });

    it('should publish the width for the stylesheet to use', () => {
      const page = document.createElement('div');
      page.id = 'pgBd';
      document.body.appendChild(page);
      page.getBoundingClientRect = () => ({ right: 900 }) as DOMRect;

      const { drawer, openDrawer } = createPlayerDrawer();
      document.body.appendChild(drawer);
      openDrawer();

      expect(document.documentElement.style.getPropertyValue('--bes-drawer-width')).toMatch(/^\d+px$/);

      page.remove();
      document.documentElement.style.removeProperty('--bes-drawer-width');
    });
  });

  describe('Reclaiming the page gutter while the drawer is expanded', () => {
    const pageIsNarrowed = () => document.body.classList.contains('bes-drawer-expanded');

    afterEach(() => {
      document.body.classList.remove('bes-drawer-expanded', 'bes-drawer-host');
    });

    it('should mark the page as hosting a drawer so the change can animate', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      expect(document.body.classList.contains('bes-drawer-host')).toBe(true);
    });

    it('should narrow the page gutter when the drawer opens', () => {
      const { drawer, openDrawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      expect(pageIsNarrowed()).toBe(false);

      openDrawer();

      expect(pageIsNarrowed()).toBe(true);
    });

    it('should give the gutter back when the drawer closes', () => {
      const { drawer, openDrawer, closeDrawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      openDrawer();
      closeDrawer();

      expect(pageIsNarrowed()).toBe(false);
    });

    it('should give the gutter back when the drawer shrinks to the wedge', () => {
      const { drawer, openDrawer, minimizeDrawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      openDrawer();
      minimizeDrawer();

      expect(pageIsNarrowed()).toBe(false);
    });

    it('should narrow the gutter again when the wedge is expanded', () => {
      const { drawer, openDrawer, minimizeDrawer, maximizeDrawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      openDrawer();
      minimizeDrawer();
      maximizeDrawer();

      expect(pageIsNarrowed()).toBe(true);
    });
  });

  describe('minimize and close buttons', () => {
    it('should have minimize button that toggles state', () => {
      const { drawer, openDrawer, getState } = createPlayerDrawer();
      document.body.appendChild(drawer);
      openDrawer();

      const minimizeButton = drawer.querySelector('.bes-player-drawer-minimize') as HTMLButtonElement;
      expect(minimizeButton).toBeTruthy();

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
      expect(closeButton).toBeTruthy();

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

  describe('minimized wedge layout', () => {
    it('should create minimized bar with correct elements', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const minimizedBar = drawer.querySelector('.bes-player-drawer-minimized-bar');
      expect(minimizedBar).toBeTruthy();

      const minimizedArt = drawer.querySelector('.bes-player-drawer-minimized-art');
      expect(minimizedArt).toBeTruthy();

      const minimizedControls = drawer.querySelector('.bes-player-drawer-minimized-controls');
      expect(minimizedControls).toBeTruthy();
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

  describe('minimized bar state updates', () => {
    it('should update minimized play button icon based on playback state', () => {
      createDomNodes(`
        <button class="bes-player-drawer-minimized-play">▶</button>
      `);

      updateMinimizedPlayButton(true);

      const button = document.querySelector('.bes-player-drawer-minimized-play') as HTMLButtonElement;
      expect(button.classList.contains('playing')).toBe(true);
      expect(button.getAttribute('aria-label')).toBe('Pause');

      updateMinimizedPlayButton(false);
      expect(button.classList.contains('playing')).toBe(false);
      expect(button.getAttribute('aria-label')).toBe('Play');
    });
  });

  describe('Wedge player icons match the expanded player', () => {
    it('should draw its prev and next from the shared icon source', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const pathOf = (markup: string) => {
        const holder = document.createElement('div');
        holder.innerHTML = markup;
        return holder.querySelector('path')?.getAttribute('d');
      };

      const wedgePrev = drawer.querySelector('.bes-player-drawer-minimized-prev svg path');
      const wedgeNext = drawer.querySelector('.bes-player-drawer-minimized-next svg path');

      expect(wedgePrev?.getAttribute('d')).toBe(pathOf(prevIcon(14)));
      expect(wedgeNext?.getAttribute('d')).toBe(pathOf(nextIcon(14)));
    });

    it('should carry both play and pause icons so state toggles by class', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const play = drawer.querySelector('.bes-player-drawer-minimized-play');
      expect(play?.querySelector('.bes-play-icon')).toBeTruthy();
      expect(play?.querySelector('.bes-pause-icon')).toBeTruthy();
    });

    it('should render icons as svg rather than text glyphs', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      ['prev', 'play', 'next'].forEach(name => {
        const btn = drawer.querySelector(`.bes-player-drawer-minimized-${name}`) as HTMLElement;
        expect(btn.querySelector('svg')).toBeTruthy();
        expect(btn.textContent?.trim()).toBe('');
      });
    });
  });

  describe('Keyboard shortcuts survive clicking player controls', () => {
    it('should stop drawer buttons taking focus so focus stays on the body', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const button = drawer.querySelector('.bes-player-drawer-minimized-play') as HTMLElement;
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      button.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    it('should not block focus for non-button targets', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const tracklist = drawer.querySelector('.bes-player-drawer-tracklist') as HTMLElement;
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      tracklist.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('Branding and visual continuity with the wedge', () => {
    it('should carry the logo in a footer that survives both states', () => {
      const { drawer, openDrawer, minimizeDrawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const footer = drawer.querySelector('.bes-player-drawer-footer');
      expect(footer?.querySelector('.bes-player-drawer-logo')).toBeTruthy();

      openDrawer();
      expect(drawer.querySelector('.bes-player-drawer-footer')).toBeTruthy();

      minimizeDrawer();
      expect(drawer.querySelector('.bes-player-drawer-footer')).toBeTruthy();
    });

    it('should name the logo for assistive technology', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const logo = drawer.querySelector('.bes-player-drawer-logo') as HTMLElement;

      expect(logo.getAttribute('role')).toBe('img');
      expect(logo.getAttribute('aria-label')).toBe('Bandcamp Enhancement Suite');
    });

    it('should keep the footer outside the scrolling tracklist', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const content = drawer.querySelector('.bes-player-drawer-content') as HTMLElement;

      expect(content.querySelector('.bes-player-drawer-footer')).toBeNull();
      expect(drawer.querySelector(':scope > .bes-player-drawer-footer')).toBeTruthy();
    });
  });

  describe('album art extraction', () => {
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

  describe('three-column layout', () => {
    it('should create left column with album art and transport', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const leftColumn = drawer.querySelector('.bes-player-drawer-left') as HTMLElement;
      expect(leftColumn).toBeTruthy();

      const albumArt = leftColumn.querySelector('.bes-player-drawer-album-art');
      expect(albumArt).toBeTruthy();

      const transport = leftColumn.querySelector('.bes-player-drawer-transport');
      expect(transport).toBeTruthy();
    });

    it('should create center column for player controls', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const centerColumn = drawer.querySelector('.bes-player-drawer-center') as HTMLElement;
      expect(centerColumn).toBeTruthy();

      const playerContainer = drawer.querySelector('.bes-player-drawer-player');
      expect(playerContainer).toBeTruthy();
    });

    it('should create right column with header actions', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const rightColumn = drawer.querySelector('.bes-player-drawer-right') as HTMLElement;
      expect(rightColumn).toBeTruthy();

      const headerActions = rightColumn.querySelector('.bes-player-drawer-header-actions');
      expect(headerActions).toBeTruthy();
    });
  });

  describe('layout structure', () => {
    it('should nest the three columns inside the main container', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const main = drawer.querySelector('.bes-player-drawer-main') as HTMLElement;

      expect(main.querySelector('.bes-player-drawer-left')).toBeTruthy();
      expect(main.querySelector('.bes-player-drawer-center')).toBeTruthy();
      expect(main.querySelector('.bes-player-drawer-right')).toBeTruthy();
    });

    it('should leave layout to the stylesheet rather than inline styles', () => {
      const { drawer } = createPlayerDrawer();
      document.body.appendChild(drawer);

      const styled = Array.from(drawer.querySelectorAll<HTMLElement>('[style]')).map(node => node.className);

      expect(styled).toEqual([]);
    });
  });
});
