import Logger from "./logger";
import LabelView from "./label_view.js";
import DownloadHelper from "./download_helper.js";
import Player from "./player.js";
import AudioFeatures from "./audioFeatures.js";
import Checkout from "./checkout.js";
import Cart from "./pages/cart";

import { dateString, downloadFile } from "./utilities";
import { createButton } from "./components/buttons";

const main = () => {
  const log = new Logger();

  const buyMusicClubListPage = document.querySelector("#__NEXT_DATA__");
  if (buyMusicClubListPage) {
    log.info("Starting BuyMusic.club BES integration");

    const button = createButton({
      className: "test",
      innerText: "download",
      buttonClicked: () => {
        log.info("BuyMusic.club button clicked");
        const { props } = JSON.parse(buyMusicClubListPage.innerHTML);
        const promises = props.pageProps.list.ListItems.map(
          item =>
            new Promise((resolve, reject) => {
              chrome.runtime.sendMessage(
                {
                  contentScriptQuery: "getTralbumDetails",
                  item_id: item.externalId,
                  item_type: item.type === "song" ? "t" : "a"
                },
                response => {
                  if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                  } else {
                    resolve(response);
                  }
                }
              );
            })
        );

        // Wait for all promises to resolve
        Promise.all(promises)
          .then(results => {
            const date = dateString();
            const tracks_export = results
              .filter(
                item => item.type === "t" // || item.item_type === "a" // need to handle albums differently
              )
              .filter(item => item.tracks[0].is_purchasable === true)
              .flatMap(item =>
                item.tracks.map(track => ({
                  band_name: track.band_name,
                  item_id: track.track_id,
                  item_title: track.title,
                  unit_price: track.price,
                  url: item.bandcamp_url,
                  currency: track.currency,
                  item_type: item.type
                }))
              );
            if (tracks_export.length < 1) return;

            const filename = `${date}_buymusic-club_bes_cart_export.json`;
            const { name, title, timestamp } = props.pageProps.list;
            const data = JSON.stringify(
              {
                date,
                playlist_username: name,
                playlist_title: title,
                timestamp,
                tracks_export
              },
              null,
              2
            );
            downloadFile(filename, data);
          })
          .catch(error => {
            log.error(
              `Error processing items: ${JSON.stringify(error, null, 2)}`
            );
          });
        return;
      }
    });

    document.querySelector(".mb3").append(button);
  }
  const lv = new LabelView();
  lv.init();

  let checkIsDownloadPage = document.querySelector(".download-item-container");
  if (checkIsDownloadPage) {
    const dh = new DownloadHelper();
    dh.init();
  }

  let checkIsPageWithPlayer = document.querySelector("div.inline_player");
  if (
    checkIsPageWithPlayer &&
    window.location.href != "https://bandcamp.com/"
  ) {
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

    let audioFeatures = new AudioFeatures(config_port);
    audioFeatures.init();

    let checkout = new Checkout(config_port);
    checkout.init();
  }

  const { has_cart } = JSON.parse(
    document.querySelector("[data-blob]").getAttribute("data-blob")
  );
  if (has_cart) {
    const cart = new Cart();
    cart.init();
  }
};

main();
