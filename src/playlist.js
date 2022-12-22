import Logger from "./logger";
import PlaylistComponent from "./playlist_component";
import { addAlbumToCart } from "./utilities";

export default class Playlist {
  constructor() {
    this.log = new Logger();
    this.port = chrome.runtime.connect(null, { name: "bandcamplabelview" });
    this.playlist_component = new PlaylistComponent(true);
    this.playlist_component
      .set_pre_play_callback(
        (mp3_url => {
          this.log.info("pre play callback");
          this.log.info(`mp3_url: ${mp3_url}`);
        }).bind(this)
      )
      .set_post_play_callback(
        (() => {
          this.log.info("post play callback");
        }).bind(this)
      )
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
        }).bind(this)
      )
      .set_scroll_callback(
        ((event, li_index_current, li_total) => {
          if (li_index_current != li_total) return;

          this.log.info("scroll callback");
          this.log.info(`${li_index_current}, ${li_total}`);

          const last_playlist_element = event.target.querySelectorAll("li")[
            li_total - 1
          ];
          const oldest_date = last_playlist_element.getAttribute("timestamp");

          this.log.info(oldest_date);
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
            tracks: 40
          });
        }).bind(this)
      );
  }

  init() {
    this.log.info("Loaded Playlist");

    const element = document.querySelector("#stories-vm");
    this.playlist_component.init(element);

    const preload = JSON.parse(element.getAttribute("data-initial-values"));
    // copied from playlist_backend
    const entries = preload["stories"];
    const track_list = preload["track_list"];
    let tracks = [];
    entries.forEach((item, index) => {
      if (item["item_type"] === "a")
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
        is_purchasable: item["is_purchasable"],
        timestamp: Date.parse(item["story_date"]) / 1000
      };
      tracks.push(track);
    });
    this.playlist_component.appendTracks(tracks);

    // get pre-loaded page data

    this.port.onMessage.addListener(this.playlist_component.appendTracks);
    // set oldest_date with current pre-loaded page data -- or attach to scroll_callback...
    const oldest_date = preload["oldest_story_date"];
    this.port.postMessage({
      route: "fan_activity",
      oldest_story_date: oldest_date,
      tracks: 40
    });
  }
}
