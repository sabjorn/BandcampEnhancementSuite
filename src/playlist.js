import Logger from "./logger";
import PlaylistComponent from "./playlist_component";
import { addAlbumToCart } from "./utilities";

export default class Playlist {
  constructor() {
    this.log = new Logger();
    this.playlist_component = new PlaylistComponent(true);
    this.playlist_component
      .set_play_button_callback(() => {
        console.log("play button callback");
      })
      .set_delete_button_callback(target => {
        console.log("delete button callback");
        console.log(target);
      })
      .set_purchase_button_callback((track_id, price) => {
        console.log("purchase button callback");
        console.log(`${track_id}, ${price}`);
      })
      .set_check_url_callback(mp3_url => {
        console.log("check url callback");
        console.log(mp3_url);
      })
      .set_scroll_callback((event, li_index_current, li_total) => {
        console.log("scroll callback");
        console.log(event.target);
        console.log(`${li_index_current}, ${li_total}`);
        // do something like
        // if greater than 50%, get oldest_date from bottom li and
        // run this.port.postMessage({ route: "fan_activity", oldest_date: }) }
      });

    this.port = chrome.runtime.connect(null, { name: "bandcamplabelview" });
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
      oldest_story_date: oldest_date
    });
  }
}
