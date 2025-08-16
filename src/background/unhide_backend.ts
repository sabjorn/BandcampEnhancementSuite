import Logger from "../logger.js";
import { getCollectionSummary, getHiddenItems, hideUnhide, type GetHiddenItemsResponse, type HiddenItem } from "../bclient.js";

const log = new Logger();

interface UnhideQueueItem {
  fan_id: number;
  item_id: number;
  item_type: "track" | "album";
  crumb: string | null;
  baseUrl: string | null;
}

interface UnhideState {
  isProcessing: boolean;
  queue: UnhideQueueItem[];
  processedCount: number;
  totalCount: number;
  errors: string[];
}

class RateLimitedQueue {
  private queue: UnhideQueueItem[] = [];
  private isProcessing = false;
  private delay: number;
  private port?: chrome.runtime.Port;
  private processedCount = 0;
  private totalCount = 0;
  private errors: string[] = [];

  constructor(delayMs: number = 2000, port?: chrome.runtime.Port) {
    this.delay = delayMs;
    this.port = port;
  }

  async addItems(items: UnhideQueueItem[]): Promise<void> {
    this.queue.push(...items);
    this.totalCount += items.length;
    log.info(`Added ${items.length} items to unhide queue. Total: ${this.queue.length}`);
    
    this.broadcastState();
    
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.broadcastState();

    log.info(`Starting to process unhide queue with ${this.queue.length} items`);

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      
      try {
        log.info(`Unhiding item ${item.item_id} (${item.item_type}) with crumb: ${item.crumb ? 'provided' : 'null'}`);
        
        const result = await hideUnhide("unhide", item.fan_id, item.item_type, item.item_id, item.crumb, item.baseUrl);
        
        if (result) {
          this.processedCount++;
          log.info(`Successfully unhid item ${item.item_id}`);
        } else {
          const errorMsg = `Failed to unhide item ${item.item_id} - API returned false`;
          this.errors.push(errorMsg);
          log.error(errorMsg);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const fullErrorMsg = `Error unhiding item ${item.item_id}: ${errorMsg}`;
        this.errors.push(fullErrorMsg);
        log.error(`Error unhiding item ${item.item_id}: ${error}`);
      }

      this.broadcastState();

      // Rate limiting delay
      if (this.queue.length > 0) {
        log.info(`Waiting ${this.delay}ms before next unhide request`);
        await new Promise(resolve => setTimeout(resolve, this.delay));
      }
    }

    this.isProcessing = false;
    log.info(`Finished processing unhide queue. Processed: ${this.processedCount}, Errors: ${this.errors.length}`);
    this.broadcastState();
    
    // Send completion message
    const completionMessage = this.errors.length > 0 
      ? `${this.processedCount} items unhidden with ${this.errors.length} errors`
      : `Successfully unhidden ${this.processedCount} items`;
    
    this.port?.postMessage({ unhideComplete: { message: completionMessage } });
  }

  private broadcastState(): void {
    const state: UnhideState = {
      isProcessing: this.isProcessing,
      queue: [...this.queue],
      processedCount: this.processedCount,
      totalCount: this.totalCount,
      errors: [...this.errors]
    };

    this.port?.postMessage({ unhideState: state });
  }

  getState(): UnhideState {
    return {
      isProcessing: this.isProcessing,
      queue: [...this.queue],
      processedCount: this.processedCount,
      totalCount: this.totalCount,
      errors: [...this.errors]
    };
  }
}

let unhideQueue: RateLimitedQueue;

export function connectionListenerCallback(
  port: chrome.runtime.Port, 
  portState: { port?: chrome.runtime.Port }
): void {
  log.info("unhide backend connection listener callback");
  
  if (port.name !== "bandcampenhancementsuite") {
    log.error(
      `Unexpected chrome.runtime.onConnect port name: ${port.name}`
    );
    return;
  }

  portState.port = port;
  unhideQueue = new RateLimitedQueue(2000, port); // 2 second delay
  
  portState.port.onMessage.addListener((msg: any) => 
    portListenerCallback(msg, portState)
  );
}

