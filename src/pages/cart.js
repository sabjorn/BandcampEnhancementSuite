import Logger from "../logger";

import { createButton } from "../components/buttons.js";
import {
  downloadFile,
  dateString,
  loadJsonFile,
  addAlbumToCart
} from "../utilities";

export default class Cart {
  constructor() {
    this.log = new Logger();

    this.createButton = createButton;
    this.loadJsonFile = loadJsonFile;
    this.addAlbumToCart = addAlbumToCart;
  }

  init() {
    this.log.info("cart init");

    const importCartButton = this.createButton({
      className: "buttonLink",
      innerText: "import",
      buttonClicked: async () => {
        try {
          const { tracks_export } = await this.loadJsonFile();
          const promises = tracks_export.map(track =>
            this.addAlbumToCart(
              track.item_id,
              track.unit_price,
              track.item_type
            ).then(response => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
            })
          );

          await Promise.all(promises);

          location.reload();
        } catch (error) {
          this.log.error("Error loading JSON:", error);
        }
      }
    });
    document.querySelector("#sidecartReveal").append(importCartButton);
    //
    // call cart mods might need to go somewhere else because cart is on multuple pages...
    const exportCartButton = this.createButton({
      className: "buttonLink",
      innerText: "export",
      buttonClicked: () => {
        const { items } = JSON.parse(
          document.querySelector("[data-cart]").getAttribute("data-cart")
        );
        if (items.length < 1) return;

        const cart_id = items[0].cart_id;
        const date = dateString();
        const tracks_export = items.map(
          ({
            band_name,
            item_id,
            item_title,
            unit_price,
            url,
            currency,
            item_type
          }) => ({
            band_name,
            item_id,
            item_title,
            unit_price,
            url,
            currency,
            item_type
          })
        );

        const filename = `${date}_${cart_id}_bes_cart_export.json`;
        const data = JSON.stringify({ date, cart_id, tracks_export }, null, 2);
        downloadFile(filename, data);
      }
    });
    // how do we check that cart is ready for export? might need to disable
    // if added from 1-click buy
    // we actually have to worry about when the cart has been modified by us
    // OR when users add with the regular method (becasue the data in the script wont be correct anymore)
    // (unless it is, you need ot check)
    // othweise -- need an observer to modify this any time the cart object changes
    // and then it will just check for if the # of items is different?
    document.querySelector("#sidecartReveal").append(exportCartButton);

    const cartRefreshButton = this.createButton({
      className: "buttonLink",
      innerText: "⟳",
      buttonClicked: () => location.reload()
    });
    document.querySelector("#sidecartReveal").append(cartRefreshButton);
  }
}
