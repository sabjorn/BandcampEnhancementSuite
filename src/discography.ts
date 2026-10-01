import Logger from './logger';

const log = new Logger();

export interface DiscographyItem {
  id: string;
  type: string;
  element: Element;
}

export interface AlbumSource {
  extract: () => DiscographyItem[];
  // Pulls more items into the page (e.g. the next page of a feed); resolves true if any arrived.
  loadMore?: () => Promise<boolean>;
  reveal?: (item: DiscographyItem) => void;
  showAlbumControls?: boolean;
}

let order: DiscographyItem[] = [];
let selectedIndex = -1;
const discographySource: AlbumSource = {
  extract: extractDiscographyOrder,
  reveal: item => item.element.scrollIntoView?.({ behavior: 'smooth', block: 'center' }),
  showAlbumControls: true
};

let source: AlbumSource = discographySource;
let pendingLoadMore: Promise<boolean> | null = null;
let sourceExhausted = false;

export function extractDiscographyOrder(): DiscographyItem[] {
  const items: DiscographyItem[] = [];

  document.querySelectorAll('li.music-grid-item[data-item-id]').forEach(item => {
    const idAndType = (item as HTMLElement).dataset.itemId;
    if (!idAndType) return;

    const [type, id] = idAndType.split('-');
    items.push({ id, type, element: item });
  });

  document.querySelectorAll('li.music-grid-item[data-tralbumid][data-tralbumtype="a"]').forEach(item => {
    const id = (item as HTMLElement).dataset.tralbumid;
    if (!id || items.some(existing => existing.id === id && existing.type === 'album')) return;

    items.push({ id, type: 'album', element: item });
  });

  log.info(`Extracted ${items.length} items from discography`);
  return items;
}

export function setAlbumSource(next: AlbumSource): void {
  source = next;
  sourceExhausted = false;
  updateDiscographyOrder();
}

export function updateDiscographyOrder(): void {
  const selectedId = order[selectedIndex]?.id;
  const previousLength = order.length;

  order = source.extract();
  if (selectedId) selectedIndex = findAlbumIndexById(selectedId);
  if (order.length > previousLength) sourceExhausted = false;
}

export function canLoadMoreAlbums(): boolean {
  return selectedIndex !== -1 && Boolean(source.loadMore) && !sourceExhausted;
}

export function loadMoreAlbums(): Promise<boolean> {
  if (!source.loadMore || sourceExhausted) return Promise.resolve(false);

  pendingLoadMore ??= source
    .loadMore()
    .catch(error => {
      log.warn(`Failed to load more albums: ${error}`);
      return false;
    })
    .then(loaded => {
      const previousLength = order.length;
      updateDiscographyOrder();

      const grew = order.length > previousLength;
      if (!loaded && !grew) sourceExhausted = true;
      return loaded || grew;
    })
    .finally(() => {
      pendingLoadMore = null;
    });

  return pendingLoadMore;
}

export function showAlbumControls(): boolean {
  return Boolean(source.showAlbumControls) && selectedIndex !== -1 && order.length > 1;
}

export function revealAlbum(item: DiscographyItem): void {
  source.reveal?.(item);
}

export function findAlbumIndexById(albumId: string): number {
  return order.findIndex(item => item.id === albumId);
}

export function selectAlbum(albumId: string): void {
  selectedIndex = findAlbumIndexById(albumId);
}

export function getCurrentAlbumIndex(): number {
  return selectedIndex;
}

export function getDiscographyLength(): number {
  return order.length;
}

export function hasNextAlbum(): boolean {
  return selectedIndex !== -1 && selectedIndex < order.length - 1;
}

export function hasPreviousAlbum(): boolean {
  return selectedIndex > 0;
}

export function nextAlbum(): DiscographyItem | null {
  return hasNextAlbum() ? order[selectedIndex + 1] : null;
}

export function previousAlbum(): DiscographyItem | null {
  return hasPreviousAlbum() ? order[selectedIndex - 1] : null;
}

export function albumArtUrlFor(albumId: string, albumType: string): string {
  const listing =
    document.querySelector(`li.music-grid-item[data-item-id="${albumType}-${albumId}"]`) ??
    document.querySelector(`li.music-grid-item[data-tralbumid="${albumId}"]`) ??
    document.querySelector(`.collection-item-container[data-tralbumid="${albumId}"]`);

  return listing?.querySelector('img')?.src ?? '';
}
