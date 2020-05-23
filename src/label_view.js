// console.log = function() {}; // disable logging

// connect to background
let port = chrome.runtime.connect(null, {name: 'bandcamplabelview'});
port.onMessage.addListener(function(msg) 
{
  if(msg.id)
    sethistory(msg.id.key, msg.id.value)

});

var preview_id; // globally stores which 'preview' button was last clicked
var preview_open = false; // globally stores if preveiw window is open

function boxclick(event) {
  var id = $(event.target)
    .parents("div")
    .attr("id");
  
  port.postMessage({toggle: id});
}

function previewclick(event) {
  var id = $(event.target)
    .parents("div")
    .attr("id");

  setPreview(id);
}

function setPreview(id)
{
  port.postMessage({setTrue: id});
}

function sethistory(id, state){
  var historybox = $(`div.preview[id='${id}']`).find("button.historybox")
  if(state) 
    $(historybox).attr("class", "follow-unfollow historybox following");
  else
    $(historybox).attr("class", "follow-unfollow historybox");
}

function fillframe(event) {
  $(".bclv-frame").html(""); // clear all iframes

  var $bclv = $(event.target)
    .parents(".music-grid-item")
    .find(".bclv-frame");
  var idAndType = $bclv.attr("id");
  var id = idAndType.split("-")[1];
  var idType = idAndType.split("-")[0];

  // determine if preview window needs to be open
  if (preview_open == true && preview_id == id) {
    preview_open = false;
  } else {
    preview_id = id;
    preview_open = true;
  }

  if (preview_open) {
    // set checkbox to clicked
    $checkbox = $(event.target)
      .parents(`[id='${id}']`)
      .find(".historybox");

    // fill frame
    var url = `https://bandcamp.com/EmbeddedPlayer/${idType}=${id}`;
    url +=
      '/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=true/artwork=none/transparent=true/"';

    var iframe_style =
      "margin: 6px 0px 0px 0px; border: 0; width: 150%; height: 300px; position:relative; z-index:1;";
    var iframe_val = `<iframe style="${iframe_style}" src="${url}" seamless></iframe>`;
    $bclv.html(iframe_val);
  }
}

// helper function for creating preview button
function generatePreview(id, idType) {
  $button = $("<button>")
    .attr("title", "load preview player")
    .attr("type", "button")
    .attr("class", "follow-unfollow open-iframe")
    .attr("style", "width: 90%");

  $preview = $("<div>").html("Preview");
  $button.append($preview);

  $bclvframe = $("<div>")
    .attr("class", "bclv-frame")
    .attr("id", `${idType}-${id}`);

  // add checkbox with stores history of clicks
  $checkbox = $("<button>")
    .attr("title", "preview history (click to toggle)")
    .attr(
      "style",
      "margin: 0px 0px 0px 5px; width: 28px; height: 28px; position: absolute;"
    )
    .attr("class", "follow-unfollow historybox following");

  $parent_div = $("<div>")
    .attr("id", id)
    .attr("class", "preview")
    .append($button)
    .append($checkbox)
    .append($bclvframe);

  return $parent_div;
}


$(document).ready(function() {
  // iterate over page to get album IDs and append buttons with value
  $("li.music-grid-item[data-item-id]").each(function(index, item) {
    const idAndType = $(item)
      .closest("li")
      .attr("data-item-id");
    const id = idAndType.split("-")[1];
    const idType = idAndType.split("-")[0];

    $preview_element = generatePreview(id, idType);
    $(item).append($preview_element);
    $(item).show();

    port.postMessage({query: id});
  });

  $('li.music-grid-item[data-tralbumid][data-tralbumtype="a"]').each(
    function(index, item) {
      const id = $(item).attr("data-tralbumid");

      $preview_element = generatePreview(id, "album");
      $(item).append($preview_element);
      $(item).show();

      port.postMessage({query: id});
    }
  );

  // catched ID album pages
  $("#pagedata")
    .first()
    .each(function(index, item) {
      const datablob = JSON.parse($(item).attr("data-blob"));
      try {
        const urlParams = new URLSearchParams(datablob.lo_querystr);
        const id = urlParams.get("item_id");
        if (id) {
          setPreview(id);
        }
      } catch (e) {
        console.error(e);
      }
    });

  $(".open-iframe").on("click", function(event) {
    fillframe(event);
    previewclick(event);
  });

  $(".historybox").on("click", function(event) {
    boxclick(event);
  });
});