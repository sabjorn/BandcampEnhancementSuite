import Logger from "../logger";
import PlaylistComponent from "../component/playlist_component";
import { addAlbumToCart, getAudioBuffer } from "../utilities";
import { wishlistCallback } from "./utilities";

export default class DiscographyPlaylist {
  constructor() {
    this.log = new Logger();
    this.port = chrome.runtime.connect(null, { name: "bandcamplabelview" });

    this.playlist_component = new PlaylistComponent(true, false, false, true);
    this.playlist_component
      .set_post_play_callback(getAudioBuffer)
      .set_purchase_button_callback(
        ((track_id, price) => {
          this.log.info("puchase button callback");
          this.log.info(`${track_id}, ${price}`);
          return addAlbumToCart(track_id, price, "t");
        }).bind(this)
      )
      .set_wishlist_button_callback(target => {
        const data_blob = JSON.parse(
          document.querySelector("#pagedata").getAttribute("data-blob")
        );
        const fan_id = data_blob.identities.fan.id;
        wishlistCallback(target, fan_id, this.log);
      })
      .set_post_add_track_callback(target => {
        Array.from(document.querySelectorAll("ul > li[timestamp]"))
          .sort((a, b) => {
            a = a.getAttribute("timestamp");
            b = b.getAttribute("timestamp");
            return b.localeCompare(a);
          })
          .forEach(item => item.parentNode.appendChild(item));
      });
  }

  init() {
    this.log.info("Loaded DiscographyPlaylist");

    DiscographyPlaylist.addCss(
      "https://s4.bcbits.com/bundle/bundle/1/collection-761653daa0b4a79f5a402f1d370ebc9d.css"
    );
    // need to capture this BEFORE replacing the html with playlist_component;
    let messages = [];
    document.querySelectorAll("[data-item-id]").forEach(element => {
      const tralbum_type = element.getAttribute("data-item-id").at(0);
      const band_id = element.getAttribute("data-band-id");
      const tralbum_id = element.getAttribute("data-item-id").split("-")[1];

      messages.push({
        route: "tralbum_details",
        tralbum_type: tralbum_type,
        band_id: band_id,
        tralbum_id: tralbum_id
      });
    });
    const element = document.querySelector(".leftMiddleColumns");
    this.playlist_component.init(element);

    this.port.onMessage.addListener(
      (tracks => {
        this.playlist_component.appendTracks(tracks);
      }).bind(this)
    );

    messages.forEach(message => {
      this.port.postMessage(message);
    });
  }

  static addCss(fileName) {
    var head = document.head;
    var link = document.createElement("link");

    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = fileName;

    head.appendChild(link);
  }
}
