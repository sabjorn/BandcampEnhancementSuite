import Logger from "./logger";
import LabelView from "./label_view.js";
import DownloadHelper from "./download_helper.js";
import Player from "./player.js";
import AudioFeatures from "./audioFeatures.js";
import Cart from "./pages/cart";

const main = async () => {
  const log = new Logger();

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
  }

  const { has_cart } = JSON.parse(
    document.querySelector("[data-blob]").getAttribute("data-blob")
  );
  if (has_cart) {
    const cart = new Cart();
    await cart.init();
  }
};

main();
