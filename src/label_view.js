// console.log = function() {}; // disable logging

var preview_id; // globally stores which 'preview' button was last clicked
var preview_open = false; // globally stores if preveiw window is open

var storageCache = []

// load storage backed
var storageLoadedPromise = new Promise(function(resolve, reject) {
    chrome.storage.sync.get("previews", function(result) {
        try{
            // load storage
            if(isEmpty(result)){
                console.log("storage empty, storing new")
                chrome.storage.sync.set({"previews": storageCache})
            }
            else{
                console.log("storage exists, storing to variable 'storageCache'")
                storageCache = result["previews"]
            }

            // migrate old storage
            console.log("plugin state transfer")
            var pluginState = window.localStorage;
            Object.keys(pluginState).forEach(function(key) {
            if(pluginState[key] === "true" && !(key.includes("-")))
            {
                console.log("storing key: ", key);
                storeId(key);
            }
            });
            
            chrome.storage.sync.set({"previews": storageCache})
            console.log(storageCache)
            resolve();
        }
        catch(e) {
            console.error(e);
            reject(e);
        }
    });
});

chrome.storage.sync.getBytesInUse("previews", function(bytesInUse) {
    console.log("current bytes in use: ", bytesInUse)
    console.log("% of quota", (bytesInUse/102400))
})

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

function storeId(id)
{
    var val = storageCache.indexOf(id)
    if(!(storageCache.includes(id))){
        storageCache.push(id);
        chrome.storage.sync.set({"previews": storageCache});
        console.log("storing ID: ", id);
    }

}

function boxclick(event)
{
    /*
        tracks boxclicks to store 'id'
    */       
    var id = $(event.target).parents('div').attr('id');
    console.log(storageCache)

    var previewState = false
    var val = storageCache.indexOf(id)
    if(val > -1){
        console.log("removing element")
        storageCache.splice(val, 1)
    }
    else{
        console.log("adding element")
        storageCache.push(id)
        previewState = true
    }
    console.log(storageCache)
    toggleHistorybox($(event.target), previewState)

    chrome.storage.sync.set({"previews": storageCache})
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
        storeId(id);

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
    
    toggleState = false
    if(storageCache.includes(id))
    {
        console.log("id exists: ", id);
        toggleState = true;
    }

    $checkbox = toggleHistorybox($checkbox, toggleState);

    $parent_div.append($button);
    $parent_div.append($checkbox);
    $parent_div.append($bclvframe);

    return $parent_div
}

chrome.extension.sendMessage({}, function(response) {

    $( document ).ready(function() {
        storageLoadedPromise.then(function() {
            // iterate over page to get album IDs and append buttons with value
            $('li[data-item-id]').each(function(index, item){
                var id = $(item).closest('li').attr('data-item-id');
                if (id.split("-")[0] == "album" || id.split("-")[0] == "track"){
                    id = id.split("-")[1];
                }

                $preview_element = generatePreview(id);
                $(item).append($preview_element);
            });

            $('li[data-tralbumid][data-tralbumtype="a"]').each(function(index, item){
                var id = $(item).attr('data-tralbumid');
                
                $preview_element = generatePreview(id);
                $(item).append($preview_element);
            });

            // catched ID album pages
            $('#pagedata').first().each(function(index, item){
                var data_blob = JSON.parse($(item).attr("data-blob"));
                try {
                    var id = data_blob.fan_tralbum_data.tralbum_id;
                    storeId(id.toString());
                    console.log("id is: ", id);
                }
                catch(e){
                    console.log(e);
                }
            })

            $('.open-iframe').on('click', function(event){ fillframe(event); });

            $('.historybox').on('click', function(event) { boxclick(event); });
        });
    });
});