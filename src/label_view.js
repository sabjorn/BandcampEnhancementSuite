import $ from "jquery";

export default class LabelView {
  constructor() {
    this.previewId; // globally stores which 'preview' button was last clicked
    this.previewOpen = false; // globally stores if preveiw window is open

    // connect to background
    this.port = chrome.runtime.connect(null, { name: "bandcamplabelview" });

    // kickstart
    this.port.onMessage.addListener(msg => {
      if (msg.id) this.setHistory(msg.id.key, msg.id.value);
    });

    // migrates old local storage, will be deleted in future versions
    var pluginState = window.localStorage;

    Object.keys(pluginState).forEach(key => {
      if (pluginState[key] === "true" && !key.includes("-")) {
        this.setPreviewed(key);
      }
    });

    $(document).ready(() => {
      this.renderDom();
    });
  }

  setHistory(id, state) {
    let historybox = $(`div.preview[id='${id}']`).find("button.historybox");
    if (state)
      $(historybox).attr("class", "follow-unfollow historybox following");
    else $(historybox).attr("class", "follow-unfollow historybox");
  }

  setPreviewed(id) {
    this.port.postMessage({ setTrue: id });
  }

  boxClicked(event) {
    const id = $(event.target)
      .parents("div")
      .attr("id");

    this.port.postMessage({ toggle: id });
  }

  previewClicked(event) {
    const id = $(event.target)
      .parents("div")
      .attr("id");

    this.setPreviewed(id);
  }

  fillFrame(event) {
    $(".preview-frame").html(""); // clear all iframes

    let $preview = $(event.target)
      .parents(".music-grid-item")
      .find(".preview-frame");
    const idAndType = $preview.attr("id");
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
      const iframe_val = `<iframe style="${iframe_style}" src="${url}" seamless></iframe>`;
      $preview.html(iframe_val);
    }
  }

  generatePreview(id, idType) {
    let $button = $("<button>")
      .attr("title", "load preview player")
      .attr("type", "button")
      .attr("class", "follow-unfollow open-iframe")
      .attr("style", "width: 90%");

    let $preview = $("<div>").html("Preview");
    $button.append($preview);

    let $checkbox = $("<button>")
      .attr("title", "preview history (click to toggle)")
      .attr(
        "style",
        "margin: 0px 0px 0px 5px; width: 28px; height: 28px; position: absolute;"
      )
      .attr("class", "follow-unfollow historybox");

    $preview = $("<div>")
      .attr("class", "preview-frame")
      .attr("id", `${idType}-${id}`);

    let $parent = $("<div>")
      .attr("id", id)
      .attr("class", "preview")
      .append($button)
      .append($checkbox)
      .append($preview);

    return $parent;
  }

  renderDom() {
    // iterate over page to get album IDs and append buttons with value
    $("li.music-grid-item[data-item-id]").each((index, item) => {
      const idAndType = $(item)
        .closest("li")
        .attr("data-item-id");
      const id = idAndType.split("-")[1];
      const idType = idAndType.split("-")[0];
      let $preview = this.generatePreview(id, idType);
      $(item).append($preview);

      this.port.postMessage({ query: id });
    });

    $('li.music-grid-item[data-tralbumid][data-tralbumtype="a"]').each(
      (index, item) => {
        const id = $(item).attr("data-tralbumid");
        let $preview = this.generatePreview(id, "album");
        $(item).append($preview);

        this.port.postMessage({ query: id });
      }
    );

    $("#pagedata")
      .first()
      .each((index, item) => {
        const datablob = JSON.parse($(item).attr("data-blob"));
        const urlParams = new URLSearchParams(datablob.lo_querystr);
        const id = urlParams.get("item_id");
        if (id) {
          this.setPreviewed(id);
        }
      });

    $(".open-iframe").on("click", event => {
      this.fillFrame(event);
      this.previewClicked(event);
    });

    $(".historybox").on("click", event => {
      this.boxClicked(event);
    });
  }
}

window.onload = () => {
  new LabelView();
};
