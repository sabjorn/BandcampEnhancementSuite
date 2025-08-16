import Logger from "../logger";
import { createButton } from "../components/buttons.js";

const log = new Logger();

export async function initHideUnhide(): Promise<void> {
  log.info("hideUnhide init");

  let port: chrome.runtime.Port;

  try {
    port = chrome.runtime.connect(null, { name: "bandcampenhancementsuite" });

    port.onMessage.addListener(msg => {
      if (msg.unhideState) {
        log.info(`Unhide state update: ${JSON.stringify(msg.unhideState)}`);
        updateUnhideButtonState(msg.unhideState);
      }
      if (msg.unhideComplete) {
        log.info(`Unhide completed: ${JSON.stringify(msg.unhideComplete)}`);
        showCompletionMessage(msg.unhideComplete.message);
      }
      if (msg.unhideError) {
        log.error(`Unhide error: ${JSON.stringify(msg.unhideError)}`);
        showErrorMessage(msg.unhideError.message);
      }
    });
  } catch (e: any) {
    log.error(`Failed to connect to background script: ${e}`);
    return;
  }

  const hideButton = createButton({
    className: "follow-unfollow bes-hideUnhide",
    innerText: "hide",
    buttonClicked: () => {
      log.info("hide button clicked");
      // TODO: Implement hide functionality
    }
  });

  const unhideButton = createButton({
    className: "follow-unfollow bes-hideUnhide",
    innerText: "unhide all",
    buttonClicked: () => {
      log.info("unhide all button clicked");
      startUnhideProcess(port);
    }
  });

  const collectionItemsDiv = document.querySelector("div.collection-items");
  if (!collectionItemsDiv) {
        return;
  }

  collectionItemsDiv.insertBefore(unhideButton, collectionItemsDiv.firstChild);
  collectionItemsDiv.insertBefore(hideButton, collectionItemsDiv.firstChild);
}

function startUnhideProcess(port: chrome.runtime.Port): void {
  const crumb = null;
  
  log.info("Starting unhide all process");
  port.postMessage({ unhide: { crumb } });
}

function updateUnhideButtonState(state: any): void {
  const unhideButton = document.querySelector(".bes-hideUnhide[innerText='unhide all']") as HTMLButtonElement;
  
  if (!unhideButton) return;

  if (state.isProcessing) {
    unhideButton.disabled = true;
    unhideButton.innerText = `Unhiding... (${state.processedCount}/${state.totalCount})`;
  } else {
    unhideButton.disabled = false;
    unhideButton.innerText = "unhide all";
  }
}

function showCompletionMessage(message: string): void {
  log.info(`Unhide process completed: ${message}`);
  
  // Create a temporary notification
  const notification = document.createElement("div");
  notification.className = "bes-notification bes-success";
  notification.textContent = `Unhide completed: ${message}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 10000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

function showErrorMessage(message: string): void {
  log.error(`Unhide process error: ${message}`);
  
  // Create a temporary error notification
  const notification = document.createElement("div");
  notification.className = "bes-notification bes-error";
  notification.textContent = `Unhide error: ${message}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #f44336;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 10000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 8000);
}
