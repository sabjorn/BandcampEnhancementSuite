import Logger from "./logger";
import LabelView from "./label_view.js";
import DownloadHelper from "./download_helper.js";
import Player from "./player.js";
import Waveform from "./waveform.js";
import Checkout from "./checkout.js";
import Playlist from "./playlist.js";
import PlaylistComponent from "./playlist_component.js";

window.onload = () => {
  const log = new Logger();

  //const lv = new LabelView();
  //lv.init();

  //let checkIsDownloadPage = document.querySelector(".download-item-container");
  //if (checkIsDownloadPage) {
  //  const dh = new DownloadHelper();
  //  dh.init();
  //}

  //let checkIsPageWithPlayer = document.querySelector("div.inline_player");
  //if (
  //  checkIsPageWithPlayer &&
  //  window.location.href != "https://bandcamp.com/"
  //) {
  //  const player = new Player();
  //  player.init();

  //  let config_port;
  //  try {
  //    config_port = chrome.runtime.connect(null, { name: "bandcamplabelview" });
  //  } catch (e) {
  //    if (
  //      e.message.includes("Error in invocation of runtime.connect in main.js")
  //    ) {
  //      log.error(e);
  //      return;
  //    } else {
  //      throw e;
  //    }
  //  }

  //  let waveform = new Waveform(config_port);
  //  waveform.init();

  //  let checkout = new Checkout(config_port);
  //  checkout.init();
  //}

  //let playlist = new Playlist();
  //playlist.init();
  let playlist_component = new PlaylistComponent(
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
      return "https://sabjorn.net";
    }
  );
  playlist_component.init();

  let track = {
    track_id: 1234,
    price: 1.12,
    currency: "CAD",
    artist: "dataist",
    title: "suppar",
    label: "HPR",
    currently_playing: false,
    album_art_url: "https://f4.bcbits.com/img/a3459425415_16.jpg",
    stream_url:
      "https://t4.bcbits.com/stream/df7edd0d34e6f2889d7a5b42fc55a4f1/mp3-128/310533014?p=0&ts=1671164046&t=727e8d383b64c81df6c1e70d94d351525b274054&token=1671164046_ed35dc738c6944d01fa8114bdcf6db37a066ef30",
    link_url:
      "https://halfpastvibe.bandcamp.com/track/lusttropfen-hidonash-remix"
  };
  playlist_component.appendTracks([track]);
};
