import Logger from "../logger";

// Standalone message handler function (no longer needs binding)
export function processRequest(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): boolean {
  if (request.contentScriptQuery !== "renderBuffer") return false;

  const url = "https://t4.bcbits.com/stream/" + request.url;

  fetch(url)
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => {
      // Convert ArrayBuffer to Uint8Array, then to regular array to match Buffer.toJSON() format
      const uint8Array = new Uint8Array(arrayBuffer);
      const jsonResult = {
        type: 'Buffer',
        data: Array.from(uint8Array)
      };
      sendResponse(jsonResult);
    })
    .catch(error => {
      // Note: console.error is intentionally used here for debugging
      // eslint-disable-next-line no-console
      console.error(error);
    });

  return true;
}

// Main initialization function (replaces WaveformBackend class)
export async function initWaveformBackend(): Promise<void> {
  const log = new Logger();
  
  log.info("starting waveform backend.");
  chrome.runtime.onMessage.addListener(processRequest);
}

