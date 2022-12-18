import Logger from "./logger";
import PlaylistComponent from "./playlist_component";
import { addAlbumToCart } from "./utilities";

export default class Playlist {
  constructor() {
    this.log = new Logger();
    this.playlist_component = new PlaylistComponent(
      () => {
        console.log("play button callback");
      },
      target => {
        console.log(target);
      },
      true,
      (track_id, price) => {
        console.log(`${track_id}, ${price}`);
      },
      mp3_url => {
        console.log(mp3_url);
      },
      (li_index_current, li_total) => {
        // do something like
        // if greater than 50%, get oldest_date from bottom li and
        // run this.port.postMessage({ route: "fan_activity", oldest_date: }) }
      }
    );
    this.port = chrome.runtime.connect(null, { name: "bandcamplabelview" });
  }

  init() {
    this.log.info("Loaded Playlist");

    const element = document.querySelector("#stories-vm");
    this.playlist_component.init(element);

    // get pre-loaded page data

    this.port.onMessage.addListener(this.playlist_component.appendTracks);
    // set oldest_date with current pre-loaded page data -- or attach to scroll_callback...
    this.port.postMessage({ route: "fan_activity" });
  }
}
