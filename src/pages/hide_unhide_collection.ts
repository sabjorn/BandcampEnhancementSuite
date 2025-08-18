import Logger from "../logger";
import { createButton } from "../components/buttons.js";
import { showSuccessMessage, showErrorMessage, showPersistentNotification, updatePersistentNotification, removePersistentNotification } from "../components/notifications";

const log = new Logger();

export async function initHideUnhide(port: chrome.runtime.Port): Promise<void> {
  log.info("hideUnhide init");

  port.onMessage.addListener(msg => {
      if (msg.unhideState) {
        log.info(`Unhide state update: ${JSON.stringify(msg.unhideState)}`);
        updateUnhideButtonState(msg.unhideState);
      }
      if (msg.unhideComplete) {
        log.info(`Unhide completed: ${JSON.stringify(msg.unhideComplete)}`);
        showSuccessMessage(`✅ Unhide completed: ${msg.unhideComplete.message}`, 8000);
        // Remove status notification when complete
        removePersistentNotification(HIDE_UNHIDE_STATUS_ID);
      }
      if (msg.unhideError) {
        log.error(`Unhide error: ${JSON.stringify(msg.unhideError)}`);
        showErrorMessage(`Unhide error: ${msg.unhideError.message}`);
      }
      if (msg.hideState) {
        log.info(`Hide state update: ${JSON.stringify(msg.hideState)}`);
        updateHideButtonState(msg.hideState);
      }
      if (msg.hideComplete) {
        log.info(`Hide completed: ${JSON.stringify(msg.hideComplete)}`);
        showSuccessMessage(`✅ Hide completed: ${msg.hideComplete.message}`, 8000);
        // Remove status notification when complete
        removePersistentNotification(HIDE_UNHIDE_STATUS_ID);
      }
      if (msg.hideError) {
        log.error(`Hide error: ${JSON.stringify(msg.hideError)}`);
        showErrorMessage(`Hide error: ${msg.hideError.message}`);
      }
    });

  const hideButton = createButton({
    className: "follow-unfollow bes-hide-unhide",
    innerText: "hide all",
    buttonClicked: () => {
      log.info("hide all button clicked");
      
      // Immediately disable both buttons and show initial notification
      hideButton.disable();
      const unhideButton = document.getElementById("bes-unhide-button") as HTMLAnchorElement & { disable: () => void; enable: () => void };
      if (unhideButton) unhideButton.disable();
      showPersistentNotification({
        id: HIDE_UNHIDE_STATUS_ID,
        message: '<div style="font-weight: bold;">🔄 Hide process is beginning...</div>',
        type: 'status'
      });
      
      const crumbs = JSON.parse(document.getElementById('js-crumbs-data').getAttribute('data-crumbs'));
      const crumb = crumbs['api/collectionowner/1/hide_unhide_item'];
      port.postMessage({ hide: { crumb } });
    }
  });
  hideButton.id = "bes-hide-button";

  const unhideButton = createButton({
    className: "follow-unfollow bes-hide-unhide",
    innerText: "unhide all",
    buttonClicked: () => {
      log.info("unhide all button clicked");
      
      // Immediately disable both buttons and show initial notification
      unhideButton.disable();
      const hideButton = document.getElementById("bes-hide-button") as HTMLAnchorElement & { disable: () => void; enable: () => void };
      if (hideButton) hideButton.disable();
      showPersistentNotification({
        id: HIDE_UNHIDE_STATUS_ID,
        message: '<div style="font-weight: bold;">🔄 Unhide process is beginning...</div>',
        type: 'status'
      });
      
      const crumbs = JSON.parse(document.getElementById('js-crumbs-data').getAttribute('data-crumbs'));
      const crumb = crumbs['api/collectionowner/1/hide_unhide_item'];
      port.postMessage({ unhide: { crumb } });
    }
  });
  unhideButton.id = "bes-unhide-button";

  const pageDataElement = document.getElementById('pagedata');
  if (pageDataElement && pageDataElement.getAttribute('data-blob')) {
    const { hidden_data: { item_count }, collection_count } = JSON.parse(pageDataElement.getAttribute('data-blob'));
    
    if (collection_count === 0) {
      hideButton.disable();
    }
    
    if (item_count === 0) {
      unhideButton.disable();
    }
  }

  const collectionSearchDiv = document.getElementById("collection-search");
  if (!collectionSearchDiv) {
        return;
  }

  // Insert buttons inside the collection-search div (which is a flexbox)
  collectionSearchDiv.appendChild(hideButton);
  collectionSearchDiv.appendChild(unhideButton);
}

