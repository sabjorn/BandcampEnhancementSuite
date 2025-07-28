import Logger from "./logger";
import LabelView from "./label_view";
import DownloadHelper from "./download_helper";
import Player from "./player";
import AudioFeatures from "./audioFeatures";
import Cart from "./pages/cart";

const main = async (): Promise<void> => {
  const log = new Logger();

  const lv = new LabelView();
  lv.init();

  const checkIsDownloadPage: Element | null = document.querySelector(".download-item-container");
  if (checkIsDownloadPage) {
    const dh = new DownloadHelper();
    dh.init();
  }

  const checkIsPageWithPlayer: Element | null = document.querySelector("div.inline_player");
  if (
    checkIsPageWithPlayer &&
    window.location.href !== "https://bandcamp.com/"
  ) {
    const player = new Player();
    player.init();

    let config_port: chrome.runtime.Port;
    try {
      config_port = chrome.runtime.connect(null, { name: "bandcamplabelview" });
    } catch (e: any) {
      if (
        e.message?.includes("Error in invocation of runtime.connect in main.js")
      ) {
        log.error(e);
        return;
      } else {
        throw e;
      }
    }

    const audioFeatures = new AudioFeatures(config_port);
    audioFeatures.init();
  }

  const dataBlobElement: Element | null = document.querySelector("[data-blob]");
  if (dataBlobElement) {
    const dataBlobAttr: string | null = dataBlobElement.getAttribute("data-blob");
    if (dataBlobAttr) {
      const { has_cart }: { has_cart: boolean } = JSON.parse(dataBlobAttr);
      if (has_cart) {
        const cart = new Cart();
        await cart.init();
      }
    }
  }
};

main();
