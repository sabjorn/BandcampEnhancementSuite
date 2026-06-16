import Logger from '../logger';
import { generatePreview } from '../label_view.js';
import { attachPreviewListeners } from '../utilities.js';

const FEED_ITEM_SELECTOR = '.collection-item-container[data-tralbumid][data-tralbumtype]';

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

    attachPreviewListeners(preview, port, previewState);
  });
}

export async function initFeed(port: chrome.runtime.Port): Promise<void> {
  const log = new Logger();
  const previewState: { previewOpen: boolean; previewId?: string } = { previewOpen: false, previewId: undefined };

  log.info('Rendering BES feed previews...');
  renderFeedPreviews(port, previewState);

  const feedContainer = document.getElementById('stories') || document.body;
  const observer = new MutationObserver(() => {
    observer.disconnect();
    renderFeedPreviews(port, previewState);
    observer.observe(feedContainer, { childList: true, subtree: true });
  });
  observer.observe(feedContainer, { childList: true, subtree: true });
}
