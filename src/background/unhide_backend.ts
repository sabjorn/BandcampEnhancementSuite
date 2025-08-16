import Logger from "../logger.js";
import { getCollectionSummary, getHiddenItems, hideUnhide, type GetHiddenItemsResponse, type HiddenItem } from "../bclient.js";

const log = new Logger();

interface UnhideQueueItem {
  fan_id: number;
  item_id: number;
  item_type: "track" | "album";
  crumb: string | null;
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
        log.info(`Unhiding item ${item.item_id} (${item.item_type})`);
        
        const result = await hideUnhide("unhide", item.fan_id, item.item_type, item.item_id, item.crumb);
        
        if (result) {
          this.processedCount++;
          log.info(`Successfully unhid item ${item.item_id}`);
        } else {
          this.errors.push(`Failed to unhide item ${item.item_id}`);
          log.error(`Failed to unhide item ${item.item_id}`);
        }
      } catch (error) {
        this.errors.push(`Error unhiding item ${item.item_id}: ${error}`);
        log.error(`Error unhiding item ${item.item_id}:`, error);
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

    // Get collection summary to get fan_id
    const collectionSummary = await getCollectionSummary();
    const fan_id = collectionSummary.fan_id;

    log.info(`Got fan_id: ${fan_id}`);

    // Start with empty token to get first batch
    let older_than_token = "";
    let hasMore = true;
    const allHiddenItems: UnhideQueueItem[] = [];

    while (hasMore) {
      log.info(`Fetching hidden items with token: ${older_than_token}`);
      
      const hiddenItemsResponse: GetHiddenItemsResponse = await getHiddenItems(fan_id, older_than_token, 20);
      
      // Convert hidden items to queue items
      const queueItems: UnhideQueueItem[] = hiddenItemsResponse.items.map((item: HiddenItem) => ({
        fan_id: fan_id,
        item_id: item.item_id,
        item_type: item.item_type as "track" | "album",
        crumb: crumb
      }));

      allHiddenItems.push(...queueItems);
      
      log.info(`Found ${queueItems.length} hidden items in this batch`);

      // Check if there are more items
      if (hiddenItemsResponse.items.length < 20 || !hiddenItemsResponse.last_token) {
        hasMore = false;
      } else {
        older_than_token = hiddenItemsResponse.last_token;
      }
    }

    log.info(`Found total of ${allHiddenItems.length} hidden items to unhide`);

    if (allHiddenItems.length > 0) {
      await unhideQueue.addItems(allHiddenItems);
    } else {
      port?.postMessage({ unhideComplete: { message: "No hidden items found" } });
    }

  } catch (error) {
    log.error("Error in unhide process:", error);
    port?.postMessage({ unhideError: { message: `Error: ${error}` } });
  }
}

export async function initUnhideBackend(): Promise<void> {
  const portState: { port?: chrome.runtime.Port } = {};
  
  log.info("initializing UnhideBackend");

  chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => 
    connectionListenerCallback(port, portState)
  );
}