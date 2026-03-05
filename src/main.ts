import { createLogger } from './logger';
import { initLabelView } from './label_view';
import { initDownload } from './pages/download';
import { initPlayer } from './player';
import { initAudioFeatures } from './audioFeatures';
import { initCart } from './pages/cart';
import { initHideUnhide } from './pages/hide_unhide_collection';
import { createFindMusicSvgIcon } from './components/svgIcons';

const initFindMusicButton = (): void => {
  const log = createLogger();

  const addButton = (): void => {
    if (document.querySelector('.findmusic-item')) {
      log.debug('FindMusic button already exists');
      return;
    }

    const nav = document.querySelector('nav[aria-label="Bandcamp"]');
    if (!nav) {
      log.debug('Bandcamp nav not found yet');
      return;
    }

    const menuItems = nav.querySelector('ul.menu-items');
    if (!menuItems) {
      log.debug('Menu items ul not found yet');
      return;
    }

    log.debug('Found navigation menu, adding FindMusic button');

    const listItem = document.createElement('li');
    listItem.className = 'findmusic-item';
    listItem.setAttribute('role', 'none');
    listItem.setAttribute('data-v-0265009c', '');
    listItem.style.cssText = 'display: list-item;';

    const button = document.createElement('button');
    button.className = 'g-button no-outline icon-left popover popover-bottom';
    button.setAttribute('role', 'menuitem');
    button.setAttribute('aria-label', 'FindMusic.club');
    button.setAttribute('data-v-4ebd4eaa', '');
    button.setAttribute('data-v-0265009c', '');

    const icon = createFindMusicSvgIcon();
    (icon as SVGElement).setAttribute('width', '24');
    (icon as SVGElement).setAttribute('height', '24');
    (icon as SVGElement).setAttribute('role', 'img');
    (icon as SVGElement).setAttribute('aria-hidden', 'true');
    (icon as SVGElement).setAttribute('class', 'icon');
    button.appendChild(icon);

    const label = document.createElement('span');
    label.textContent = 'FindMusic';
    button.appendChild(label);

    button.addEventListener('click', () => {
      log.info('FindMusic button clicked');
      chrome.runtime.sendMessage({ contentScriptQuery: 'openFindMusic' });
    });

    listItem.appendChild(button);

    const cartItem = menuItems.querySelector('li.cart');
    if (cartItem) {
      menuItems.insertBefore(listItem, cartItem);
      log.info('FindMusic button added to navigation');
    } else {
      menuItems.appendChild(listItem);
      log.info('FindMusic button added to navigation (end)');
    }
  };

  const observer = new MutationObserver(() => {
    const nav = document.querySelector('nav[aria-label="Bandcamp"]');
    if (nav) {
      addButton();
      observer.disconnect();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  addButton();
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
