import { createLogger } from './logger';
import { initLabelView } from './label_view';
import { initDownload } from './pages/download';
import { initPlayer } from './player';
import { initAudioFeatures } from './audioFeatures';
import { initCart } from './pages/cart';
import { initHideUnhide } from './pages/hide_unhide_collection';

const initBESDrawer = (): void => {
  const log = createLogger();

  if (document.querySelector('.bes-drawer')) {
    log.debug('BES drawer already exists');
    return;
  }

  const drawer = document.createElement('div');
  drawer.className = 'bes-drawer';

  const header = document.createElement('div');
  header.className = 'bes-drawer-header';

  const title = document.createElement('h2');
  title.textContent = 'Bandcamp Enhancement Suite';

  const closeButton = document.createElement('button');
  closeButton.className = 'bes-drawer-close';
  closeButton.innerHTML = '×';
  closeButton.setAttribute('aria-label', 'Close settings');

  header.appendChild(title);
  header.appendChild(closeButton);

  const content = document.createElement('div');
  content.className = 'bes-drawer-content';

  const findMusicSection = document.createElement('div');
  findMusicSection.className = 'bes-drawer-section';

  const findMusicTitle = document.createElement('h3');
  findMusicTitle.textContent = 'FindMusic.club Integration';

  const findMusicDesc = document.createElement('p');
  findMusicDesc.textContent = 'Discover new music based on your Bandcamp collection';

  const findMusicButton = document.createElement('button');
  findMusicButton.className = 'bes-drawer-button';
  findMusicButton.textContent = 'Enable FindMusic.club Integration';
  findMusicButton.addEventListener('click', () => {
    log.info('FindMusic integration button clicked');
    chrome.runtime.sendMessage({ contentScriptQuery: 'openFindMusic' });
  });

  const updateButtonText = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        contentScriptQuery: 'checkFindMusicPermissions'
      });
      log.info(`Permission check response: ${JSON.stringify(response)}`);
      findMusicButton.textContent = response?.granted
        ? 'Log in to FindMusic.club'
        : 'Enable FindMusic.club Integration';
    } catch (error) {
      log.error(`Failed to check permissions: ${error}`);
      findMusicButton.textContent = 'Enable FindMusic.club Integration';
    }
  };

  updateButtonText();

  findMusicSection.appendChild(findMusicTitle);
  findMusicSection.appendChild(findMusicDesc);
  findMusicSection.appendChild(findMusicButton);

  content.appendChild(findMusicSection);

  drawer.appendChild(header);
  drawer.appendChild(content);

  const overlay = document.createElement('div');
  overlay.className = 'bes-drawer-overlay';

  const openDrawer = async () => {
    await updateButtonText();
    drawer.classList.add('open');
    overlay.classList.add('open');
  };

  const closeDrawer = () => {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
  };

  const toggleDrawer = async () => {
    if (drawer.classList.contains('open')) {
      closeDrawer();
      return;
    }
    await openDrawer();
  };

  closeButton.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);

  const button = document.createElement('button');
  button.className = 'findmusic-floating-button';
  button.title = 'BES Settings';
  button.setAttribute('aria-label', 'Toggle Bandcamp Enhancement Suite Settings');

  const icon = document.createElement('img');
  icon.className = 'findmusic-button-icon';
  icon.src = chrome.runtime.getURL('icons/icon48.png');
  icon.alt = 'BES Settings';

  button.appendChild(icon);
  button.addEventListener('click', () => {
    log.info('BES settings button clicked');
    toggleDrawer();
  });

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);
  document.body.appendChild(button);

  log.info('BES drawer and button added to page');
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

  // Add BES settings drawer
  initBESDrawer();
};

main();
