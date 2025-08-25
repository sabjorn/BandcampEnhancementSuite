import Logger from '../logger';

import { createButton, createInputButtonPair } from '../components/buttons.js';
import { downloadFile, dateString, loadTextFile } from '../utilities';
import { CURRENCY_MINIMUMS, addAlbumToCart, getTralbumDetails } from '../bclient';
import {
  showSuccessMessage,
  showErrorMessage,
  updatePersistentNotification,
  showPersistentNotification,
  removePersistentNotification
} from '../components/notifications';
import { createShoppingCartItem } from '../components/shoppingCart.js';
import { createPlusSvgIcon } from '../components/svgIcons';

const BES_SUPPORT_TRALBUM_ID = 1609998585;
const BES_SUPPORT_TRALBUM_TYPE = 'a';

const log = new Logger();

interface CartData {
  items: any[];
}

interface CartExportItem {
  band_name: string;
  item_id: number;
  item_title: string;
  unit_price?: number;
  url: string;
  currency: string;
  item_type: 'a' | 't';
}

interface CartExportData {
  date: string;
  cart_id: string;
  tracks_export: CartExportItem[];
}

export async function initCart(port: chrome.runtime.Port): Promise<void> {
  log.info('cart init');

  let lastImportState: any = null;

  port.onMessage.addListener(async (msg: any) => {
    if (msg.cartImportState) {
      const state = msg.cartImportState;
      lastImportState = state;

      if (state.isProcessing) {
        const progress = `${state.processedCount}/${state.totalCount}`;
        const operation = state.operation === 'url_import' ? 'URLs' : 'cart items';
        const statusContent = `
          <div style="font-weight: bold; margin-bottom: 8px;">🛒 Importing ${operation}...</div>
          <div>Progress: ${progress}</div>
          ${
            state.errors.length > 0
              ? `<div style="color: #d32f2f; margin-top: 4px;">${state.errors.length} errors occurred</div>`
              : ''
          }
        `;
        updatePersistentNotification('cart-import-progress', statusContent);
      }
    }

    if (msg.cartAddRequest) {
      try {
        log.info(`Starting cart add for ${msg.cartAddRequest.item_title} (${msg.cartAddRequest.item_id})`);
        const result = await addAlbumToCart(
          msg.cartAddRequest.item_id,
          msg.cartAddRequest.unit_price,
          msg.cartAddRequest.item_type
        );
        log.info(
          `Cart add completed for ${msg.cartAddRequest.item_title}, status: ${result.status}, ok: ${result.ok}`
        );

        if (result.ok) {
          log.info(`Successfully added ${msg.cartAddRequest.item_title} to cart`);

          const cartItem = createShoppingCartItem({
            itemId: String(msg.cartAddRequest.item_id),
            itemName: msg.cartAddRequest.item_title,
            itemPrice: msg.cartAddRequest.unit_price,
            itemCurrency: msg.cartAddRequest.currency
          });

          const itemList = document.querySelector('#item_list');
          if (itemList) {
            itemList.append(cartItem);
          }
        } else {
          log.error(`Failed to add ${msg.cartAddRequest.item_title} to cart: HTTP ${result.status}`);
          showErrorMessage(`Failed to add "${msg.cartAddRequest.item_title}" to cart`);
        }
      } catch (error) {
        log.error(`Exception during cart add for ${msg.cartAddRequest.item_title}: ${error}`);
        showErrorMessage(`Failed to add "${msg.cartAddRequest.item_title}" to cart`);
      }
    }

    if (msg.cartImportComplete) {
      removePersistentNotification('cart-import-progress');
      showSuccessMessage(msg.cartImportComplete.message);
    }

    if (msg.cartItemError) {
      showErrorMessage(msg.cartItemError.message);
    }

    if (msg.cartImportError) {
      removePersistentNotification('cart-import-progress');
      showErrorMessage(`Import failed: ${msg.cartImportError.message}`);
    }
  });

  const importButton = createButton({
    className: 'buttonLink',
    innerText: 'import',
    buttonClicked: async () => {
      try {
        const fileContent = await loadTextFile();

        let importData: any;
        let importType: 'json' | 'urls';

        try {
          importData = JSON.parse(fileContent);
          if (!importData.tracks_export) {
            showErrorMessage('Invalid JSON format - missing tracks_export');
            return;
          }

          importType = 'json';
          if (importData.tracks_export.length === 0) {
            showErrorMessage('No items found in import file');
            return;
          }
        } catch {
          const urls = fileContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && (line.includes('bandcamp.com') || line.includes('.bandcamp.com')));

          if (urls.length === 0) {
            showErrorMessage('File contains no valid JSON data or Bandcamp URLs');
            return;
          }

          importData = urls;
          importType = 'urls';
        }

        const itemCount = importType === 'json' ? importData.tracks_export.length : importData.length;
        const itemType = importType === 'json' ? 'items' : 'URLs';

        showPersistentNotification({
          id: 'cart-import-progress',
          message: `Starting import of ${itemCount} ${itemType}...`,
          type: 'info'
        });

        if (importType === 'json') {
          port.postMessage({ cartImport: { items: importData.tracks_export } });
          return;
        }

        port.postMessage({ cartUrlImport: { urls: importData } });
      } catch (error) {
        showErrorMessage('Error loading file: ' + String(error));
        log.error('Error importing: ' + String(error));
      }
    }
  });

  const sidecartReveal = document.querySelector('#sidecartReveal');
  if (sidecartReveal) {
    sidecartReveal.prepend(importButton);
  }

  const exportCartButton = createButton({
    className: 'buttonLink',
    innerText: 'export',
    buttonClicked: async () => {
      const cartElement = document.querySelector('[data-cart]');
      const cartData = cartElement?.getAttribute('data-cart');
      if (!cartData) return;

      const { items }: CartData = JSON.parse(cartData);
      if (items.length < 1) {
        log.error('error trying to export cart with length of 0');
        return;
      }

      const cart_id = items[0].cart_id;
      const date = dateString();

      const cartItems = items.filter(item => item.item_type === 'a' || item.item_type === 't');
      const tracks_export: CartExportItem[] = [];

      for (const item of cartItems) {
        try {
          const tralbumDetails = await getTralbumDetails(item.item_id, item.item_type);
          const minimumPrice = tralbumDetails.price > 0.0 ? tralbumDetails.price : CURRENCY_MINIMUMS[item.currency];

          const exportItem: CartExportItem = {
            band_name: item.band_name,
            item_id: item.item_id,
            item_title: item.item_title,
            url: item.url,
            currency: item.currency,
            item_type: item.item_type
          };

          if (item.unit_price > minimumPrice) {
            exportItem.unit_price = item.unit_price;
          }

          tracks_export.push(exportItem);
        } catch (error) {
          log.error(`Error fetching details for item ${item.item_id}: ${error}`);
          const exportItem: CartExportItem = {
            band_name: item.band_name,
            item_id: item.item_id,
            item_title: item.item_title,
            unit_price: item.unit_price,
            url: item.url,
            currency: item.currency,
            item_type: item.item_type
          };
          tracks_export.push(exportItem);
        }
      }

      if (tracks_export.length < 1) return;

      const filename = `${date}_${cart_id}_bes_cart_export.json`;
      const exportData: CartExportData = { date, cart_id, tracks_export };
      const data = JSON.stringify(exportData, null, 2);
      downloadFile(filename, data);
    }
  });
  const sidecartReveal2 = document.querySelector('#sidecartReveal');
  if (sidecartReveal2) {
    sidecartReveal2.append(exportCartButton);
  }

  const cartRefreshButton = createButton({
    className: 'buttonLink',
    innerText: '⟳',
    buttonClicked: () => location.reload()
  });
  cartRefreshButton.style.display = 'none';
  const sidecartReveal3 = document.querySelector('#sidecartReveal');
  if (sidecartReveal3) {
    sidecartReveal3.append(cartRefreshButton);
  }

  const observer = new MutationObserver(() => {
    const item_list = document.querySelectorAll('#item_list .item');
    const cartDataElement = document.querySelector('[data-cart]');

    if (!cartDataElement) {
      return;
    }
    const actual_cart = JSON.parse(cartDataElement.getAttribute('data-cart')!).items;

    cartRefreshButton.style.display = item_list.length === actual_cart.length ? 'none' : 'block';

    exportCartButton.style.display = item_list.length === actual_cart.length ? 'block' : 'none';
  });

  const itemList = document.getElementById('item_list');
  if (itemList) {
    observer.observe(itemList, {
      childList: true
    });
  }

  try {
    const tralbumDetails = await getTralbumDetails(BES_SUPPORT_TRALBUM_ID, BES_SUPPORT_TRALBUM_TYPE);

    const { price, currency, id: tralbumId, title: itemTitle, is_purchasable, type } = tralbumDetails;

    if (!is_purchasable) return;

    const minimumPrice = price > 0.0 ? price : CURRENCY_MINIMUMS[currency];
    if (!minimumPrice) {
      log.error(`could not get minimum price for ${tralbumId}. Skipping adding to cart`);
      return;
    }

    const oneClick = createBesSupportButton(minimumPrice, currency, String(tralbumId), itemTitle, type, log);

    const besSupportText = document.createElement('div');
    besSupportText.innerText = 'Support BES';
    besSupportText.className = 'bes-support-text';

    const besSupport = document.createElement('div');
    besSupport.className = 'bes-support';
    besSupport.append(besSupportText);
    besSupport.append(oneClick);
    const sidecartSummary = document.querySelector('#sidecartSummary');
    if (sidecartSummary) {
      sidecartSummary.after(besSupport);
    }
  } catch (error) {
    log.error(error);
  }
}

export function createBesSupportButton(
  price: number,
  currency: string,
  tralbumId: string,
  itemTitle: string,
  type: string,
  log: Logger
): HTMLElement {
  const pair = createInputButtonPair({
    inputPrefix: '$',
    inputSuffix: currency,
    inputPlaceholder: price,
    buttonChildElement: createPlusSvgIcon() as HTMLElement,
    onButtonClick: value => {
      const numericValue = typeof value === 'string' ? parseFloat(value) : value;
      if (numericValue < price) {
        log.error('track price too low');
        return;
      }

      addAlbumToCart(tralbumId, numericValue, type).then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const cartItem = createShoppingCartItem({
          itemId: tralbumId,
          itemName: itemTitle,
          itemPrice: numericValue,
          itemCurrency: currency
        });

        const itemList = document.querySelector('#item_list');
        if (itemList) {
          itemList.append(cartItem);
        }
      });
    }
  });
  pair.classList.add('one-click-button-container');

  return pair;
}
