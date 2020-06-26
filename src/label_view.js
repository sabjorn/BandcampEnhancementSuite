import Logger from "./logger";

export default class LabelView {
  constructor() {
    this.log = new Logger();
    this.previewId; // globally stores which 'preview' button was last clicked
    this.previewOpen = false; // globally stores if preveiw window is open

    try {
      // connect to background
      this.port = chrome.runtime.connect(null, { name: "bandcamplabelview" });

      // kickstart
      this.port.onMessage.addListener(msg => {
        if (msg.id) this.setHistory(msg.id.key, msg.id.value);
      });
    } catch (e) {
      if (e.message.includes("Error in invocation of runtime.connect")) {
        // This only occurs in testing, ignoring for now
        this.log.error(e);
      } else {
        // Ensure other errors are escalated
        throw e;
      }
    }
    // migrates old local storage, will be deleted in future versions
    var pluginState = window.localStorage;

    Object.keys(pluginState).forEach(key => {
      if (pluginState[key] === "true" && !key.includes("-")) {
        this.setPreviewed(key);
      }
    });
  }

  init() {
    this.log.info("Rendering BES...");
    this.renderDom();
  }

  setHistory(id, state) {
    // CSS.escape() is required for integer-only CSS IDs
    const historybox = document.querySelector(`#${CSS.escape(id)} .historybox`);
    historybox.classList.add("follow-unfollow");

    if (state) {
      historybox.classList.add("following");
    } else {
      historybox.classList.remove("following");
    }
  }

  setPreviewed(id) {
    this.port.postMessage({ setTrue: id });
  }

  boxClicked(event) {
    const id = event.target.parentElement.getAttribute("id");

    this.port.postMessage({ toggle: id });
  }

  previewClicked(event) {
    const id = event.target.parentElement.getAttribute("id");

    this.setPreviewed(id);
  }

  fillFrame(event) {
    document.querySelectorAll(".preview-frame").forEach(item => {
      while (item.firstChild) {
        item.removeChild(item.firstChild);
      }
    });

    let preview = event.target
      .closest(".music-grid-item")
      .querySelector(".preview-frame");
    const idAndType = preview.getAttribute("id");
    const id = idAndType.split("-")[1];
    const idType = idAndType.split("-")[0];

    // determine if preview window needs to be open
    if (this.previewOpen == true && this.previewId == id) {
      this.previewOpen = false;
    } else {
      this.previewId = id;
      this.previewOpen = true;
    }

    if (this.previewOpen) {
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

  generatePreview(id, idType) {
    let button = document.createElement("button");
    button.setAttribute("title", "load preview player");
    button.setAttribute("type", "button");
    button.setAttribute("class", "follow-unfollow open-iframe");
    button.setAttribute("style", "width: 90%");
    button.append("Preview");

    let checkbox = document.createElement("button");
    checkbox.setAttribute("title", "preview history (click to toggle)");
    checkbox.setAttribute(
      "style",
      "margin: 0px 0px 0px 5px; width: 28px; height: 28px; position: absolute;"
    );
    checkbox.setAttribute("class", "follow-unfollow historybox");

    let preview = document.createElement("div");
    preview.setAttribute("class", "preview-frame");
    preview.setAttribute("id", `${idType}-${id}`);

    let parent = document.createElement("div");
    parent.setAttribute("id", id);
    parent.setAttribute("class", "preview");
    parent.appendChild(button);
    parent.appendChild(checkbox);
    parent.appendChild(preview);

    return parent;
  }

  renderDom() {
    // iterate over page to get album IDs and append buttons with value
    document
      .querySelectorAll("li.music-grid-item[data-item-id]")
      .forEach(item => {
        const idAndType = item.dataset.itemId;
        const id = idAndType.split("-")[1];
        const idType = idAndType.split("-")[0];
        let $preview = this.generatePreview(id, idType);
        item.appendChild($preview);

        this.port.postMessage({ query: id });
      });

    document
      .querySelectorAll(
        'li.music-grid-item[data-tralbumid][data-tralbumtype="a"]'
      )
      .forEach(item => {
        const id = item.dataset.tralbumid;
        let preview = this.generatePreview(id, "album");
        item.appendChild(preview);

        this.port.postMessage({ query: id });
      });

    const pagedata = document.querySelector("#pagedata");
    const datablob = JSON.parse(pagedata.dataset.blob);
    const urlParams = new URLSearchParams(datablob.lo_querystr);
    const id = urlParams.get("item_id");
    if (id) {
      this.setPreviewed(id);
    }

    const openFrame = document
      .querySelectorAll(".open-iframe")
      .forEach(item => {
        item.addEventListener("click", event => {
          this.fillFrame(event);
          this.previewClicked(event);
        });
      });

    const historybox = document
      .querySelectorAll(".historybox")
      .forEach(item => {
        item.addEventListener("click", event => {
          this.boxClicked(event);
        });
      });
  }
}

window.onload = () => {
  const lv = new LabelView();

  lv.init();
};
