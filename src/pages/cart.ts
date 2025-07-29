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


interface CartData {
  items: any[];
}

// Main initialization function (replaces Cart class)
export async function initCart(): Promise<void> {
  const log = new Logger();
  log.info("cart init");

    const importCartButton = createButton({
      className: "buttonLink",
      innerText: "import",
      buttonClicked: async () => {
        try {
          const { tracks_export } = await loadJsonFile();
          const promises = tracks_export.map(track =>
            addAlbumToCart(
              track.item_id,
              track.unit_price,
              track.item_type
            ).then(response => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }

              const cartItem = createShoppingCartItem({
                itemId: track.item_id,
                itemName: track.item_title,
                itemPrice: track.unit_price,
                itemCurrency: track.currency
              });

              const itemList = document.querySelector("#item_list");
              if (itemList) {
                itemList.append(cartItem);
              }
            })
          );

          await Promise.all(promises).then(results => {
            if (!results || results.length < 1) {
              return;
            }
            location.reload();
          });
        } catch (error) {
          log.error("Error loading JSON: " + String(error));
        }
      }
    });
    const sidecartReveal = document.querySelector("#sidecartReveal");
    if (sidecartReveal) {
      sidecartReveal.prepend(importCartButton);
    }

    const exportCartButton = createButton({
      className: "buttonLink",
      innerText: "export",
      buttonClicked: () => {
        const cartElement = document.querySelector("[data-cart]");
        const cartData = cartElement?.getAttribute("data-cart");
        if (!cartData) return;
        
        const { items }: CartData = JSON.parse(cartData);
        if (items.length < 1) {
          log.error("error trying to export cart with length of 0");
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
        downloadFile(filename, data);
      }
    });
    const sidecartReveal2 = document.querySelector("#sidecartReveal");
    if (sidecartReveal2) {
      sidecartReveal2.append(exportCartButton);
    }

    const cartRefreshButton = createButton({
      className: "buttonLink",
      innerText: "⟳",
      buttonClicked: () => location.reload()
    });
    cartRefreshButton.style.display = "none";
    const sidecartReveal3 = document.querySelector("#sidecartReveal");
    if (sidecartReveal3) {
      sidecartReveal3.append(cartRefreshButton);
    }

    const observer = new MutationObserver(() => {
      const item_list = document.querySelectorAll("#item_list .item");
      const cartDataElement = document.querySelector("[data-cart]");

      if (!cartDataElement) {
        return;
      }
      const actual_cart = JSON.parse(cartDataElement.getAttribute("data-cart")!)
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
      const response = await getTralbumDetails(
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
        log.error(
          `could not get minimum price for ${tralbumId}. Skipping adding to cart`
        );
        return;
      }

      const oneClick = createBesSupportButton(
        minimumPrice,
        currency,
        tralbumId,
        itemTitle,
        type,
        log
      );

      const besSupportText = document.createElement("div");
      besSupportText.innerText = "Support BES";
      besSupportText.className = "bes-support-text";

      const besSupport = document.createElement("div");
      besSupport.className = "bes-support";
      besSupport.append(besSupportText);
      besSupport.append(oneClick);
      const sidecartSummary = document.querySelector("#sidecartSummary");
      if (sidecartSummary) {
        sidecartSummary.after(besSupport);
      }
    } catch (error) {
      log.error(error);
    }
  }


export function createBesSupportButton(
  price: number, 
  currency: string, 
  tralbumId: string, 
  itemTitle: string, 
  type: string, 
  log: Logger
): HTMLElement {
  const pair = createInputButtonPair({
    inputPrefix: "$",
    inputSuffix: currency,
    inputPlaceholder: price,
    buttonChildElement: createPlusSvgIcon() as HTMLElement,
    onButtonClick: value => {
      const numericValue = typeof value === 'string' ? parseFloat(value) : value;
      if (numericValue < price) {
        log.error("track price too low");
        return;
      }

      addAlbumToCart(tralbumId, numericValue, type).then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const cartItem = createShoppingCartItem({
          itemId: tralbumId,
          itemName: itemTitle,
          itemPrice: numericValue,
          itemCurrency: currency
        });

        const itemList = document.querySelector("#item_list");
        if (itemList) {
          itemList.append(cartItem);
        }
      });
    }
  });
  pair.classList.add("one-click-button-container");

  return pair;
}
