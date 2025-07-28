import Logger from "./logger";

// Standalone callback functions (no longer need binding)
export function setHistory(id: string, state: boolean): void {
  // CSS.escape() is required for integer-only CSS IDs
  const historybox = document.querySelector(`#${CSS.escape(id)} .historybox`);
  if (historybox) {
    historybox.classList.add("follow-unfollow");

    if (state) {
      historybox.classList.add("following");
    } else {
      historybox.classList.remove("following");
    }
  }
}

export function setPreviewed(id: string, port: chrome.runtime.Port): void {
  port.postMessage({ setTrue: id });
}

export function boxClicked(event: Event, port: chrome.runtime.Port): void {
  const id = (event.target as HTMLElement).parentElement?.getAttribute("id");
  port.postMessage({ toggle: id });
}

export function previewClicked(event: Event, port: chrome.runtime.Port): void {
  const id = (event.target as HTMLElement).parentElement?.getAttribute("id");
  setPreviewed(id, port);
}

export function fillFrame(
  event: Event, 
  previewState: { previewOpen: boolean; previewId?: string }
): void {
  document.querySelectorAll(".preview-frame").forEach(item => {
    while (item.firstChild) {
      item.removeChild(item.firstChild);
    }
  });

  const preview = (event.target as HTMLElement)
    .closest(".music-grid-item")
    ?.querySelector(".preview-frame");
  if (!preview) return;
  
  const idAndType = preview.getAttribute("id");
  if (!idAndType) return;
  
  const id = idAndType.split("-")[1];
  const idType = idAndType.split("-")[0];

  // determine if preview window needs to be open
  if (previewState.previewOpen === true && previewState.previewId === id) {
    previewState.previewOpen = false;
  } else {
    previewState.previewId = id;
    previewState.previewOpen = true;
  }

  if (previewState.previewOpen) {
    let url = `https://bandcamp.com/EmbeddedPlayer/${idType}=${id}`;
    url +=
      '/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=true/artwork=none/transparent=true/"';

    const iframe_style =
      "margin: 6px 0px 0px 0px; border: 0; width: 150%; height: 300px; position:relative; z-index:1;";

    const iframe = document.createElement("iframe");
    iframe.setAttribute("style", iframe_style);
    iframe.setAttribute("src", url);
    iframe.setAttribute("seamless", "");
    preview.appendChild(iframe);
  }
}

// Main initialization function (replaces LabelView class)
export async function initLabelView(): Promise<void> {
  const log = new Logger();
  const previewState = { previewOpen: false, previewId: undefined };
  let port: chrome.runtime.Port;

  try {
    // connect to background
    port = chrome.runtime.connect(null, { name: "bandcamplabelview" });

    // kickstart
    port.onMessage.addListener(msg => {
      if (msg.id) setHistory(msg.id.key, msg.id.value);
    });
  } catch (e) {
    if (e.message.includes("Error in invocation of runtime.connect")) {
      // This only occurs in testing, ignoring for now
      log.error(e);
      return;
    } else {
      // Ensure other errors are escalated
      throw e;
    }
  }

  log.info("Rendering BES...");
  renderDom(port, previewState);
}

export function generatePreview(id: string, idType: string): HTMLDivElement {
  const button = document.createElement("button");
  button.setAttribute("title", "load preview player");
  button.setAttribute("type", "button");
  button.setAttribute("class", "follow-unfollow open-iframe");
  button.setAttribute("style", "width: 90%");
  button.append("Preview");

  const checkbox = document.createElement("button");
  checkbox.setAttribute("title", "preview history (click to toggle)");
  checkbox.setAttribute(
    "style",
    "margin: 0px 0px 0px 5px; width: 28px; height: 28px; position: absolute;"
  );
  checkbox.setAttribute("class", "follow-unfollow historybox");

  const preview = document.createElement("div");
  preview.setAttribute("class", "preview-frame");
  preview.setAttribute("id", `${idType}-${id}`);

  const parent = document.createElement("div");
  parent.setAttribute("id", id);
  parent.setAttribute("class", "preview");
  parent.appendChild(button);
  parent.appendChild(checkbox);
  parent.appendChild(preview);

  return parent;
}

export function renderDom(
  port: chrome.runtime.Port, 
  previewState: { previewOpen: boolean; previewId?: string }
): void {
  // iterate over page to get album IDs and append buttons with value
  document
    .querySelectorAll("li.music-grid-item[data-item-id]")
    .forEach(item => {
      const idAndType = (item as HTMLElement).dataset.itemId;
      if (!idAndType) return;
      
      const id = idAndType.split("-")[1];
      const idType = idAndType.split("-")[0];
      const $preview = generatePreview(id, idType);
      item.appendChild($preview);

      port.postMessage({ query: id });
    });

  document
    .querySelectorAll(
      'li.music-grid-item[data-tralbumid][data-tralbumtype="a"]'
    )
    .forEach(item => {
      const id = (item as HTMLElement).dataset.tralbumid;
      if (!id) return;
      const preview = generatePreview(id, "album");
      item.appendChild(preview);

      port.postMessage({ query: id });
    });

  const pagedata = document.querySelector("#pagedata");
  if (!pagedata) return;
  const datablob = JSON.parse((pagedata as HTMLElement).dataset.blob!);
  const urlParams = new URLSearchParams(datablob.lo_querystr);
  const id = urlParams.get("item_id");
  if (id) {
    setPreviewed(id, port);
  }

  const _openFrame = document
    .querySelectorAll(".open-iframe")
    .forEach(item => {
      item.addEventListener("click", event => {
        fillFrame(event, previewState);
        previewClicked(event, port);
      });
    });

  const _historybox = document
    .querySelectorAll(".historybox")
    .forEach(item => {
      item.addEventListener("click", event => {
        boxClicked(event, port);
      });
    });
}

// Backward compatibility - maintain class-like interface
export default class LabelView {
  async init(): Promise<void> {
    return initLabelView();
  }
}
