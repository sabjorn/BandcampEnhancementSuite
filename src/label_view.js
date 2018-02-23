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
        $('.bclv-frame').html(''); // clear all iframes

        var $bclv = $(event.target).parent().find('.bclv-frame');
        var id = $bclv.attr('id');
        
        //console.log(id);

        if (toggleval) {
            var url = 'https://bandcamp.com/EmbeddedPlayer/album='+id;
            url = url + '/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=true/artwork=small/transparent=true/"';

            var iframe_style = 'style="margin: 10px; border: 0; width: 400px; height: 240px; position:relative; z-index:1;"';
            var iframe_val = '<iframe '+iframe_style+' src='+url+' seamless></iframe>';
            $bclv.html(iframe_val);
        }
    }

    // Append .open-iframe links (also use for iFrames)
    $('li[data-item-id]').each(function(index, item){
        var id = $(item).closest('li').attr('data-item-id');
        if (id.split("-")[0] == "album"){
            id = id.split("-")[1];
        }
        //console.log(id);
        $button = $('<button>');
        $button.attr('type', "button");
        $button.attr('class', "follow-unfollow open-iframe");

        $preview = $('<div>').html("Preview");
        $button.append($preview);
        
        $bclvframe = $('<div>');
        $bclvframe.attr('class', "bclv-frame").attr('id', id);
        $button.append($bclvframe);

        $(item).append($button);
    });

    // Append .open-iframe links (also use for iFrames)
    $('li[data-tralbumid][data-tralbumtype="a"]').each(function(index, item){
        var id = $(item).attr('data-tralbumid');
        
        // console.log(id);

        $button = $('<button>');
        $button.attr('type', "button");
        $button.attr('class', "compound-button open-iframe");

        $preview = $('<div>').html("Preview");
        $button.append($preview);
        
        $bclvframe = $('<div>');
        $bclvframe.attr('class', "bclv-frame").attr('id', id);
        $button.append($bclvframe);
        
        $(item).append($button);
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