export async function portListenerCallback(
  msg: any, 
  portState: { port?: chrome.runtime.Port }
): Promise<void> {
  log.info("unhide backend port listener callback");

  if (msg.unhide) {
    await handleUnhideRequest(msg.unhide.crumb, portState.port);
  }

  if (msg.getUnhideState) {
    const state = unhideQueue?.getState();
    portState.port?.postMessage({ unhideState: state });
  }
}

async function handleUnhideRequest(crumb: string | null, port?: chrome.runtime.Port): Promise<void> {
  try {
    log.info("Starting unhide all process");
    
    const baseUrl = "https://bandcamp.com";
    log.info(`Using baseUrl: ${baseUrl}`);

    // Get collection summary to get fan_id
    log.info("Fetching collection summary...");
    let collectionSummary;
    try {
      collectionSummary = await getCollectionSummary(baseUrl);
      log.info(`Collection summary fetched successfully: ${JSON.stringify(collectionSummary)}`);
    } catch (error) {
      log.error(`Failed to fetch collection summary: ${error}`);
      throw new Error(`Failed to get collection summary: ${error}`);
    }

    const fan_id = collectionSummary.fan_id;
    log.info(`Got fan_id: ${fan_id}`);

    // Start with current unix timestamp token to get first batch
    // Token format: "unix_timestamp:item_id:type::"
    // For initial call, we use current timestamp with placeholder values
    const currentUnixTime = Math.floor(Date.now() / 1000);
    let older_than_token = `${currentUnixTime}:999999999:t::`;
    let hasMore = true;
    let batchCount = 0;
    const allHiddenItems: UnhideQueueItem[] = [];

    log.info(`Starting to fetch hidden items for fan_id: ${fan_id} with initial token: ${older_than_token}`);

    while (hasMore) {
      batchCount++;
      log.info(`Fetching hidden items batch ${batchCount} with token: "${older_than_token}"`);
      
      let hiddenItemsResponse: GetHiddenItemsResponse;
      try {
        hiddenItemsResponse = await getHiddenItems(fan_id, older_than_token, 20, baseUrl);
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
      const queueItems: UnhideQueueItem[] = hiddenItemsResponse.items.map((item: HiddenItem) => ({
        fan_id: fan_id,
        item_id: item.item_id,
        item_type: item.item_type as "track" | "album",
        crumb: crumb,
        baseUrl: baseUrl
      }));

      allHiddenItems.push(...queueItems);
      
      log.info(`Found ${queueItems.length} hidden items in batch ${batchCount}. Total so far: ${allHiddenItems.length}`);

      // Check if there are more items
      if (hiddenItemsResponse.items.length < 20 || !hiddenItemsResponse.last_token) {
        hasMore = false;
        log.info(`No more items to fetch. Completed ${batchCount} batches.`);
      } else {
        older_than_token = hiddenItemsResponse.last_token;
        log.info(`Will fetch next batch with token: "${older_than_token}"`);
      }
    }

    log.info(`Found total of ${allHiddenItems.length} hidden items to unhide`);

    if (allHiddenItems.length > 0) {
      await unhideQueue.addItems(allHiddenItems);
    } else {
      log.info("No hidden items found, sending completion message");
      port?.postMessage({ unhideComplete: { message: "No hidden items found" } });
    }

  } catch (error) {
    log.error(`Error in unhide process: ${error}`);
    const errorMessage = error instanceof Error ? error.message : String(error);
    port?.postMessage({ unhideError: { message: errorMessage } });
  }
}

export async function initUnhideBackend(): Promise<void> {
  const portState: { port?: chrome.runtime.Port } = {};
  
  log.info("initializing UnhideBackend");

  chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => 
    connectionListenerCallback(port, portState)
  );
}