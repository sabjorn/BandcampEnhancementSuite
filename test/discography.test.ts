import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  },
  createLogger: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }))
}));

describe('discography', () => {
  let discography: typeof import('../src/discography');

  const gridOf = (...ids: string[]) =>
    ids.map(id => `<li class="music-grid-item" data-item-id="album-${id}"><img src="art-${id}.jpg" /></li>`).join('');

  beforeEach(async () => {
    vi.resetModules();
    discography = await import('../src/discography');
  });

  afterEach(() => {
    cleanupTestNodes();
  });

  describe('reading the page', () => {
    it('should collect items in the order the page lists them', () => {
      createDomNodes(gridOf('1', '2', '3'));

      expect(discography.extractDiscographyOrder().map(item => item.id)).toEqual(['1', '2', '3']);
    });

    it('should read items that carry a tralbum id instead', () => {
      createDomNodes('<li class="music-grid-item" data-tralbumid="9" data-tralbumtype="a"></li>');

      expect(discography.extractDiscographyOrder().map(item => item.id)).toEqual(['9']);
    });

    it('should not list the same album twice when it carries both attributes', () => {
      createDomNodes(
        '<li class="music-grid-item" data-item-id="album-4"></li>' +
          '<li class="music-grid-item" data-tralbumid="4" data-tralbumtype="a"></li>'
      );

      expect(discography.extractDiscographyOrder().length).toBe(1);
    });

    it('should ignore items with no identifier', () => {
      createDomNodes('<li class="music-grid-item"></li>');

      expect(discography.extractDiscographyOrder()).toEqual([]);
    });
  });

  describe('walking through the albums', () => {
    beforeEach(() => {
      createDomNodes(gridOf('1', '2', '3'));
      discography.updateDiscographyOrder();
    });

    it('should know nothing is selected before an album is chosen', () => {
      expect(discography.getCurrentAlbumIndex()).toBe(-1);
      expect(discography.hasNextAlbum()).toBe(false);
      expect(discography.hasPreviousAlbum()).toBe(false);
    });

    it('should select an album by id', () => {
      discography.selectAlbum('2');

      expect(discography.getCurrentAlbumIndex()).toBe(1);
    });

    it('should offer the album on either side', () => {
      discography.selectAlbum('2');

      expect(discography.nextAlbum()?.id).toBe('3');
      expect(discography.previousAlbum()?.id).toBe('1');
    });

    it('should offer nothing beyond the last album', () => {
      discography.selectAlbum('3');

      expect(discography.hasNextAlbum()).toBe(false);
      expect(discography.nextAlbum()).toBeNull();
    });

    it('should offer nothing before the first album', () => {
      discography.selectAlbum('1');

      expect(discography.hasPreviousAlbum()).toBe(false);
      expect(discography.previousAlbum()).toBeNull();
    });

    it('should report how many albums the page holds', () => {
      expect(discography.getDiscographyLength()).toBe(3);
    });
  });

  describe('album art', () => {
    it('should find the art for an album listed by item id', () => {
      createDomNodes(gridOf('7'));

      expect(discography.albumArtUrlFor('7', 'album')).toContain('art-7.jpg');
    });

    it('should find the art for an album listed by tralbum id', () => {
      createDomNodes('<li class="music-grid-item" data-tralbumid="8"><img src="art-8.jpg" /></li>');

      expect(discography.albumArtUrlFor('8', 'album')).toContain('art-8.jpg');
    });

    it('should find the art for an album shown as a feed story', () => {
      createDomNodes(
        '<div class="collection-item-container" data-tralbumid="12" data-tralbumtype="a"><img src="art-12.jpg" /></div>'
      );

      expect(discography.albumArtUrlFor('12', 'album')).toContain('art-12.jpg');
    });

    it('should return nothing when the album is not on the page', () => {
      createDomNodes(gridOf('1'));

      expect(discography.albumArtUrlFor('99', 'album')).toBe('');
    });
  });

  describe('a pluggable album source', () => {
    const itemsFor = (...ids: string[]) =>
      ids.map(id => ({ id, type: 'album', element: document.createElement('div') }));

    it('should read the order from the source instead of the discography grid', () => {
      createDomNodes(gridOf('1', '2'));
      discography.setAlbumSource({ extract: () => itemsFor('7', '8', '9') });

      expect(discography.getDiscographyLength()).toBe(3);
      expect(discography.findAlbumIndexById('8')).toBe(1);
    });

    it('should only show album controls when the source asks and has more than one album', () => {
      discography.setAlbumSource({ extract: () => itemsFor('1', '2'), showAlbumControls: true });
      discography.selectAlbum('1');
      expect(discography.showAlbumControls()).toBe(true);

      discography.setAlbumSource({ extract: () => itemsFor('1'), showAlbumControls: true });
      discography.selectAlbum('1');
      expect(discography.showAlbumControls()).toBe(false);

      discography.setAlbumSource({ extract: () => itemsFor('1', '2') });
      discography.selectAlbum('1');
      expect(discography.showAlbumControls()).toBe(false);
    });

    it('should hide album controls for an album the source does not list', () => {
      discography.setAlbumSource({ extract: () => itemsFor('1', '2'), showAlbumControls: true });
      discography.selectAlbum('99');

      expect(discography.showAlbumControls()).toBe(false);
    });

    it('should keep the selection on the same album when more items arrive', async () => {
      let ids = ['1', '2'];
      discography.setAlbumSource({
        extract: () => itemsFor(...ids),
        loadMore: async () => {
          ids = ['1', '2', '3', '4'];
          return true;
        }
      });
      discography.selectAlbum('2');

      expect(discography.hasNextAlbum()).toBe(false);
      expect(discography.canLoadMoreAlbums()).toBe(true);

      await expect(discography.loadMoreAlbums()).resolves.toBe(true);

      expect(discography.getCurrentAlbumIndex()).toBe(1);
      expect(discography.nextAlbum()?.id).toBe('3');
    });

    it('should share one pending load between callers', async () => {
      const loadMore = vi.fn(async () => false);
      discography.setAlbumSource({ extract: () => itemsFor('1'), loadMore });
      discography.selectAlbum('1');

      await Promise.all([discography.loadMoreAlbums(), discography.loadMoreAlbums()]);

      expect(loadMore).toHaveBeenCalledTimes(1);
    });

    it('should stop offering more once the source runs dry, until new items appear', async () => {
      let ids = ['1'];
      discography.setAlbumSource({ extract: () => itemsFor(...ids), loadMore: async () => false });
      discography.selectAlbum('1');

      await discography.loadMoreAlbums();
      expect(discography.canLoadMoreAlbums()).toBe(false);

      ids = ['1', '2'];
      discography.updateDiscographyOrder();
      expect(discography.canLoadMoreAlbums()).toBe(true);
    });

    it('should not offer more albums before one is selected', () => {
      discography.setAlbumSource({ extract: () => itemsFor('1'), loadMore: async () => true });

      expect(discography.canLoadMoreAlbums()).toBe(false);
    });

    it('should hand the item to the source to reveal', () => {
      const reveal = vi.fn();
      const [item] = itemsFor('1');
      discography.setAlbumSource({ extract: () => [item], reveal });

      discography.revealAlbum(item);

      expect(reveal).toHaveBeenCalledWith(item);
    });
  });
});
