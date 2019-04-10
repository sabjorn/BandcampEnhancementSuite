// GLOBALS
var pluginState = window.localStorage;

var preview_id; // globally stores which 'preview' button was last clicked
var preview_open = false; // globally stores if preveiw window is open

var defaultData = {previewed: false}
var data = {}

chrome.storage.local.get('bandcamp', function(result) {
   if(isEmpty(result)){
       chrome.storage.local.set({'bandcamp': data})
   }
   else{
       data = result
   }
});

function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}

function strBool(input){
    if(input === "true")
        return true;
    return false;
}

function toggleHistorybox(target, state){
    target.attr('class', "follow-unfollow historybox");
    if(state)
        $(target).attr('class', "follow-unfollow historybox following");
    return target
}

// chrome.storage.onChanged.addListener(function(changes, namespace) {
//     console.log("Chrome Storage Changed")
//     for (var key in changes) {
//       var storageChange = changes[key];
//       for(var innerkey in storageChange.newValue){
//           console.log(storageChange.newValue[innerkey])
//       }
//     }
// });

function boxclick(event)
{
    /*
        tracks boxclicks to set pluginState for 'id'
    */       
    var id = $(event.target).parents('div').attr('id');
    console.log(data)
    data[[id]].previewed = !data[[id]].previewed
    toggleHistorybox($(event.target), data[[id]].previewed)

    chrome.storage.local.set({'bandcamp': data})
}
    
function fillframe(event) {
    $('.bclv-frame').html(''); // clear all iframes

    var $bclv = $(event.target).parents('.music-grid-item').find('.bclv-frame');
    var id = $bclv.attr('id');

    // determine if preview window needs to be open
    if (preview_open == true && preview_id == id){
        preview_open = false;    
    }
    else {
        preview_id = id;
        preview_open = true;
    }

    if (preview_open) {
        // preview opened, store this action in localstorage 'history'
        // pluginState.setItem(id, true); // old way
        // update state
        data[[id]].previewed = true;

        chrome.storage.local.set({'bandcamp': data})

        // set checkbox to clicked
        $checkbox = $(event.target).parents(`[id='${id}']`).find('.historybox');
        $checkbox = toggleHistorybox($checkbox, true);

        // fill frame
        var url = 'https://bandcamp.com/EmbeddedPlayer/album='+id;
        url = url + '/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=true/artwork=none/transparent=true/"';

        var iframe_style = 'style="margin: 6px 0px 0px 0px; border: 0; width: 150%; height: 300px; position:relative; z-index:1;"';
        var iframe_val = '<iframe '+iframe_style+' src='+url+' seamless></iframe>';
        $bclv.html(iframe_val);
    }
}

// helper function for creating preview button
function generatePreview(id) {
    $parent_div = $('<div>');
    $parent_div.attr('id', id);

    $button = $('<button>');
    $button.attr('type', "button");
    $button.attr('class', "follow-unfollow open-iframe");
    $button.attr('style', "width: 90%");

    $preview = $('<div>').html("Preview");
    $button.append($preview);
    
    $bclvframe = $('<div>');
    $bclvframe.attr('class', "bclv-frame").attr('id', id);

    // add checkbox with stores history of clicks
    $checkbox = $('<button>');
    $checkbox.attr('style', "margin: 0px 0px 0px 5px; width: 28px; height: 28px; position: absolute;");
    
    if(!(id in data))
        data[id] = defaultData
    $checkbox = toggleHistorybox($checkbox, data[[id]].previewed);

    $parent_div.append($button);
    $parent_div.append($checkbox);
    $parent_div.append($bclvframe);

    return $parent_div
}

chrome.extension.sendMessage({}, function(response) {

 var readyStateCheckInterval = setInterval(function() {
 if (document.readyState === "complete") {
    clearInterval(readyStateCheckInterval);

    // iterate over page to get album IDs and append buttons with value
    $('li[data-item-id]').each(function(index, item){
        var id = $(item).closest('li').attr('data-item-id');
        if (id.split("-")[0] == "album"){
            id = id.split("-")[1];
        }

        $preview_element = generatePreview(id);
        $(item).append($preview_element);
    });

    // iterate over page to get album IDs and append buttons with value
    $('li[data-tralbumid][data-tralbumtype="a"]').each(function(index, item){
        var id = $(item).attr('data-tralbumid');
        
        $preview_element = generatePreview(id);
        $(item).append($preview_element);
    });

    $('.open-iframe').on('click', 
        function(event){
            fillframe(event);
        }
    );

    $('.historybox').on('click', 
        function(event){
            boxclick(event);
        }
    );

 }
 }, 10);
});