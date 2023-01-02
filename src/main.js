import Logger from "./logger";
import LabelView from "./label_view.js";
import DownloadHelper from "./download_helper.js";
import Player from "./player.js";
import Waveform from "./waveform.js";
import Checkout from "./checkout.js";
import FeedPlaylist from "./playlist/feed_playlist.js";
import CollectionPlaylist from "./playlist/collection_playlist.js";
import DiscographyPlaylist from "./playlist/discography_playlist.js";

window.onload = () => {
  const log = new Logger();

  let is_download_page = document.querySelector(".download-item-container");
  if (is_download_page) {
    const dh = new DownloadHelper();
    dh.init();
  }

  let is_page_with_player = document.querySelector("div.inline_player");
  if (is_page_with_player && window.location.href != "https://bandcamp.com/") {
    const player = new Player();
    player.init();

    let config_port;
    try {
      config_port = chrome.runtime.connect(null, { name: "bandcamplabelview" });
    } catch (e) {
      if (
        e.message.includes("Error in invocation of runtime.connect in main.js")
      ) {
        log.error(e);
        return;
      } else {
        throw e;
      }
    }

    let waveform = new Waveform(config_port);
    waveform.init();

    let checkout = new Checkout(config_port);
    checkout.init();
  }
  const pagetype = document
    .querySelector("[property='og:type']")
    .getAttribute("content");
  if (pagetype === "band") {
    const discography_playlist = new DiscographyPlaylist();
    discography_playlist.init();
  }
  if (window.location.href.includes("feed")) {
    const feed_playlist = new FeedPlaylist();
    feed_playlist.init();
  }
  if (document.querySelector("title").innerHTML.includes("collection")) {
    const collection_playlist = new CollectionPlaylist();
    collection_playlist.init();
  }
};
