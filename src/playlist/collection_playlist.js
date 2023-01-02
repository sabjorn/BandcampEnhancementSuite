import Logger from "../logger";
import PlaylistComponent from "../component/playlist_component";
import { addAlbumToCart, getAudioBuffer } from "../utilities";
import { wishlistCallback } from "./utilities";

export default class CollectionPlaylist {
  constructor() {
    this.log = new Logger();
    const data_blob = JSON.parse(
      document.querySelector("#pagedata").getAttribute("data-blob")
    );
    this.fan_id = data_blob["fan_data"]["fan_id"];
    this.your_fan_id = data_blob["current_fan"]["fan_id"];
    this.active_tab = data_blob["active_tab"];
  }

  init() {
    this.log.info("Loaded CollectionPlaylist");

    this.collection_callback = () => {
      document.querySelectorAll(".bes_player").forEach(bes_player => {
        bes_player.remove();
      });
      if (this.fan_id === this.your_fan_id) return;
      this.subInit("collection");
    };
    const collection_button = document.querySelector("[data-tab=collection]");
    collection_button.onclick = this.collection_callback;

    this.wishlist_callback = () => {
      document.querySelectorAll(".bes_player").forEach(bes_player => {
        bes_player.remove();
      });
      this.subInit("wishlist");

      if (this.fan_id === this.your_fan_id)
        document.querySelectorAll(".wishlist").forEach(element => {
          element.classList.remove("wishlist");
          element.classList.add("wishlisted");
        });
    };
    const wishlist_button = document.querySelector("[data-tab=wishlist]");
    wishlist_button.onclick = this.wishlist_callback;

    ["followers", "following"].forEach(element => {
      document.querySelector(`[data-tab=${element}]`).onclick = () => {
        document.querySelectorAll(".bes_player").forEach(bes_player => {
          bes_player.remove();
        });
      };
    });

    if (this.active_tab === "collection") this.collection_callback();
    if (this.active_tab === "wishlist") this.wishlist_callback();
  }

  subInit(route) {
    const element = document.querySelector(`#${route}-items`);

    this.playlist_component = this.initPlaylist(element, route);

    this.port = chrome.runtime.connect(null, { name: "bandcamplabelview" });

    this.port.onMessage.addListener(
      (tracks => {
        this.playlist_component.appendTracks(tracks);
      }).bind(this)
    );

    this.port.postMessage({
      route: route,
      fan_id: this.fan_id,
      oldest_story_date: Date.now() / 1000,
      count: 40
    });
  }

  initPlaylist(element, route) {
    const playlist_component = new PlaylistComponent(true, false, true, true);
    playlist_component
      .set_post_play_callback(getAudioBuffer)
      .set_purchase_button_callback(
        ((track_id, price) => {
          this.log.info("puchase button callback");
          this.log.info(`${track_id}, ${price}`);
          return addAlbumToCart(track_id, price, "t");
        }).bind(this)
      )
      .set_load_button_callback(
        (() => {
          const playlists = document.querySelector(".bes_player");
          const tracks = playlists.querySelectorAll("li");
          if (!tracks) return;
          const last_track = tracks[tracks.length - 1];
          const timestamp = last_track.getAttribute("timestamp");

          this.log.debug(
            `loading tracks with route: ${route}, timestamp: ${timestamp}`
          );
          this.port.postMessage({
            route: route,
            fan_id: this.fan_id,
            oldest_story_date: timestamp,
            count: 40
          });
        }).bind(this)
      )
      .set_wishlist_button_callback(target => {
        wishlistCallback(target, this.your_fan_id, this.log);
      })
      .set_post_add_track_callback(target => {
        if (!window.location.href.includes("wishlist")) return;
        if (this.fan_id !== this.your_fan_id) return;
        const wishlist_button = target.querySelector(".wishlist");
        wishlist_button.classList.remove("wishlist");
        wishlist_button.classList.add("wishlisted");
      });

    playlist_component.init(element);
    return playlist_component;
  }
}
