import $ from 'jquery';

console.log = function() {}; // disable logging

let previewId; // globally stores which 'preview' button was last clicked
let previewOpen = false; // globally stores if preveiw window is open

// connect to background
let port = chrome.runtime.connect(null, {name: 'bandcamplabelview'});
port.onMessage.addListener(function(msg){
  if(msg.id)
    setHistory(msg.id.key, msg.id.value)
});

(async () => { 
  // migrates old local storage, will be deleted in future versions
  var pluginState = window.localStorage;
  
  Object.keys(pluginState).forEach(function(key) {
    if (pluginState[key] === "true" && !key.includes("-")) {
      console.log("sending key: ", key);
      setPreviewed(key);
    }
  });
})();

function setHistory(id, state){
  let historybox = $(`div.preview[id='${id}']`).find("button.historybox")
  if(state) 
    $(historybox).attr("class", "follow-unfollow historybox following");
  else
    $(historybox).attr("class", "follow-unfollow historybox");
}

function setPreviewed(id)
{
  port.postMessage({setTrue: id});
}

function boxClicked(event) {
  const id = $(event.target)
    .parents("div")
    .attr("id");
  
  port.postMessage({toggle: id});
}

function previewClicked(event) {
  const id = $(event.target)
    .parents("div")
    .attr("id");

  setPreviewed(id);
}

function fillFrame(event) {
  $(".preview-frame").html(""); // clear all iframes

  var $preview = $(event.target)
    .parents(".music-grid-item")
    .find(".preview-frame");
  const idAndType = $preview.attr("id");
  const id = idAndType.split("-")[1];
  const idType = idAndType.split("-")[0];

  // determine if preview window needs to be open
  if (previewOpen == true && previewId == id) {
    previewOpen = false;
  } else {
    previewId = id;
    previewOpen = true;
  }

  if (previewOpen) {
    $checkbox = $(event.target)
      .parents(`[id='${id}']`)
      .find(".historybox");

    var url = `https://bandcamp.com/EmbeddedPlayer/${idType}=${id}`;
    url +=
      '/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=true/artwork=none/transparent=true/"';

    const iframe_style =
      "margin: 6px 0px 0px 0px; border: 0; width: 150%; height: 300px; position:relative; z-index:1;";
    const iframe_val = `<iframe style="${iframe_style}" src="${url}" seamless></iframe>`;
    $preview.html(iframe_val);
  }
}

function generatePreview(id, idType) {
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

$(document).ready(function() {
  // iterate over page to get album IDs and append buttons with value
  $("li.music-grid-item[data-item-id]")
    .each(function(index, item) {
      const idAndType = $(item)
        .closest("li")
        .attr("data-item-id");
      const id = idAndType.split("-")[1];
      const idType = idAndType.split("-")[0];

      let $preview = generatePreview(id, idType);
      $(item).append($preview);
      $(item).show();

      port.postMessage({query: id});
    });

  $('li.music-grid-item[data-tralbumid][data-tralbumtype="a"]')
    .each(function(index, item) {
      const id = $(item).attr("data-tralbumid");

      let $preview = generatePreview(id, "album");
      $(item).append($preview);
      $(item).show();

      port.postMessage({query: id});
    });

  $("#pagedata")
    .first()
    .each(function(index, item) {
      const datablob = JSON.parse($(item).attr("data-blob"));
      try {
        const urlParams = new URLSearchParams(datablob.lo_querystr);
        const id = urlParams.get("item_id");
        if (id) {
          setPreviewed(id);
        }
      } catch (e) {
        console.error(e);
      }
    });

  $(".open-iframe")
    .on("click", function(event) {
      fillFrame(event);
      previewClicked(event);
    });

  $(".historybox")
    .on("click", function(event) {
      boxClicked(event);
    });
});