const HIDE_UNHIDE_STATUS_ID = 'bes-hide-unhide-status-notification';

function updateUnhideButtonState(state: any): void {
  const unhideButton = document.getElementById("bes-unhide-button") as HTMLAnchorElement & { disable: () => void; enable: () => void };
  const hideButton = document.getElementById("bes-hide-button") as HTMLAnchorElement & { disable: () => void; enable: () => void };
  
  if (!unhideButton) return;

  if (!state.isProcessing) {
    // When unhide completes, enable only the hide button (opposite action)
    if (hideButton) hideButton.enable();
    removePersistentNotification(HIDE_UNHIDE_STATUS_ID);
        return;
  }
  // During processing, keep both buttons disabled
  unhideButton.disable();
  if (hideButton) hideButton.disable();
  const statusContent = `
    <div style="font-weight: bold; margin-bottom: 8px;">🔄 Unhiding your collection items...</div>
    <div>Progress: ${state.processedCount}/${state.totalCount}</div>
    <div style="color: #d32f2f; font-weight: bold; margin-top: 8px;">⚠️ Do not refresh or navigate away from this page</div>
    ${state.errors.length > 0 ? `<div style="color: #d32f2f; margin-top: 4px;">${state.errors.length} errors occurred</div>` : ''}
  `;
  
  if (document.getElementById(HIDE_UNHIDE_STATUS_ID)) {
    updatePersistentNotification(HIDE_UNHIDE_STATUS_ID, statusContent);
    return;
  } 

  showPersistentNotification({
    id: HIDE_UNHIDE_STATUS_ID,
    message: statusContent,
    type: 'status'
  });
}

function updateHideButtonState(state: any): void {
  const hideButton = document.getElementById("bes-hide-button") as HTMLAnchorElement & { disable: () => void; enable: () => void };
  const unhideButton = document.getElementById("bes-unhide-button") as HTMLAnchorElement & { disable: () => void; enable: () => void };
  
  if (!hideButton) return;

  if (!state.isProcessing) {
    // When hide completes, enable only the unhide button (opposite action)
    if (unhideButton) unhideButton.enable();
    removePersistentNotification(HIDE_UNHIDE_STATUS_ID);
        return;
  }
  // During processing, keep both buttons disabled
  hideButton.disable();
  if (unhideButton) unhideButton.disable();
  
  const statusContent = `
    <div style="font-weight: bold; margin-bottom: 8px;">🔄 Hiding your collection items...</div>
    <div>Progress: ${state.processedCount}/${state.totalCount}</div>
    <div style="color: #d32f2f; font-weight: bold; margin-top: 8px;">⚠️ Do not refresh or navigate away from this page</div>
    ${state.errors.length > 0 ? `<div style="color: #d32f2f; margin-top: 4px;">${state.errors.length} errors occurred</div>` : ''}
  `;
  
  if (document.getElementById(HIDE_UNHIDE_STATUS_ID)) {
    updatePersistentNotification(HIDE_UNHIDE_STATUS_ID, statusContent);
    return;
  } 

  showPersistentNotification({
    id: HIDE_UNHIDE_STATUS_ID,
    message: statusContent,
    type: 'status'
  });
}

