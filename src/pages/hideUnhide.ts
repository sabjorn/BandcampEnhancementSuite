import Logger from "../logger";
import { createButton } from "../components/buttons.js";
import { showSuccessMessage, showErrorMessage, showPersistentNotification, updatePersistentNotification, removePersistentNotification } from "../components/notifications";

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
        showSuccessMessage(`✅ Unhide completed: ${msg.unhideComplete.message}`, 8000);
        // Remove status notification when complete
        removePersistentNotification(UNHIDE_STATUS_ID);
      }
      if (msg.unhideError) {
        log.error(`Unhide error: ${JSON.stringify(msg.unhideError)}`);
        showErrorMessage(`Unhide error: ${msg.unhideError.message}`);
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
  hideButton.id = "bes-hide-button";

  const unhideButton = createButton({
    className: "follow-unfollow bes-hideUnhide",
    innerText: "unhide all",
    buttonClicked: () => {
      log.info("unhide all button clicked");
      const crumbs = JSON.parse(document.getElementById('js-crumbs-data').getAttribute('data-crumbs'));
      const crumb = crumbs['api/collectionowner/1/hide_unhide_item'];
      port.postMessage({ unhide: { crumb } });
    }
  });
  unhideButton.id = "bes-unhide-button";

  const pageDataElement = document.getElementById('pagedata');
  if (pageDataElement && pageDataElement.getAttribute('data-blob')) {
    const { hidden_data: { item_count }, collection_count } = JSON.parse(pageDataElement.getAttribute('data-blob'));
    
    if (item_count === collection_count) {
      hideButton.style.opacity = '0.5';
      hideButton.style.pointerEvents = 'none';
      hideButton.setAttribute('disabled', 'true');
    }
    
    if (item_count === 0) {
      unhideButton.style.opacity = '0.5';
      unhideButton.style.pointerEvents = 'none';
      unhideButton.setAttribute('disabled', 'true');
    }
  }

  const collectionItemsDiv = document.querySelector("div.collection-items");
  if (!collectionItemsDiv) {
        return;
  }

  collectionItemsDiv.insertBefore(unhideButton, collectionItemsDiv.firstChild);
  collectionItemsDiv.insertBefore(hideButton, collectionItemsDiv.firstChild);
}

const UNHIDE_STATUS_ID = 'bes-unhide-status-notification';

function updateUnhideButtonState(state: any): void {
  const unhideButton = document.getElementById("bes-unhide-button") as HTMLButtonElement;
  
  if (!unhideButton) return;

  if (!state.isProcessing) {
    unhideButton.disabled = false;
    removePersistentNotification(UNHIDE_STATUS_ID);
        return;
  }
  unhideButton.disabled = true;
  
  const remaining = state.totalCount - state.processedCount;
  const statusContent = `
    <div style="font-weight: bold; margin-bottom: 8px;">🔄 Unhiding your collection items...</div>
    <div>Progress: ${state.processedCount} completed, ${remaining} remaining</div>
    <div style="color: #d32f2f; font-weight: bold; margin-top: 8px;">⚠️ Do not refresh or navigate away from this page</div>
    ${state.errors.length > 0 ? `<div style="color: #d32f2f; margin-top: 4px;">${state.errors.length} errors occurred</div>` : ''}
  `;
  
  if (document.getElementById(UNHIDE_STATUS_ID)) {
    updatePersistentNotification(UNHIDE_STATUS_ID, statusContent);
    return;
  } 

  showPersistentNotification({
    id: UNHIDE_STATUS_ID,
    message: statusContent,
    type: 'status'
  });
}

