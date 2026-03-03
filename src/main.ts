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

  // Find the navigation menu items container
  const nav = document.querySelector('nav[aria-label="Bandcamp"]');
  if (!nav) {
    log.debug('Bandcamp navigation not found, skipping FindMusic button');
    return;
  }

  const menuItems = nav.querySelector('.menu-items');
  if (!menuItems) {
    log.debug('Navigation menu items not found, skipping FindMusic button');
    return;
  }

  // Check if button already exists
  if (document.querySelector('.findmusic-button')) {
    log.debug('FindMusic button already exists');
    return;
  }

  // Create button container (list item)
  const buttonContainer = document.createElement('li');
  buttonContainer.className = 'findmusic-button';

  // Create the button element
  const button = document.createElement('button');
  button.className = 'g-button';
  button.style.cssText = 'padding: 8px 12px; display: flex; align-items: center; gap: 6px; cursor: pointer;';
  button.title = 'Open FindMusic.club';

  // Add SVG icon
  const icon = createFindMusicSvgIcon();
  (icon as SVGElement).style.cssText = 'width: 16px; height: 16px; fill: currentColor;';
  button.appendChild(icon);

  // Add text label
  const label = document.createElement('span');
  label.textContent = 'FindMusic';
  button.appendChild(label);

  // Add click handler
  button.addEventListener('click', () => {
    log.info('FindMusic button clicked');
    chrome.runtime.sendMessage({ contentScriptQuery: 'openFindMusic' });
  });

  buttonContainer.appendChild(button);

  // Insert before the profile avatar (last item in menu)
  const profileAvatar = menuItems.querySelector('.profile-avatar');
  if (profileAvatar && profileAvatar.parentElement) {
    menuItems.insertBefore(buttonContainer, profileAvatar.parentElement);
    log.info('FindMusic button added to navigation');
  } else {
    // If no profile avatar found, append to end
    menuItems.appendChild(buttonContainer);
    log.info('FindMusic button added to navigation (end)');
  }
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
