import Logger from './logger';

const log = new Logger();

export interface DiscographyItem {
  id: string;
  type: string;
  element: Element;
}

let order: DiscographyItem[] = [];
let selectedIndex = -1;

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

export function updateDiscographyOrder(): void {
  order = extractDiscographyOrder();
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
  const gridItem =
    document.querySelector(`li.music-grid-item[data-item-id="${albumType}-${albumId}"]`) ??
    document.querySelector(`li.music-grid-item[data-tralbumid="${albumId}"]`);

  return gridItem?.querySelector('img')?.src ?? '';
}
