export function setPreviewed(id: string, port: chrome.runtime.Port): void {
  port.postMessage({ setTrue: id });
}
