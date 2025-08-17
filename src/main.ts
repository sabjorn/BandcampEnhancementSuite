import { createLogger } from './logger';
import { initLabelView } from './label_view';
import { initDownloadHelper } from './download_helper';
import { initPlayer } from './player';
import { initAudioFeatures } from './audioFeatures';
import { initCart } from './pages/cart';

const main = async (): Promise<void> => {
  const log = createLogger();

  initLabelView();

  const checkIsDownloadPage: Element | null = document.querySelector('.download-item-container');
  if (checkIsDownloadPage) {
    initDownloadHelper();
  }

  const checkIsPageWithPlayer: Element | null = document.querySelector('div.inline_player');
  if (checkIsPageWithPlayer && window.location.href !== 'https://bandcamp.com/') {
    await initPlayer();

    let config_port: chrome.runtime.Port;
    try {
      config_port = chrome.runtime.connect(null, { name: 'bandcamplabelview' });
    } catch (e: any) {
      if (e.message?.includes('Error in invocation of runtime.connect in main.js')) {
        log.error(e);
        return;
      } else {
        throw e;
      }
    }

    initAudioFeatures(config_port);
  }

  const dataBlobElement: Element | null = document.querySelector('[data-blob]');
  if (dataBlobElement) {
    const dataBlobAttr: string | null = dataBlobElement.getAttribute('data-blob');
    if (dataBlobAttr) {
      const { has_cart }: { has_cart: boolean } = JSON.parse(dataBlobAttr);
      if (has_cart) {
        await initCart();
      }
    }
  }
};

main();
