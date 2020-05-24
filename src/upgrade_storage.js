/* Migrates Previous Storage Options */
let upgradePort = chrome.runtime.connect(null, {name: 'bandcamplabelview'});

function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}

function pushCache(storageCache){
  storageCache.forEach(function (id, index) {
    console.log("id: ", id);
    upgradePort.postMessage({setTrue: id});
  });
}

(async () => {
  chrome.storage.sync.get("previews", function(result) {
    try {
      if (isEmpty(result)) {
        console.log("storage empty, doing nothing");
      } else {
        console.log("storage exists, storing to variable 'storageCache'");
        pushCache(result["previews"]);
        // chrome.storage.clear();
      }

    } catch (e) {
      console.error(e);
    }
  });
})();

(async () => { 
  let storageCache = [];
  var pluginState = window.localStorage;
  
  Object.keys(pluginState).forEach(function(key) {
    if (pluginState[key] === "true" && !key.includes("-")) {
      console.log("storing key: ", key);
      storageCache.push(key);
    }
  });
  
  pushCache(storageCache);
  // pluginState.clear();
})();