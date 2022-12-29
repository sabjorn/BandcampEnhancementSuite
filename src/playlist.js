import { add } from "winston";
import Logger from "./logger";
import PlaylistComponent from "./playlist_component";
import { getUrl, getClientId } from "./utilities";

export default class Playlist {
  constructor() {
    this.log = new Logger();
    this.port = chrome.runtime.connect(null, { name: "bandcamplabelview" });
    this.playlist_component = new PlaylistComponent(true);

    const data_blob = JSON.parse(
      document.querySelector("#pagedata").getAttribute("data-blob")
    );
    this.fan_id = data_blob["fan_info"]["fan_id"];

    this.playlist_component
      .set_pre_play_callback(
        (mp3_url => {
          // check if URL is still valid -- if not, send to get updated
          this.log.info("pre play callback");

          // mark played in DB
        }).bind(this)
      )
      .set_post_play_callback(this.getAudioBuffer)
      .set_delete_button_callback(
        (target => {
          this.log.info("delete button callback");
          this.log.info(target);
        }).bind(this)
      )
      .set_purchase_button_callback(
        ((track_id, price) => {
          this.log.info("puchase button callback");
          this.log.info(`${track_id}, ${price}`);
          return Playlist.addAlbumToCart(track_id, price, "t");
        }).bind(this)
      )
      .set_scroll_callback(
        ((event, li_index_current, li_total) => {
          if (li_index_current != li_total - 1) return;

          //this.log.info("scroll callback");
          //this.log.info(`${li_index_current}, ${li_total}`);

          const last_playlist_element = event.target.querySelectorAll("li")[
            li_total - 1
          ];
          const oldest_date = last_playlist_element.getAttribute("timestamp");

          //this.log.info(oldest_date);
          //this.port.postMessage({
          //  route: "fan_activity",
          //  oldest_story_date: oldest_date
          //});
        }).bind(this)
      )
      .set_load_button_callback(
        (() => {
          const playlists = document.querySelector(".bes_player");
          const tracks = playlists.querySelectorAll("li");
          if (!tracks) return;
          const last_track = tracks[tracks.length - 1];
          const timestamp = last_track.getAttribute("timestamp");
          this.log.info(`load button clicked with timestamp: ${timestamp}`);
          this.port.postMessage({
            route: "fan_activity",
            oldest_story_date: timestamp,
            fan_id: this.fan_id,
            tracks: 40
          });
        }).bind(this)
      )
      .set_wishlist_button_callback(
        (target => {
          this.log.debug(`wishlist callback on: ${target}`);
        }).bind(this)
      );
  }

  init(item_to_replace) {
    this.log.info("Loaded Playlist");

    const element = document.querySelector(item_to_replace);
    this.playlist_component.init(element);

    this.port.onMessage.addListener(
      (tracks => {
        this.playlist_component.appendTracks(tracks);
      }).bind(this)
    );

    const preload = JSON.parse(element.getAttribute("data-initial-values"));
    // copied from playlist_backend
    const entries = preload["stories"];
    const track_list = preload["track_list"];
    let tracks = [];
    entries.forEach((item, index) => {
      if (item["item_type"] === "a") {
        this.port.postMessage({
          route: "tralbum_details",
          tralbum_type: "a",
          band_id: item["band_id"],
          tralbum_id: item["tralbum_id"]
        });
        return;
      }

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
        is_purchasable: item["is_purchasable"],
        has_digital_download: item["has_digital_download"],
        duration: selected_track["duration"],
        timestamp: Date.parse(preload["feed_timestamp"]) / 1000
      };
      tracks.push(track);
    });
    this.playlist_component.appendTracks(tracks);

    // set oldest_date with current pre-loaded page data -- or attach to scroll_callback...
    //const oldest_date = preload["oldest_story_date"];
    //this.port.postMessage({
    //  route: "fan_activity",
    //  fan_id: this.fan_id,
    //  oldest_story_date: oldest_date,
    //  tracks: 40
    //});
  }

  getAudioBuffer(src) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          contentScriptQuery: "renderBuffer",
          url: src
        },
        response => {
          return resolve(response);
        }
      );
    });
  }

  static addAlbumToCart(
    item_id,
    unit_price,
    item_type = "a",
    url = getUrl(),
    client_id = getClientId()
  ) {
    return new Promise((resolve, reject) => {
      fetch(`https://${url}/cart/cb`, {
        headers: {
          accept: "application/json, text/javascript, */*; q=0.01",
          "content-type": "application/x-www-form-urlencoded",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "x-requested-with": "XMLHttpRequest"
        },
        referrer: "https://halfpastvibe.bandcamp.com/album/vielen-dank",
        referrerPolicy: "no-referrer-when-downgrade",
        body: `req=add&item_type=${item_type}&item_id=${item_id}&unit_price=${unit_price}&quantity=1&client_id=${client_id}&sync_num=1`,
        method: "POST",
        mode: "cors",
        credentials: "include"
      })
        .then(response => {
          if (response.status !== 200) {
            throw `${response.status}: ${response.statusText}`;
          }
          resolve();
        })
        .catch(reject);
    });
  }
}
