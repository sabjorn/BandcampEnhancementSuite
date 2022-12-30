import { add } from "winston";
import Logger from "./logger";
import PlaylistComponent from "./playlist_component";
import { getUrl, getClientId } from "./utilities";

export default class CollectionPlaylist {
  constructor(route) {
    this.log = new Logger();
    this.route = route;
    this.port = chrome.runtime.connect(null, { name: "bandcamplabelview" });
    this.playlist_component = new PlaylistComponent(true);
    const data_blob = JSON.parse(
      document.querySelector("#pagedata").getAttribute("data-blob")
    );
    this.fan_id = data_blob["fan_data"]["fan_id"];
    this.log.debug(`fan_id: ${this.fan_id}`);

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
            route: this.route,
            fan_id: this.fan_id,
            oldest_story_date: timestamp,
            count: 40
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
    this.log.info("Loaded CollectionPlaylist");

    const preload = JSON.parse(
      document.querySelector("#pagedata").getAttribute("data-blob")
    );
    const your_fan_id = preload["current_fan"]["fan_id"];
    const collection_fan_id = preload["fan_data"]["fan_id"];
    if (your_fan_id === collection_fan_id) {
      this.log.debug("not loading collection -- same collection as user");
      return;
    }
    const element = document
      .querySelector(item_to_replace)
      .querySelector(".collection-items");
    this.playlist_component.init(element);

    this.port.onMessage.addListener(
      (tracks => {
        this.playlist_component.appendTracks(tracks);
      }).bind(this)
    );

    this.port.postMessage({
      route: this.route,
      fan_id: this.fan_id,
      oldest_story_date: Date.now() / 1000,
      count: 40
    });
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
