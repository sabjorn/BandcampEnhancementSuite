import Logger from '../logger';
import { generatePreview, fillFrame, previewClicked } from '../label_view.js';

// Feed album/track items reuse Bandcamp's `collection-item-container` markup which
// exposes `data-tralbumid` + `data-tralbumtype` (the same attributes the artist/label
// page preview relies on). `initFeed` only runs on the feed page, so a page-scoped
// query is enough to find every previewable item regardless of how stories are nested.
const FEED_ITEM_SELECTOR = '.collection-item-container[data-tralbumid][data-tralbumtype]';

export function tralbumTypeToIdType(tralbumType: string): string | null {
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
    const idType = tralbumTypeToIdType(container.dataset.tralbumtype || '');
    if (!id || !idType) return;

    container.dataset.besPreview = 'true';

    const preview = generatePreview(id, idType);
    // The feed only needs the preview player itself, not the artist-page history toggle.
    preview.querySelector('.historybox')?.remove();

    // Main feed stories nest the previewable container (`.story-innards`) around a large
    // layout; append next to the title/art (`.tralbum-details`) so the button is visible
    // rather than buried below the tags footer. Grid items have no `.tralbum-details`, so
    // they keep appending to the container itself.
    const anchor = container.classList.contains('story-innards')
      ? container.querySelector('.tralbum-details') || container
      : container;
    anchor.appendChild(preview);

    preview.querySelectorAll('.open-iframe').forEach(button => {
      button.addEventListener('click', event => {
        fillFrame(event, previewState);
        // Record the preview so it surfaces in the artist/label page history.
        previewClicked(event, port);
      });
    });
  });
}

export async function initFeed(port: chrome.runtime.Port): Promise<void> {
  const log = new Logger();
  const previewState: { previewOpen: boolean; previewId?: string } = { previewOpen: false, previewId: undefined };

  log.info('Rendering BES feed previews...');
  renderFeedPreviews(port, previewState);

  // The feed lazily appends more stories as the user scrolls, so re-render whenever
  // new nodes arrive. Disconnect while we mutate the DOM ourselves to avoid re-triggering.
  const feedContainer = document.getElementById('stories') || document.body;
  const observer = new MutationObserver(() => {
    observer.disconnect();
    renderFeedPreviews(port, previewState);
    observer.observe(feedContainer, { childList: true, subtree: true });
  });
  observer.observe(feedContainer, { childList: true, subtree: true });
}
