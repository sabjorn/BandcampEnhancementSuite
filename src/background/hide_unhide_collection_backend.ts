import Logger from "../logger.js";
import { getCollectionSummary, getHiddenItemsRateLimited, getCollectionItemsRateLimited, hideUnhideRateLimited, type GetHiddenItemsResponse, type HiddenItem, type GetCollectionItemsResponse, type CollectionItem } from "../bclient.js";

const log = new Logger();

interface HideUnhideItem {
  fan_id: number;
  item_id: number;
  item_type: "track" | "album";
  action: "hide" | "unhide";
  crumb: string | null;
  baseUrl: string | null;
}

interface HideUnhideState {
  isProcessing: boolean;
  processedCount: number;
  totalCount: number;
  errors: string[];
  action: "hide" | "unhide";
}

class ProgressTracker {
  private isProcessing = false;
  private processedCount = 0;
  private totalCount = 0;
  private errors: string[] = [];
  private currentAction: "hide" | "unhide" = "unhide";
  private port?: chrome.runtime.Port;

  constructor(port?: chrome.runtime.Port) {
    this.port = port;
  }

  async processItems(items: HideUnhideItem[], action: "hide" | "unhide"): Promise<void> {
    this.currentAction = action;
    
    if (items.length === 0) {
      const messageKey = this.currentAction === "hide" ? "hideComplete" : "unhideComplete";
      this.port?.postMessage({ [messageKey]: { message: `No ${this.currentAction === "hide" ? "visible" : "hidden"} items found` } });
      return;
    }

    this.isProcessing = true;
    this.processedCount = 0;
    this.totalCount = items.length;
    this.errors = [];

    log.info(`Starting to process ${this.currentAction} operation with ${items.length} items`);
    this.broadcastState();

    // Process all items concurrently - rate limiting handled by hideUnhideRateLimited
    const promises = items.map(async (item) => {
      try {
        log.info(`${item.action}ing item ${item.item_id} (${item.item_type})`);
        
        const result = await hideUnhideRateLimited(item.action, item.fan_id, item.item_type, item.item_id, item.crumb, item.baseUrl);
        
        if (result) {
          this.processedCount++;
          log.info(`Successfully ${item.action}d item ${item.item_id}`);
        } else {
          const errorMsg = `Failed to ${item.action} item ${item.item_id} - API returned false`;
          this.errors.push(errorMsg);
          log.error(errorMsg);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const fullErrorMsg = `Error ${item.action}ing item ${item.item_id}: ${errorMsg}`;
        this.errors.push(fullErrorMsg);
        log.error(`Error ${item.action}ing item ${item.item_id}: ${error}`);
      }

      // Broadcast progress after each completion
      this.broadcastState();
    });

    // Wait for all operations to complete
    await Promise.all(promises);

    this.isProcessing = false;
    log.info(`Finished processing ${this.currentAction} operation. Processed: ${this.processedCount}, Errors: ${this.errors.length}`);
    this.broadcastState();
    
    // Send completion message
    const actionPastTense = this.currentAction === "hide" ? "hidden" : "unhidden";
    const completionMessage = this.errors.length > 0 
      ? `${this.processedCount} items ${actionPastTense} with ${this.errors.length} errors`
      : `Successfully ${actionPastTense} ${this.processedCount} items`;
    
    const messageKey = this.currentAction === "hide" ? "hideComplete" : "unhideComplete";
    this.port?.postMessage({ [messageKey]: { message: completionMessage } });
  }

  private broadcastState(): void {
    const state: HideUnhideState = {
      isProcessing: this.isProcessing,
      processedCount: this.processedCount,
      totalCount: this.totalCount,
      errors: [...this.errors],
      action: this.currentAction
    };

    const messageKey = this.currentAction === "hide" ? "hideState" : "unhideState";
    this.port?.postMessage({ [messageKey]: state });
  }

  getState(): HideUnhideState {
    return {
      isProcessing: this.isProcessing,
      processedCount: this.processedCount,
      totalCount: this.totalCount,
      errors: [...this.errors],
      action: this.currentAction
    };
  }
}

let progressTracker: ProgressTracker;

export function connectionListenerCallback(
  port: chrome.runtime.Port, 
  portState: { port?: chrome.runtime.Port }
): void {
  log.info("unhide backend connection listener callback");
  
  if (port.name !== "bes") {
    log.error(
      `Unexpected chrome.runtime.onConnect port name: ${port.name}`
    );
    return;
  }

  portState.port = port;
  progressTracker = new ProgressTracker(port);
  
  portState.port.onMessage.addListener((msg: any) => 
    portListenerCallback(msg, portState)
  );
}

export async function portListenerCallback(
  msg: any, 
  portState: { port?: chrome.runtime.Port }
): Promise<void> {
  log.info("hide/unhide backend port listener callback");

  if (msg.unhide) {
    await handleUnhideRequest(msg.unhide.crumb, portState.port);
  }

  if (msg.hide) {
    await handleHideRequest(msg.hide.crumb, portState.port);
  }

  if (msg.getUnhideState) {
    const state = progressTracker?.getState();
    const messageKey = state?.action === "hide" ? "hideState" : "unhideState";
    portState.port?.postMessage({ [messageKey]: state });
  }
}

async function handleUnhideRequest(crumb: string | null, port?: chrome.runtime.Port): Promise<void> {
  try {
    log.info("Starting unhide all process");
    
    const baseUrl = "https://bandcamp.com";
    log.info(`Using baseUrl: ${baseUrl}`);

    // Get collection summary to get fan_id
    log.info("Fetching collection summary...");
    const collectionSummary = await (async () => {
      try {
        const result = await getCollectionSummary(baseUrl);
        log.info(`Collection summary fetched successfully: ${JSON.stringify(result)}`);
        return result;
      } catch (error) {
        log.error(`Failed to fetch collection summary: ${error}`);
        throw new Error(`Failed to get collection summary: ${error}`);
      }
    })();

    const fan_id = collectionSummary.fan_id;
    log.info(`Got fan_id: ${fan_id}`);

    // Start with current unix timestamp token to get first batch
    // Token format: "unix_timestamp:item_id:type::"
    // For initial call, we use current timestamp with placeholder values
    const currentUnixTime = Math.floor(Date.now() / 1000);
    let older_than_token = `${currentUnixTime}:999999999:t::`;
    let hasMore = true;
    let batchCount = 0;
    const allHiddenItems: HideUnhideItem[] = [];

    log.info(`Starting to fetch hidden items for fan_id: ${fan_id} with initial token: ${older_than_token}`);

    while (hasMore) {
      batchCount++;
      log.info(`Fetching hidden items batch ${batchCount} with token: "${older_than_token}"`);
      
      let hiddenItemsResponse: GetHiddenItemsResponse;
      try {
        hiddenItemsResponse = await getHiddenItemsRateLimited(fan_id, older_than_token, 100, baseUrl);
        log.info(`Hidden items batch ${batchCount} fetched successfully. Response: ${JSON.stringify(hiddenItemsResponse)}`);
        
        // Validate response structure
        if (!hiddenItemsResponse || typeof hiddenItemsResponse !== 'object') {
          throw new Error(`Invalid response structure: ${JSON.stringify(hiddenItemsResponse)}`);
        }
        
        if (!Array.isArray(hiddenItemsResponse.items)) {
          log.error(`hiddenItemsResponse.items is not an array: ${JSON.stringify(hiddenItemsResponse.items)}`);
          throw new Error(`Response items field is not an array: ${typeof hiddenItemsResponse.items}`);
        }
        
        log.info(`Found ${hiddenItemsResponse.items.length} items in batch ${batchCount}`);
      } catch (error) {
        log.error(`Failed to fetch hidden items batch ${batchCount}: ${error}`);
        throw new Error(`Failed to fetch hidden items: ${error}`);
      }
      
      // Convert hidden items to queue items
      const queueItems: HideUnhideItem[] = hiddenItemsResponse.items.map((item: HiddenItem) => ({
        fan_id: fan_id,
        item_id: item.item_id,
        item_type: item.item_type as "track" | "album",
        action: "unhide",
        crumb: crumb,
        baseUrl: baseUrl
      }));

      allHiddenItems.push(...queueItems);
      
      log.info(`Found ${queueItems.length} hidden items in batch ${batchCount}. Total so far: ${allHiddenItems.length}`);

      // Check if there are more items
      if (hiddenItemsResponse.items.length < 100 || !hiddenItemsResponse.last_token) {
        hasMore = false;
        log.info(`No more items to fetch. Completed ${batchCount} batches.`);
      } else {
        older_than_token = hiddenItemsResponse.last_token;
        log.info(`Will fetch next batch with token: "${older_than_token}"`);
      }
    }

    log.info(`Found total of ${allHiddenItems.length} hidden items to unhide`);

    // Process all items using the progress tracker
    await progressTracker.processItems(allHiddenItems, "unhide");

  } catch (error) {
    log.error(`Error in unhide process: ${error}`);
    const errorMessage = error instanceof Error ? error.message : String(error);
    port?.postMessage({ unhideError: { message: errorMessage } });
  }
}

async function handleHideRequest(crumb: string | null, port?: chrome.runtime.Port): Promise<void> {
  try {
    log.info("Starting hide all process");
    
    const baseUrl = "https://bandcamp.com";
    log.info(`Using baseUrl: ${baseUrl}`);

    // Get collection summary to get fan_id
    log.info("Fetching collection summary...");
    const collectionSummary = await (async () => {
      try {
        const result = await getCollectionSummary(baseUrl);
        log.info(`Collection summary fetched successfully: ${JSON.stringify(result)}`);
        return result;
      } catch (error) {
        log.error(`Failed to fetch collection summary: ${error}`);
        throw new Error(`Failed to get collection summary: ${error}`);
      }
    })();

    const fan_id = collectionSummary.fan_id;
    log.info(`Got fan_id: ${fan_id}`);

    // Start with current unix timestamp token to get first batch
    const currentUnixTime = Math.floor(Date.now() / 1000);
    let older_than_token = `${currentUnixTime}:999999999:t::`;
    let hasMore = true;
    let batchCount = 0;
    const allCollectionItems: HideUnhideItem[] = [];

    log.info(`Starting to fetch collection items for fan_id: ${fan_id} with initial token: ${older_than_token}`);

    while (hasMore) {
      batchCount++;
      log.info(`Fetching collection items batch ${batchCount} with token: "${older_than_token}"`);
      
      let collectionItemsResponse: GetCollectionItemsResponse;
      try {
        collectionItemsResponse = await getCollectionItemsRateLimited(fan_id, older_than_token, 100, baseUrl);
        log.info(`Collection items batch ${batchCount} fetched successfully. Found ${collectionItemsResponse.items.length} items`);
        
        // Validate response structure
        if (!collectionItemsResponse || typeof collectionItemsResponse !== 'object') {
          throw new Error(`Invalid response structure: ${JSON.stringify(collectionItemsResponse)}`);
        }
        
        if (!Array.isArray(collectionItemsResponse.items)) {
          log.error(`collectionItemsResponse.items is not an array: ${JSON.stringify(collectionItemsResponse.items)}`);
          throw new Error(`Response items field is not an array: ${typeof collectionItemsResponse.items}`);
        }
        
        log.info(`Found ${collectionItemsResponse.items.length} items in batch ${batchCount}`);
      } catch (error) {
        log.error(`Failed to fetch collection items batch ${batchCount}: ${error}`);
        throw new Error(`Failed to fetch collection items: ${error}`);
      }
      
      // Convert collection items to queue items (only non-hidden items)
      const queueItems: HideUnhideItem[] = collectionItemsResponse.items
        .filter((item: CollectionItem) => item.hidden === null) // Only include visible items
        .map((item: CollectionItem) => ({
          fan_id: fan_id,
          item_id: item.item_id,
          item_type: item.item_type as "track" | "album",
          action: "hide",
          crumb: crumb,
          baseUrl: baseUrl
        }));

      allCollectionItems.push(...queueItems);
      
      log.info(`Found ${queueItems.length} visible items in batch ${batchCount}. Total so far: ${allCollectionItems.length}`);

      // Check if there are more items
      if (!collectionItemsResponse.more_available || !collectionItemsResponse.last_token) {
        hasMore = false;
        log.info(`No more items to fetch. Completed ${batchCount} batches.`);
      } else {
        older_than_token = collectionItemsResponse.last_token;
        log.info(`Will fetch next batch with token: "${older_than_token}"`);
      }
    }

    log.info(`Found total of ${allCollectionItems.length} visible items to hide`);

    // Process all items using the progress tracker
    await progressTracker.processItems(allCollectionItems, "hide");

  } catch (error) {
    log.error(`Error in hide process: ${error}`);
    const errorMessage = error instanceof Error ? error.message : String(error);
    port?.postMessage({ hideError: { message: errorMessage } });
  }
}

export async function initHideUnhideCollectionBackend(): Promise<void> {
  const portState: { port?: chrome.runtime.Port } = {};
  
  log.info("initializing UnhideBackend");

  chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => 
    connectionListenerCallback(port, portState)
  );
}