import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  }
}));

import { initFeed, renderFeedPreviews, tralbumTypeToIdType } from '../src/pages/feed';

const mockPort = {
  postMessage: vi.fn(),
  onMessage: {
    addListener: vi.fn()
  }
};

const createPreviewState = () => ({ previewOpen: false, previewId: undefined as string | undefined });

describe('Feed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The preview button injects a real Bandcamp embedded-player iframe; stop happy-dom
    // from attempting to network-load it so the suite output stays clean.
    const happyDOM = (globalThis as any).happyDOM;
    if (happyDOM?.settings) happyDOM.settings.disableIframePageLoading = true;
  });

  afterEach(() => {
    cleanupTestNodes();
    vi.restoreAllMocks();
  });

  describe('tralbumTypeToIdType()', () => {
    it('maps Bandcamp tralbum type codes to embedded player types', () => {
      expect(tralbumTypeToIdType('a')).toBe('album');
      expect(tralbumTypeToIdType('t')).toBe('track');
      expect(tralbumTypeToIdType('x')).toBeNull();
      expect(tralbumTypeToIdType('')).toBeNull();
    });
  });

  describe('renderFeedPreviews()', () => {
    beforeEach(() => {
      createDomNodes(`
        <div id="stories">
          <ol class="story-list">
            <li class="story">
              <div class="collection-item-container" data-tralbumid="12345" data-tralbumtype="a">
                <a class="item-link" href="https://artist.bandcamp.com/album/foo"></a>
              </div>
            </li>
            <li class="story">
              <div class="collection-item-container" data-tralbumid="67890" data-tralbumtype="t">
                <a class="item-link" href="https://artist.bandcamp.com/track/bar"></a>
              </div>
            </li>
            <li class="story">
              <div class="collection-item-container" data-tralbumid="111" data-tralbumtype="x"></div>
            </li>
          </ol>
        </div>
      `);
    });

    it('adds a preview button and frame to each previewable feed item', () => {
      renderFeedPreviews(mockPort as any, createPreviewState());

      const previews = document.querySelectorAll('.collection-item-container .preview');
      expect(previews.length).toBe(2);

      const album = document.querySelector('.collection-item-container[data-tralbumid="12345"]')!;
      expect(album.querySelector('button.open-iframe')?.textContent).toBe('Preview');
      expect(album.querySelector('.preview-frame')?.getAttribute('id')).toBe('album-12345');

      const track = document.querySelector('.collection-item-container[data-tralbumid="67890"]')!;
      expect(track.querySelector('.preview-frame')?.getAttribute('id')).toBe('track-67890');
    });

    it('skips items whose tralbum type is unknown', () => {
      renderFeedPreviews(mockPort as any, createPreviewState());

      const unknown = document.querySelector('.collection-item-container[data-tralbumid="111"]')!;
      expect(unknown.querySelector('.preview')).toBeNull();
      expect((unknown as HTMLElement).dataset.besPreview).toBeUndefined();
    });

    it('does not render the artist-page history toggle on feed items', () => {
      renderFeedPreviews(mockPort as any, createPreviewState());

      expect(document.querySelectorAll('.collection-item-container .historybox').length).toBe(0);
      expect(document.querySelectorAll('.collection-item-container button.open-iframe').length).toBe(2);
    });

    it('is idempotent and does not add duplicate previews when run again', () => {
      const previewState = createPreviewState();
      renderFeedPreviews(mockPort as any, previewState);
      renderFeedPreviews(mockPort as any, previewState);

      expect(document.querySelectorAll('.collection-item-container .preview').length).toBe(2);
    });

    it('injects an embedded player iframe when the preview button is clicked', () => {
      // happy-dom logs an (expected) error because iframe page loading is disabled above.
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderFeedPreviews(mockPort as any, createPreviewState());

      const button = document.querySelector(
        '.collection-item-container[data-tralbumid="12345"] button.open-iframe'
      ) as HTMLButtonElement;
      button.click();

      const iframe = document.querySelector(
        '.collection-item-container[data-tralbumid="12345"] .preview-frame iframe'
      ) as HTMLIFrameElement;
      expect(iframe).toBeTruthy();
      expect(iframe.getAttribute('src')).toContain('EmbeddedPlayer/album=12345');
      expect(iframe.getAttribute('src')).toContain('tracklist=true');

      expect(mockPort.postMessage).toHaveBeenCalledWith({ setTrue: '12345' });

      consoleError.mockRestore();
    });

    it('places the preview next to the details of a main feed story rather than at the bottom', () => {
      createDomNodes(`
        <div id="stories-extra">
          <div class="story-innards collection-item-container" data-tralbumid="555" data-tralbumtype="a">
            <div class="tralbum-wrapper">
              <div class="tralbum-details"><div class="collection-item-title">An Album</div></div>
            </div>
            <div class="story-footer"><div class="collection-item-tags">tags</div></div>
          </div>
        </div>
      `);

      renderFeedPreviews(mockPort as any, createPreviewState());

      const story = document.querySelector('.story-innards[data-tralbumid="555"]')!;
      const details = story.querySelector('.tralbum-details')!;
      expect(details.querySelector('.preview')).toBeTruthy();
      // The preview should not be a trailing child of the story (where it would be buried).
      expect(story.lastElementChild?.classList.contains('preview')).toBe(false);
    });
  });

  describe('initFeed()', () => {
    beforeEach(() => {
      createDomNodes(`
        <div id="stories">
          <ol class="story-list">
            <li class="story">
              <div class="collection-item-container" data-tralbumid="12345" data-tralbumtype="a">
                <a class="item-link" href="https://artist.bandcamp.com/album/foo"></a>
              </div>
            </li>
          </ol>
        </div>
      `);
    });

    it('initializes feed preview functionality without throwing', async () => {
      await expect(initFeed(mockPort as any)).resolves.not.toThrow();
      expect(document.querySelector('.collection-item-container .preview')).toBeTruthy();
      expect(document.querySelector('.collection-item-container .historybox')).toBeNull();
    });
  });
});
