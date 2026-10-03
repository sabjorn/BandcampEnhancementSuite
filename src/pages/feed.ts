import Logger from '../logger';
import { generatePreview, attachPreviewListeners } from '../label_view';
import { DiscographyItem, setAlbumSource, updateDiscographyOrder } from '../discography';

const FEED_ITEM_SELECTOR = '.collection-item-container[data-tralbumid][data-tralbumtype]';
const LOAD_MORE_TIMEOUT_MS = 10000;

export function tralbumTypeToIdType(tralbumType?: string): string | null {
  if (tralbumType === 'a') return 'album';
  if (tralbumType === 't') return 'track';
  return null;
}

export function renderFeedPreviews(
  port: chrome.runtime.Port,
  previewState: { previewOpen: boolean; previewId?: string }
): void {
  document.querySelectorAll(FEED_ITEM_SELECTOR).forEach(item => {
    const container = item as HTMLElement;
    if (container.dataset.besPreview === 'true') return;

    const id = container.dataset.tralbumid;
    if (!id) return;

    const idType = tralbumTypeToIdType(container.dataset.tralbumtype);
    if (!idType) return;

    container.dataset.besPreview = 'true';

    const preview = generatePreview(id, idType);
    preview.querySelector('.historybox')?.remove();

    const anchor = container.classList.contains('story-innards')
      ? container.querySelector('.tralbum-details') || container
      : container;
    anchor.appendChild(preview);

    attachPreviewListeners(preview, port, previewState, false);
  });
}

export function extractFeedOrder(): DiscographyItem[] {
  const seen = new Set<string>();
  const items: DiscographyItem[] = [];

  const feedContainer = document.getElementById('stories') || document.body;
  feedContainer.querySelectorAll<HTMLElement>(FEED_ITEM_SELECTOR).forEach(element => {
    const id = element.dataset.tralbumid;
    const type = tralbumTypeToIdType(element.dataset.tralbumtype);
    if (!id || !type || seen.has(`${type}-${id}`)) return;

    seen.add(`${type}-${id}`);
    items.push({ id, type, element });
  });

  return items;
}

export function loadMoreFeedItems(timeoutMs: number = LOAD_MORE_TIMEOUT_MS): Promise<boolean> {
  const feedContainer = document.getElementById('stories') || document.body;
  const countBefore = extractFeedOrder().length;

  return new Promise(resolve => {
    const finish = (loaded: boolean) => {
      observer.disconnect();
      clearTimeout(timer);
      resolve(loaded);
    };

    const observer = new MutationObserver(() => {
      if (extractFeedOrder().length > countBefore) finish(true);
    });
    const timer = setTimeout(() => finish(false), timeoutMs);

    observer.observe(feedContainer, { childList: true, subtree: true });
    window.scrollTo({ top: document.documentElement.scrollHeight });
  });
}

function revealFeedItem(item: DiscographyItem): void {
  const story = item.element.closest('.story') ?? item.element;
  story.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
}

export async function initFeed(port: chrome.runtime.Port): Promise<void> {
  const log = new Logger();
  const previewState: { previewOpen: boolean; previewId?: string } = { previewOpen: false, previewId: undefined };

  log.info('Rendering BES feed previews...');
  renderFeedPreviews(port, previewState);
  setAlbumSource({
    extract: extractFeedOrder,
    loadMore: loadMoreFeedItems,
    reveal: revealFeedItem,
    showAlbumControls: true
  });

  const feedContainer = document.getElementById('stories') || document.body;
  const observer = new MutationObserver(() => {
    observer.disconnect();
    renderFeedPreviews(port, previewState);
    updateDiscographyOrder();
    observer.observe(feedContainer, { childList: true, subtree: true });
  });
  observer.observe(feedContainer, { childList: true, subtree: true });
}
