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
        return mp3_url;
      }
    );
    this.port = chrome.runtime.connect(null, { name: "bandcamplabelview" });
  }

  init() {
    this.log.info("Loaded Playlist");
    const element = document.querySelector("#stories-vm");
    element.innerHTML = PlaylistComponent.getHtml();

    this.playlist_component.init();
    this.port.onMessage.addListener(this.playlist_component.appendTracks);
    this.port.postMessage({ route: "fan_activity" });
    let track = {
      track_id: 1234,
      artist: "dataist",
      title: "suppar",
      label: "HPR",
      price: 1.12,
      currency: "CAD",
      currently_playing: false,
      album_art_url: "https://f4.bcbits.com/img/a3459425415_16.jpg",
      stream_url:
        "https://t4.bcbits.com/stream/df7edd0d34e6f2889d7a5b42fc55a4f1/mp3-128/310533014?p=0&ts=1671164046&t=727e8d383b64c81df6c1e70d94d351525b274054&token=1671164046_ed35dc738c6944d01fa8114bdcf6db37a066ef30",
      link_url:
        "https://halfpastvibe.bandcamp.com/track/lusttropfen-hidonash-remix"
    };
    this.playlist_component.appendTracks([track, track]);
  }
}
