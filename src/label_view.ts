import Logger from './logger';
import { attachPreviewListeners } from './utilities.js';
import { createPlayerDrawer } from './components/playerDrawer';
import { loadAlbumIntoDrawer, updateDiscographyOrder } from './playerLoader';
import { initContinuousPlay } from './continuousPlay';
import { DEFAULT_KEYBOARD_SETTINGS } from './types/keyboard';

export function setHistory(id: string, state: boolean): void {
  const historybox = document.querySelector(`#${CSS.escape(id)} .historybox`);
  if (historybox) {
    historybox.classList.add('follow-unfollow');

    if (state) {
      historybox.classList.add('following');
    } else {
      historybox.classList.remove('following');
    }
  }
}

export function setPreviewed(id: string, port: chrome.runtime.Port): void {
  port.postMessage({ setTrue: id });
}

export function boxClicked(event: Event, port: chrome.runtime.Port): void {
  const id = (event.target as HTMLElement).parentElement?.getAttribute('id');
  port.postMessage({ toggle: id });
}

export function previewClicked(event: Event, port: chrome.runtime.Port): void {
  const id = (event.target as HTMLElement).parentElement?.getAttribute('id');
  setPreviewed(id, port);
}

let drawerController: ReturnType<typeof createPlayerDrawer> | null = null;

export function fillFrame(
  event: Event,
  previewState: { previewOpen: boolean; previewId?: string },
  enableFetchCaching: boolean = false,
  port?: chrome.runtime.Port
): void {
  const preview = (event.target as HTMLElement).closest('.preview')?.querySelector('.preview-frame');
  if (!preview) return;

  const idAndType = preview.getAttribute('id');
  if (!idAndType) return;

  const id = idAndType.split('-')[1];
  const idType = idAndType.split('-')[0];

  if (!drawerController) {
    drawerController = createPlayerDrawer();
    document.body.appendChild(drawerController.drawer);
  }

  if (drawerController.getState().isOpen && previewState.previewId === id) {
    if (drawerController.getState().isMinimized) {
      drawerController.maximizeDrawer();
    } else {
      drawerController.minimizeDrawer();
    }
    return;
  }

  previewState.previewId = id;
  previewState.previewOpen = true;

  if (!drawerController.getState().isOpen) {
    drawerController.openDrawer();
  } else if (drawerController.getState().isMinimized) {
    drawerController.maximizeDrawer();
  }

  if (port) {
    setPreviewed(id, port);
  }

  loadAlbumIntoDrawer(id, idType, enableFetchCaching, DEFAULT_KEYBOARD_SETTINGS, port).catch(error => {
    const log = new Logger();
    log.error(`Failed to load album into drawer: ${error}`);
  });
}

export async function initLabelView(port: chrome.runtime.Port, enableFetchCaching: boolean = false): Promise<void> {
  const log = new Logger();
  const previewState = { previewOpen: false, previewId: undefined };

  port.onMessage.addListener(msg => {
    if (msg.id) setHistory(msg.id.key, msg.id.value);
  });

  log.info('Rendering BES...');
  renderDom(port, previewState, enableFetchCaching);

  updateDiscographyOrder();
  initContinuousPlay(enableFetchCaching);

  const observer = new MutationObserver(() => {
    updateDiscographyOrder();
  });

  const discographyContainer = document.querySelector('ol.music-grid') || document.body;
  observer.observe(discographyContainer, { childList: true, subtree: true });
}

export function generatePreview(id: string, idType: string): HTMLDivElement {
  const button = document.createElement('button');
  button.setAttribute('title', 'load preview player');
  button.setAttribute('type', 'button');
  button.setAttribute('class', 'follow-unfollow open-iframe');
  button.setAttribute('style', 'width: 90%');
  button.append('Preview');

  const checkbox = document.createElement('button');
  checkbox.setAttribute('title', 'preview history (click to toggle)');
  checkbox.setAttribute('style', 'margin: 0px 0px 0px 5px; width: 28px; height: 28px; position: absolute;');
  checkbox.setAttribute('class', 'follow-unfollow historybox');

  const preview = document.createElement('div');
  preview.setAttribute('class', 'preview-frame');
  preview.setAttribute('id', `${idType}-${id}`);

  const parent = document.createElement('div');
  parent.setAttribute('id', id);
  parent.setAttribute('class', 'preview');
  parent.appendChild(button);
  parent.appendChild(checkbox);
  parent.appendChild(preview);

  return parent;
}

export function renderDom(
  port: chrome.runtime.Port,
  previewState: { previewOpen: boolean; previewId?: string },
  enableFetchCaching: boolean = false
): void {
  document.querySelectorAll('li.music-grid-item[data-item-id]').forEach(item => {
    const idAndType = (item as HTMLElement).dataset.itemId;
    if (!idAndType) return;

    const id = idAndType.split('-')[1];
    const idType = idAndType.split('-')[0];
    const $preview = generatePreview(id, idType);
    item.appendChild($preview);

    port.postMessage({ query: id });
  });

  document.querySelectorAll('li.music-grid-item[data-tralbumid][data-tralbumtype="a"]').forEach(item => {
    const id = (item as HTMLElement).dataset.tralbumid;
    if (!id) return;
    const preview = generatePreview(id, 'album');
    item.appendChild(preview);

    port.postMessage({ query: id });
  });

  const pagedata = document.querySelector('#pagedata');
  if (!pagedata) return;
  const datablob = JSON.parse((pagedata as HTMLElement).dataset.blob!);
  const urlParams = new URLSearchParams(datablob.lo_querystr);
  const id = urlParams.get('item_id');
  if (id) {
    setPreviewed(id, port);
  }

  attachPreviewListeners(document, port, previewState, enableFetchCaching);

  document.querySelectorAll('.historybox').forEach(item => {
    item.addEventListener('click', event => {
      boxClicked(event, port);
    });
  });
}
