import Logger from "../logger";

export default class PlaylistBackend {
  constructor() {
    this.log = new Logger();
    this.fetchPlaylistData = PlaylistBackend.fetchPlaylistData.bind(this);
    this.connectionListenerCallback = PlaylistBackend.connectionListenerCallback.bind(
      this
    );
  }

  init() {
    this.log.info("starting playlist backend.");
    chrome.runtime.onConnect.addListener(this.connectionListenerCallback);
    chrome.runtime.onMessage.addListener(this.fetchPlaylistData); // for one off messages
  }

  static fetchPlaylistData(request, sender, sendResponse) {
    //if (request.contentScriptQuery != "renderBuffer") return;
    if (request.route === "fan_activity") {
      this.log.info("fan_activity");
      recursiveFanFeedUpdates(this.port, 5).catch(error => {
        this.log.error("Error:", error);
      });
      return true;
    }
    if (request.route === "wishlist") {
      const now = Math.floor(Date.now() / 1000);
      const count = 1000;
      const body = {
        fan_id: 896389,
        older_than_token: `${now}::a::`,
        count: count
      };
      fetch("https://bandcamp.com/api/fancollection/1/wishlist_items", {
        body: JSON.stringify(body),
        method: "POST",
        mode: "cors",
        credentials: "include"
      })
        .then(response => response.text())
        .then(text => {
          const data = JSON.parse(text);
          const items = data["items"];

          items.forEach(item => {
            const item_type = item["item_type"].charAt(0);
            const item_index = `${item_type}${item["item_id"]}`;
            const tracklist = data["tracklists"];
            const trackinfo = tracklist[item_index];
            const response = {
              album_artist: item["band_name"],
              album_url: item["item_url"],
              album_art: item["item_art_id"],
              track_data: trackinfo
            };
            this.port.postMessage(response);
          });
        })
        .catch(error => {
          this.log.error("Error:", error);
        });
      return true;
    }
    this.log.info("url recieved, grabbing track data.");
    const url = request.url;
    this.log.info(url);
    fetch(url)
      .then(response => response.text())
      .then(text => {
        const regex = 'data-tralbum="([^"]*)"';
        const album_collection = text
          .match(regex)[1]
          .replaceAll('"', "'")
          .replaceAll("&quot;", '"');
        const mp3data = JSON.parse(album_collection);

        sendResponse({
          album_artist: mp3data["artist"],
          album_url: mp3data["url"],
          album_art: mp3data["art_id"],
          track_data: mp3data["trackinfo"]
        });
        // reconcile this!
        //this.port.postMessage({
        //  album_artist: mp3data["artist"],
        //  album_url: mp3data["url"],
        //  album_art: mp3data["art_id"],
        //  track_data: mp3data["trackinfo"]
        //});
      })
      .catch(error => {
        this.log.error("Error:", error);
      });

    return true;
  }

  static connectionListenerCallback(port) {
    this.log.info("connection listener callback");
    if (port.name !== "bandcamplabelview") {
      this.log.error(
        `Unexpected chrome.runtime.onConnect port name: ${port.name}`
      );
      return;
    }

    this.port = port;
    this.port.onMessage.addListener(this.fetchPlaylistData);
  }
}

function recursiveFanFeedUpdates(port, count, timestamp = null) {
  return new Promise((resolve, reject) => {
    if (timestamp === null) timestamp = Math.floor(Date.now() / 1000);

    const body = `fan_id=896389&older_than=${timestamp}`;
    fetch("https://bandcamp.com/fan_dash_feed_updates", {
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: body,
      method: "POST",
      mode: "cors",
      credentials: "include"
    })
      .then(response => {
        if (response.status !== 200) {
          throw `${response.status}: ${response.statusText}`;
        }
        response
          .json()
          .then(data => {
            const new_timestamp = data["stories"]["oldest_story_date"];
            const entries = data["stories"]["entries"];
            const track_list = data["stories"]["track_list"];
            entries.forEach((item, index) => {
              const track_data = item;
              track_data["file"] = track_list[index]["streaming_url"];
              track_data["track_num"] = track_list[index]["track_num"];
              track_data["title"] = track_list[index]["title"];
              track_data["label"] = track_list[index]["label"];
              track_data["price"] = track_list[index]["price"];
              track_data["currency"] = track_list[index]["currency"];

              const title_link = `${item["item_url"].split("/")[3]}/${
                item["item_url"].split("/")[4]
              }`;
              track_data["title_link"] = `/${title_link}`;

              const response = {
                album_artist: item["band_name"],
                album_url: item["item_url"],
                album_art: item["item_art_id"],
                track_data: [track_data]
              };
              port.postMessage(response);
            });
            if (count > 0) {
              recursiveFanFeedUpdates(port, --count, new_timestamp)
                .then(resolve)
                .catch(reject);
            } else {
              resolve(true);
            }
          })
          .catch(reject);
      })
      .catch(reject);
  });
}
