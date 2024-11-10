import Logger from "../logger";

import { createButton } from "../components/buttons.js";
import {
  downloadFile,
  dateString,
  loadJsonFile,
  addAlbumToCart
} from "../utilities";
import { createShoppingCartItem } from "../components/shoppingCart.js";

export default class Cart {
  constructor() {
    this.log = new Logger();

    // re-import
    this.createButton = createButton;
    this.loadJsonFile = loadJsonFile;
    this.addAlbumToCart = addAlbumToCart;
    this.createShoppingCartItem = createShoppingCartItem;
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

              const cartItem = this.createShoppingCartItem({
                itemId: track.item_id,
                itemName: track.item_title,
                itemPrice: track.unit_price,
                itemCurrency: track.currency
              });

              document.querySelector("#item_list").append(cartItem);
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
        const tracks_export = items
          .filter(item => item.item_type === "a" || item.item_type === "t")
          .map(
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
    document.querySelector("#sidecartReveal").append(exportCartButton);

    const cartRefreshButton = this.createButton({
      className: "buttonLink",
      innerText: "⟳",
      buttonClicked: () => location.reload()
    });
    document.querySelector("#sidecartReveal").append(cartRefreshButton);

    const observer = new MutationObserver(() => {
      const itemListCount = document.querySelectorAll("#item_list .item")
        .length;
      const cartDataElement = document.querySelector("[data-cart]");

      if (!cartDataElement) {
        return;
      }
      const actual_cart_length = JSON.parse(
        cartDataElement.getAttribute("data-cart")
      ).items.length;

      exportCartButton.style.display =
        itemListCount === actual_cart_length.length ? "block" : "none";
    });

    const itemList = document.getElementById("item_list");
    if (itemList) {
      observer.observe(itemList, {
        childList: true
      });
    }
  }
}
