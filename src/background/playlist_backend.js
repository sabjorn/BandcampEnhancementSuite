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
    if (request.contentScriptQuery == "renderBuffer") return;
    if (request.route === "fan_activity") {
      this.fetchFanActivity(request);
      return true;
    }
    if (request.route === "tralbum_details") {
      this.fetchTralbumDetails(request);
      return true;
    }

    if (request.route === "wishlist") {
      this.fetchFanCollection(
        request,
        "https://bandcamp.com/api/fancollection/1/wishlist_items"
      );
      return true;
    }

    if (request.route === "collection")
      this.fetchFanCollection(
        request,
        "https://bandcamp.com/api/fancollection/1/collection_items"
      );

    return true;
  }

  fetchFanActivity(request) {
    this.log.info("fan_activity");
    const count = request.tracks / 20;
    this.log.info(`fetching ${request.tracks} tracks, with ${count} loops`);

    recursiveFanFeedUpdates(
      this.port,
      request.fan_id,
      count,
      request.oldest_story_date
    ).catch(error => {
      this.log.error("Error:", error);
    });
  }

  fetchTralbumDetails(request) {
    this.log.info("tralbum_details");
    const body = {
      tralbum_type: request.tralbum_type,
      band_id: request.band_id,
      tralbum_id: request.tralbum_id
    };
    fetch("https://bandcamp.com/api/mobile/25/tralbum_details", {
      body: JSON.stringify(body),
      method: "POST",
      mode: "cors",
      credentials: "include"
    })
      .then(response => response.text())
      .then(text => {
        const data = JSON.parse(text);
        const items = data["tracks"];

        let tracks = [];
        items.forEach(item => {
          const track_url = data["bandcamp_url"];
          const track = {
            track_id: item["track_id"],
            artist: item["band_name"],
            title: item["title"],
            album_title: item["album_title"],
            label: item["label"],
            price: item["price"],
            currency: item["currency"],
            link_url: track_url,
            stream_url: item["streaming_url"]["mp3-128"],
            album_art_url: `https://f4.bcbits.com/img/${data["type"]}${data["art_id"]}_8.jpg`,
            is_purchasable: item["is_purchasable"],
            has_digital_download: item["has_digital_download"],
            duration: item["duration"],
            timestamp: Math.floor(Date.now() / 1000)
          };
          tracks.push(track);
        });
        this.port.postMessage(tracks);
      })
      .catch(error => {
        this.log.error("Error:", error);
      });
  }

  fetchFanCollection(request, url) {
    const older_than_token = `${request.oldest_story_date}::a::`;
    const body = {
      fan_id: request.fan_id,
      older_than_token: older_than_token,
      count: request.count
    };

    fetch(url, {
      body: JSON.stringify(body),
      method: "POST",
      mode: "cors",
      credentials: "include"
    })
      .then(response => response.text())
      .then(text => {
        const data = JSON.parse(text);
        const items = data["items"];
        const tracklists = data["tracklists"];

        let tracks = [];
        items.forEach(item => {
          if (item["tralbum_type"] === "a") {
            const album_request = {
              tralbum_type: "a",
              band_id: item["band_id"],
              tralbum_id: item["album_id"]
            };
            this.fetchTralbumDetails(album_request);
            return;
          }

          const track_list = tracklists[`t${item["featured_track"]}`][0];
          const track = {
            track_id: item["featured_track"],
            artist: item["band_name"],
            title: item["featured_track_title"],
            album_title: item["album_title"],
            label: item["label"],
            price: item["price"],
            currency: item["currency"],
            link_url: item["item_url"],
            stream_url: track_list["file"]["mp3-128"],
            album_art_url: item["item_art_url"],
            is_purchasable: item["is_purchasable"],
            has_digital_download: item["download_available"],
            duration: item["featured_track_duration"],
            timestamp: data["last_token"].split(":")[0]
          };
          tracks.push(track);
        });
        this.port.postMessage(tracks);
      })
      .catch(error => {
        this.log.error("Error:", error);
      });
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

function recursiveFanFeedUpdates(port, fan_id, count, timestamp) {
  return new Promise((resolve, reject) => {
    const body = `fan_id=${fan_id}&older_than=${timestamp}`;
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

            let tracks = [];
            entries.forEach((item, index) => {
              if (item["item_type"] === "a")
                // a to have a fetch that gets the tracks...
                // for now we ignore albums because price is wrong
                return;

              const selected_track = track_list[index];
              const track = {
                track_id: selected_track["track_id"],
                artist: selected_track["band_name"],
                title: selected_track["title"],
                album_title: item["album_title"],
                label: selected_track["label"],
                price: selected_track["price"],
                currency: selected_track["currency"],
                link_url: item["item_url"],
                stream_url: selected_track["streaming_url"]["mp3-128"],
                album_art_url: item["item_art_url"],
                is_purchasable: selected_track["is_purchasable"],
                has_digital_download: selected_track["has_digital_download"],
                duration: selected_track["duration"],
                timestamp: Date.parse(item["story_date"]) / 1000
              };
              tracks.push(track);
            });
            port.postMessage(tracks);
            if (count > 0) {
              recursiveFanFeedUpdates(port, fan_id, --count, new_timestamp)
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
