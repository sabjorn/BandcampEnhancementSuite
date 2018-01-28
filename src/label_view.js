chrome.extension.sendMessage({}, function(response) {
 var readyStateCheckInterval = setInterval(function() {
 if (document.readyState === "complete") {
    clearInterval(readyStateCheckInterval);

    $.fn.toggleClick = function() {
        var methods = arguments;    // Store the passed arguments for future reference
        var count = methods.length; // Cache the number of methods 

        // Use return this to maintain jQuery chainability
        // For each element you bind to
        return this.each(function(i, item){
            // Create a local counter for that element
            var index = 0;

            // Bind a click handler to that element
            $(item).on('click', function() {
                // That when called will apply the 'index'th method to that element
                // the index % count means that we constrain our iterator between 0
                // and (count-1)
                return methods[index++ % count].apply(this, arguments);
            });
        });
    };

        
    function fillframe(event, toggleval) {
        var id = $(event.target).closest('li').attr('data-item-id');
        if (id.split("-")[0] == "album"){
            id = id.split("-")[1];
        }
        //console.log(id);

        replace_val = '';
        if (toggleval) {
            var url = 'https://bandcamp.com/EmbeddedPlayer/album='+id;
            url = url + '/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=true/artwork=small/transparent=true/"';
      
            var iframe_style = 'style="margin: 10px; border: 0; width: 400px; height: 240px;"';
            var iframe_val = '<iframe '+iframe_style+' src='+url+' seamless></iframe>';
            replace_val = '<div id='+id+'>'+iframe_val+'</div>';
        }
        else {
            replace_val = '<div id='+id+'></div>';
        }
        $('#'+id).replaceWith(replace_val);
    }

    // Append .open-iframe links (also use for iFrames)
    $('li[data-item-id]').each(function(index, item){
        var id = $(item).closest('li').attr('data-item-id');
        if (id.split("-")[0] == "album"){
            id = id.split("-")[1];
        }
        //console.log(id);
        var button_string = '<button type="button" class="follow-unfollow compound-button open-iframe">'
        button_string += '<div>Preview</div>'
        button_string += '<div id='+id+'></div>'
        button_string += '</button>';
        $(item).append(button_string);
    });

    $('.open-iframe').toggleClick(
        function(event){
            fillframe(event, true);
        },
        function(event){
            fillframe(event, false);
        }
    );

 }
 }, 10);
});