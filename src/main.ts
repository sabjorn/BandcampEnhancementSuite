import { createLogger } from './logger';
import { initLabelView } from './label_view';
import { initDownload } from './pages/download';
import { initPlayer } from './player';
import { initAudioFeatures } from './audioFeatures';
import { initCart } from './pages/cart';
import { initHideUnhide } from './pages/hide_unhide_collection';

const initFindMusicButton = (): void => {
  const log = createLogger();

  if (document.querySelector('.findmusic-floating-button')) {
    log.debug('FindMusic button already exists');
    return;
  }

  const button = document.createElement('button');
  button.className = 'findmusic-floating-button';
  button.title = 'Log in to FindMusic.club';
  button.setAttribute('aria-label', 'Log in to FindMusic.club');

  const icon = document.createElement('img');
  icon.className = 'findmusic-button-icon';
  icon.src = chrome.runtime.getURL('icons/icon48.png');
  icon.alt = 'FindMusic.club';

  button.appendChild(icon);

  // Add click handler
  button.addEventListener('click', () => {
    log.info('FindMusic floating button clicked');
    chrome.runtime.sendMessage({ contentScriptQuery: 'openFindMusic' });
  });

  // Add to page
  document.body.appendChild(button);

  log.info('FindMusic floating button added to page');
};

const main = async (): Promise<void> => {
  const log = createLogger();

  const checkIsDownloadPage: Element | null = document.querySelector('.download-item-container');
  if (checkIsDownloadPage) {
    initDownload();
  }

  const config_port: chrome.runtime.Port = (() => {
    try {
      return chrome.runtime.connect(null, { name: 'bes' });
    } catch (e: any) {
      if (e.message?.includes('Error in invocation of runtime.connect in main.js')) {
        log.error(e);
        throw e;
      } else {
        throw e;
      }
    }
  })();

  initLabelView(config_port);

  const checkIsPageWithPlayer: Element | null = document.querySelector('div.inline_player');
  if (checkIsPageWithPlayer && window.location.href !== 'https://bandcamp.com/') {
    await initPlayer();
    initAudioFeatures(config_port);
  }

  const dataBlobElement: Element | null = document.querySelector('[data-blob]');
  if (dataBlobElement) {
    const dataBlobAttr: string | null = dataBlobElement.getAttribute('data-blob');
    if (dataBlobAttr) {
      const { has_cart }: { has_cart: boolean } = JSON.parse(dataBlobAttr);
      if (has_cart) {
        await initCart(config_port);
      }
    }
  }

  const checkIsCollectionPage: Element | null = document.querySelector('ol.collection-grid.editable.ui-sortable');
  if (checkIsCollectionPage) {
    await initHideUnhide(config_port);
  }

  // Add FindMusic.club button to navigation
  initFindMusicButton();
};

main();
