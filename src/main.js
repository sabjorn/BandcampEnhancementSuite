import Logger from "./logger";
import LabelView from "./label_view.js";
import DownloadHelper from "./download_helper.js";
import Player from "./player.js";
import AudioFeatures from "./audioFeatures.js";
import Checkout from "./checkout.js";
import Cart from "./pages/cart";

import { getTralbumDetails } from "./utilities";

const main = () => {
  const log = new Logger();

  const buyMusicClubListPage = document.querySelector("#__NEXT_DATA__");
  if (buyMusicClubListPage) {
    log.info("Starting BuyMusic.club BES integration");
    const { props } = JSON.parse(buyMusicClubListPage.innerHTML);
    log.debug(JSON.stringify(props.pageProps.list.ListItems[0], null, 2));
    props.pageProps.list.ListItems.forEach(
      ({ externalId: tralbum_id, type }) => {
        const tralbum_type = type === "song" ? "t" : "a";
        // this has to be moved to worker because of CORS
        //  getTralbumDetails(tralbum_id, tralbum_type)
        //    .then(response => {
        //      if (!response.ok) {
        //        throw new Error(`HTTP error! status: ${response.status}`);
        //      }
        //      return response.json();
        //    })
        //    .then(tralbumDetails => {
        //      const {
        //        price,
        //        currency,
        //        album_id: tralbumId,
        //        title: itemTitle,
        //        is_purchasable,
        //        type
        //      } = tralbumDetails;
        //    });
      }
    );

    return;
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
