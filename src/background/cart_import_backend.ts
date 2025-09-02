import Logger from '../logger.js';
import { getTralbumDetails, getTralbumDetailsFromPage, CURRENCY_MINIMUMS } from '../bclient.js';

const BASE_URL = 'http://bandcamp.com';

const log = new Logger();

interface CartImportItem {
  item_id: number;
  item_type: 'a' | 't';
  item_title: string;
  band_name: string;
  currency: string;
  url: string;
  unit_price?: number;
}

type ImportOperation = 'import' | 'url_import';

interface CartImportState {
  isProcessing: boolean;
  processedCount: number;
  totalCount: number;
  errors: string[];
  operation: ImportOperation;
}

class CartImportTracker {
  private isProcessing = false;
  private processedCount = 0;
  private totalCount = 0;
  private errors: string[] = [];
  private currentOperation: ImportOperation = 'import';
  private port?: chrome.runtime.Port;

  constructor(port?: chrome.runtime.Port) {
    this.port = port;
  }

  async processItems(items: (CartImportItem | string)[]): Promise<void> {
    if (items.length === 0) {
      this.port?.postMessage({
        cartImportComplete: { message: 'No items found to import' }
      });
      return;
    }

    const operation: ImportOperation = typeof items[0] === 'string' ? 'url_import' : 'import';
    this.currentOperation = operation;

    this.isProcessing = true;
    this.processedCount = 0;
    this.totalCount = items.length;
    this.errors = [];

    log.info(`Starting ${operation} operation with ${items.length} items`);
    this.broadcastState();

    for (const originalItem of items) {
      try {
        if (typeof originalItem !== 'string' && originalItem.unit_price !== undefined) {
          log.info(
            `Using existing price ${originalItem.unit_price} for item ${originalItem.item_id} (${originalItem.item_type})`
          );
          this.processedCount += 1;

          this.port?.postMessage({
            cartAddRequest: {
              item_id: originalItem.item_id,
              item_type: originalItem.item_type,
              item_title: originalItem.item_title,
              band_name: originalItem.band_name,
              unit_price: originalItem.unit_price,
              currency: originalItem.currency,
              url: originalItem.url
            }
          });

          this.broadcastState();
          continue;
        }

        const item = await (async (): Promise<CartImportItem> => {
          if (typeof originalItem !== 'string') {
            return originalItem;
          }

          log.info(`Extracting info from URL: ${originalItem}`);
          const pageInfo = await getTralbumDetailsFromPage(originalItem);
          return {
            item_id: pageInfo.id,
            item_type: pageInfo.type as 'a' | 't',
            item_title: pageInfo.title,
            band_name: pageInfo.tralbum_artist,
            currency: pageInfo.currency,
            url: pageInfo.bandcamp_url
          };
        })();

        log.info(`Fetching full details for item ${item.item_id} (${item.item_type})`);
        const apiDetails = await getTralbumDetails(item.item_id, item.item_type, BASE_URL);

        if (!apiDetails.is_purchasable) {
          throw new Error(`Item "${item.item_title}" is not purchasable`);
        }

        const finalPrice = apiDetails.price > 0.0 ? apiDetails.price : CURRENCY_MINIMUMS[item.currency];

        const tralbumInfo = {
          id: item.item_id,
          type: item.item_type,
          title: item.item_title,
          tralbum_artist: item.band_name,
          currency: item.currency,
          price: finalPrice,
          bandcamp_url: item.url
        };
        this.processedCount += 1;

        log.info(`Sending cart add request for item ${tralbumInfo.id} with price ${tralbumInfo.price}`);
        this.port?.postMessage({
          cartAddRequest: {
            item_id: tralbumInfo.id,
            item_type: tralbumInfo.type,
            item_title: tralbumInfo.title,
            band_name: tralbumInfo.tralbum_artist,
            unit_price: tralbumInfo.price,
            currency: tralbumInfo.currency,
            url: tralbumInfo.bandcamp_url
          }
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const itemId = typeof originalItem === 'string' ? originalItem : originalItem.item_id;
        const itemTitle = typeof originalItem === 'string' ? originalItem : originalItem.item_title;
        const fullErrorMsg = `Error processing ${
          typeof originalItem === 'string' ? 'URL' : 'item'
        } ${itemId}: ${errorMsg}`;
        this.errors.push(fullErrorMsg);
        log.error(fullErrorMsg);

        this.port?.postMessage({
          cartItemError: {
            message: `Failed to add "${itemTitle}" to cart`
          }
        });
      }

      this.broadcastState();
    }

    this.isProcessing = false;
    this.processedCount = items.length;

    log.info(`Completed ${operation} operation. Sent ${items.length} items to frontend.`);
    this.broadcastState();

    const successCount = items.length - this.errors.length;
    const failureCount = this.errors.length;

    const completionMessage = (() => {
      if (failureCount === 0) {
        return `Successfully added ${successCount} items to cart`;
      }
      if (successCount === 0) {
        return `${failureCount} items could not be added`;
      }
      return `Successfully added ${successCount} items to cart. ${failureCount} items could not be added`;
    })();

    this.port?.postMessage({ cartImportComplete: { message: completionMessage } });
  }

  private broadcastState(): void {
    const state: CartImportState = {
      isProcessing: this.isProcessing,
      processedCount: this.processedCount,
      totalCount: this.totalCount,
      errors: [...this.errors],
      operation: this.currentOperation
    };

    this.port?.postMessage({ cartImportState: state });
  }

  getState(): CartImportState {
    return {
      isProcessing: this.isProcessing,
      processedCount: this.processedCount,
      totalCount: this.totalCount,
      errors: [...this.errors],
      operation: this.currentOperation
    };
  }
}

let importTracker: CartImportTracker;

export function connectionListenerCallback(
  port: chrome.runtime.Port,
  portState: { port?: chrome.runtime.Port }
): void {
  log.info('cart import backend connection listener callback');

  if (port.name !== 'bes') {
    log.error(`Unexpected chrome.runtime.onConnect port name: ${port.name}`);
    return;
  }

  portState.port = port;
  importTracker = new CartImportTracker(port);

  portState.port.onMessage.addListener((msg: any) => portListenerCallback(msg, portState));
}

export async function portListenerCallback(msg: any, portState: { port?: chrome.runtime.Port }): Promise<void> {
  log.info('cart import backend port listener callback');

  if (msg.cartImport) {
    try {
      log.info('Starting cart import process');
      await importTracker.processItems(msg.cartImport.items);
    } catch (error) {
      log.error(`Error in cart import process: ${error}`);
      const errorMessage = error instanceof Error ? error.message : String(error);
      portState.port?.postMessage({ cartImportError: { message: errorMessage } });
    }
  }

  if (msg.cartUrlImport) {
    try {
      log.info('Starting cart URL import process');
      await importTracker.processItems(msg.cartUrlImport.urls);
    } catch (error) {
      log.error(`Error in cart URL import process: ${error}`);
      const errorMessage = error instanceof Error ? error.message : String(error);
      portState.port?.postMessage({ cartImportError: { message: errorMessage } });
    }
  }

  if (msg.getCartImportState) {
    const state = importTracker?.getState();
    portState.port?.postMessage({ cartImportState: state });
  }
}

export async function initCartImportBackend(): Promise<void> {
  const portState: { port?: chrome.runtime.Port } = {};

  log.info('initializing CartImportBackend');

  chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => connectionListenerCallback(port, portState));
}
