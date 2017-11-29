function fillframe(event, toggleval) {
    var id = jQuery(event.target).closest('li').attr('data-item-id');
    if (id.split("-")[0] == "album"){
        id = id.split("-")[1];
    }
    console.log(id);

    replace_val = '';
    if (toggleval) {
        var url = 'https://bandcamp.com/EmbeddedPlayer/album='+id;
        url = url + '/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=true/artwork=small/transparent=true/"';
  
        var style = 'style="border: 0; width: 400px; height: 240px;"';
        var iframe_val = '<iframe '+style+' src='+url+' seamless></iframe>';
        replace_val = '<div id='+id+'>'+iframe_val+'</div>';
    }
    else {
        replace_val = '<div id='+id+'></div>';
    }
    jQuery('#'+id).replaceWith(replace_val);
}

// Append .open-iframe links (also use for iFrames)
jQuery('li[data-item-id]').each(function(index, item){
    var id = jQuery(item).closest('li').attr('data-item-id');
    if (id.split("-")[0] == "album"){
        id = id.split("-")[1];
    }
    console.log(id);

    jQuery(item).append('<a class="open-iframe href="#">Open iframe</a>');
    jQuery(item).append('<div id='+id+'></div>');
});

jQuery('.open-iframe').toggle(
    function(event){
        fillframe(event, true);
    },
    function(event){
        fillframe(event, false);
    }
);