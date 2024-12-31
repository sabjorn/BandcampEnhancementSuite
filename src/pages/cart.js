import Logger from "../logger";

import { createButton, createInputButtonPair } from "../components/buttons.js";
import {
  downloadFile,
  dateString,
  loadJsonFile,
  addAlbumToCart,
  CURRENCY_MINIMUMS,
  getTralbumDetails
} from "../utilities";
import { createShoppingCartItem } from "../components/shoppingCart.js";
import { createPlusSvgIcon } from "../components/svgIcons";

const BES_SUPPORT_TRALBUM_ID = 1609998585;
const BES_SUPPORT_TRALBUM_TYPE = "a";

export default class Cart {
  constructor() {
    this.log = new Logger();

    this.createBesSupportButton = Cart.createBesSupportButton.bind(this);

    // re-import
    this.createButton = createButton;
    this.loadJsonFile = loadJsonFile;
    this.addAlbumToCart = addAlbumToCart;
    this.createShoppingCartItem = createShoppingCartItem;
    this.downloadFile = downloadFile;
    this.reloadWindow = () => location.reload();
    this.getTralbumDetails = getTralbumDetails.bind(this);
    this.createInputButtonPair = createInputButtonPair;
  }

  async init() {
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

          await Promise.all(promises).then(results => {
            if (!results || results.length < 1) {
              return;
            }
            this.reloadWindow();
          });
        } catch (error) {
          this.log.error("Error loading JSON:", error);
        }
      }
    });
    document.querySelector("#sidecartReveal").prepend(importCartButton);

    const exportCartButton = this.createButton({
      className: "buttonLink",
      innerText: "export",
      buttonClicked: () => {
        const { items } = JSON.parse(
          document.querySelector("[data-cart]").getAttribute("data-cart")
        );
        if (items.length < 1) {
          this.log.error("error trying to export cart with length of 0");
          return;
        }

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
        if (tracks_export.length < 1) return;

        const filename = `${date}_${cart_id}_bes_cart_export.json`;
        const data = JSON.stringify({ date, cart_id, tracks_export }, null, 2);
        this.downloadFile(filename, data);
      }
    });
    document.querySelector("#sidecartReveal").append(exportCartButton);

    const cartRefreshButton = this.createButton({
      className: "buttonLink",
      innerText: "⟳",
      buttonClicked: () => this.reloadWindow()
    });
    cartRefreshButton.style.display = "none";
    document.querySelector("#sidecartReveal").append(cartRefreshButton);

    const observer = new MutationObserver(() => {
      const item_list = document.querySelectorAll("#item_list .item");
      const cartDataElement = document.querySelector("[data-cart]");

      if (!cartDataElement) {
        return;
      }
      const actual_cart = JSON.parse(cartDataElement.getAttribute("data-cart"))
        .items;

      cartRefreshButton.style.display =
        item_list.length === actual_cart.length ? "none" : "block";

      exportCartButton.style.display =
        item_list.length === actual_cart.length ? "block" : "none";
    });

    const itemList = document.getElementById("item_list");
    if (itemList) {
      observer.observe(itemList, {
        childList: true
      });
    }

    try {
      const response = await this.getTralbumDetails(
        BES_SUPPORT_TRALBUM_ID,
        BES_SUPPORT_TRALBUM_TYPE
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const tralbumDetails = await response.json();

      const {
        price,
        currency,
        id: tralbumId,
        title: itemTitle,
        is_purchasable,
        type
      } = tralbumDetails;

      if (!is_purchasable) return;

      const minimumPrice = price > 0.0 ? price : CURRENCY_MINIMUMS[currency];
      if (!minimumPrice) {
        this.log.error(
          `could not get minimum price for ${tralbumId}. Skipping adding to cart`
        );
        return;
      }

      const oneClick = this.createBesSupportButton(
        minimumPrice,
        currency,
        tralbumId,
        itemTitle,
        type
      );

      const besSupportText = document.createElement("div");
      besSupportText.innerText = "Support BES";
      besSupportText.className = "bes-support-text";

      const besSupport = document.createElement("div");
      besSupport.className = "bes-support";
      besSupport.append(besSupportText);
      besSupport.append(oneClick);
      document.querySelector("#sidecartSummary").after(besSupport);
    } catch (error) {
      this.log.error(error);
    }
  }

  static createBesSupportButton(price, currency, tralbumId, itemTitle, type) {
    const pair = this.createInputButtonPair({
      inputPrefix: "$",
      inputSuffix: currency,
      inputPlaceholder: price,
      buttonChildElement: createPlusSvgIcon(),
      onButtonClick: value => {
        if (value < price) {
          this.log.error("track price too low");
          return;
        }

        this.addAlbumToCart(tralbumId, value, type).then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const cartItem = this.createShoppingCartItem({
            itemId: tralbumId,
            itemName: itemTitle,
            itemPrice: value,
            itemCurrency: currency
          });

          document.querySelector("#item_list").append(cartItem);
        });
      }
    });
    pair.classList.add("one-click-button-container");

    return pair;
  }
}
