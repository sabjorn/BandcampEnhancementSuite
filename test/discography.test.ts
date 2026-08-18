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

    it('should return nothing when the album is not on the page', () => {
      createDomNodes(gridOf('1'));

      expect(discography.albumArtUrlFor('99', 'album')).toBe('');
    });
  });
});
