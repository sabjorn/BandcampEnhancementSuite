import { createLogger } from './logger';
import { initLabelView } from './label_view';
import { initDownload } from './pages/download';
import { initPlayer } from './player';
import { updateKeyboardSettings } from './keyboardShortcuts';
import { initAudioFeatures } from './audioFeatures';
import { initCart } from './pages/cart';
import { initHideUnhide } from './pages/hide_unhide_collection';
import { initFeed } from './pages/feed';
import { initBESDrawer } from './components/besDrawer';
import { KeyboardSettings } from './types/keyboard';

const log = createLogger();

const documentIdle = async (): Promise<void> => {
  const checkIsDownloadPage: Element | null = document.querySelector('.download-item-container');
  if (checkIsDownloadPage) {
    initDownload();
  }

  const config_port: chrome.runtime.Port = (() => {
    try {
      return chrome.runtime.connect(null, { name: 'bes' });
    } catch (e: any) {
      if (e.message?.includes('Error in invocation of runtime.connect in document_idle.js')) {
        log.error(e);
      }
      throw e;
    }
  })();

  let keyboardSettings: KeyboardSettings | undefined;
  let enableFetchCaching = false;

  const getConfigPromise = new Promise<void>(resolve => {
    const listener = (msg: any) => {
      if (msg.config && msg.config.keyboardSettings) {
        keyboardSettings = msg.config.keyboardSettings;
        enableFetchCaching = msg.config.enableFetchCaching ?? false;
        config_port.onMessage.removeListener(listener);
        resolve();
      }
    };
    config_port.onMessage.addListener(listener);
    config_port.postMessage({ requestConfig: {} });

    setTimeout(() => {
      config_port.onMessage.removeListener(listener);
      resolve();
    }, 1000);
  });

  await getConfigPromise;

  if (keyboardSettings) updateKeyboardSettings(keyboardSettings);

  initLabelView(config_port, enableFetchCaching);

  config_port.onMessage.addListener((msg: any) => {
    if (msg.config && msg.config.keyboardSettings) {
      log.info('Keyboard settings changed, updating handlers');
      updateKeyboardSettings(msg.config.keyboardSettings);
    }
  });

  const checkIsPageWithPlayer: Element | null = document.querySelector('div.inline_player');
  if (checkIsPageWithPlayer && window.location.href !== 'https://bandcamp.com/') {
    await initPlayer(enableFetchCaching);

    initAudioFeatures(config_port);
  }

  // The bes_cart URL parameter is captured at document_start and handed over via
  // sessionStorage, so by the time we get here the parameter itself is already gone.
  const hasStoredCartData =
    sessionStorage.getItem('bes_pending_cart_import') !== null ||
    sessionStorage.getItem('bes_url_cart_param') !== null;
  const processingFlag = sessionStorage.getItem('bes_cart_processing');

  log.info(`Page load state - hasStored: ${hasStoredCartData}, processing: ${processingFlag}`);

  const dataBlobElement: Element | null = document.querySelector('[data-blob]');
  if (dataBlobElement) {
    const dataBlobAttr: string | null = dataBlobElement.getAttribute('data-blob');
    if (dataBlobAttr) {
      const { has_cart }: { has_cart: boolean } = JSON.parse(dataBlobAttr);
      if (has_cart || hasStoredCartData) {
        await initCart(config_port);
      }
    }
  }

  const checkIsCollectionPage: Element | null = document.querySelector('ol.collection-grid.editable.ui-sortable');
  if (checkIsCollectionPage) {
    await initHideUnhide(config_port);
  }

  const checkIsFeedPage: Element | null = document.querySelector('#stories');
  if (checkIsFeedPage) {
    await initFeed(config_port);
  }

  initBESDrawer(config_port);
};

documentIdle();
