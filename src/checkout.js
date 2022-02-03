// bypasses the Checkout step to ask user for contributions
import html from "../html/popup.html";
import { centreElement, addAlbumToCart } from "./utilities.js";
import Logger from "./logger";

const albumsToPurchase = [1609998585];

export default class Checkout {
  constructor() {
    this.log = new Logger();

    this.config;
    this.dialog;
    this.checkout_button_sub;

    this.checkoutButtonClicked = Checkout.checkoutButtonClicked.bind(this);
    this.applyConfig = Checkout.applyConfig.bind(this);
    this.closeDialogAndGoToCart = Checkout.closeDialogAndGoToCart.bind(this);
    this.addAlbumToCart = addAlbumToCart.bind(this);

    this.yesButtonClicked = Checkout.yesButtonClicked.bind(this);
    this.noButtonClicked = Checkout.noButtonClicked.bind(this);

    try {
      this.port = chrome.runtime.connect(null, { name: "bandcamplabelview" });
    } catch (e) {
      if (e.message.includes("Error in invocation of runtime.connect")) {
        this.log.error(e);
        return;
      } else {
        throw e;
      }
    }
  }

  init() {
    this.log.info("Loaded Checkout");

    this.checkout_button_sub = Checkout.replaceCheckoutButton();
    this.checkout_button_sub.addEventListener(
      "click",
      this.checkoutButtonClicked
    );

    this.dialog = Checkout.createDialog();

    this.dialog
      .querySelector("#yes")
      .addEventListener("click", this.yesButtonClicked);

    this.dialog
      .querySelector("#not_now")
      .addEventListener("click", this.closeDialogAndGoToCart);

    this.dialog
      .querySelector("#no")
      .addEventListener("click", this.noButtonClicked);

    this.dialog.querySelector("#bes_close").addEventListener("click", () => {
      this.dialog.style.display = "none";
    });

    this.port.onMessage.addListener(this.applyConfig);
    this.port.postMessage({ requestConfig: {} }); // TO DO: this must be at end of init
  }

  static applyConfig(msg) {
    this.log.info("config recieved from backend" + JSON.stringify(msg.config));
    this.config = msg.config;
  }

  static checkoutButtonClicked() {
    if (
      !this.config.albumOnCheckoutDisabled &&
      !this.config.albumPurchasedDuringCheckout
    ) {
      this.dialog.style.display = "block";
      return;
    }

    this.closeDialogAndGoToCart();
  }

  static closeDialogAndGoToCart() {
    this.dialog.style.display = "none";

    const clickEvent = new MouseEvent("click", {
      view: window,
      bubbles: true,
      cancelable: false
    });
    let checkout_button = document.querySelector("#sidecartCheckout");
    checkout_button.dispatchEvent(clickEvent);
  }

  static yesButtonClicked() {
    let unit_price = parseFloat(this.dialog.querySelector("input").value);
    this.log.info(`price ${unit_price}`);

    let error_div = this.dialog.querySelector("#bes_checkout_error");
    error_div.innerHTML = " ";
    if (unit_price < 5) {
      error_div.innerHTML = "value entered is under $5.00 CAD";
      return;
    }

    this.log.info(`add ${albumsToPurchase} to cart`);
    this.addAlbumToCart(albumsToPurchase, unit_price)
      .then(() => {
        this.log.info("update config");
        this.port.postMessage({
          config: { albumPurchasedDuringCheckout: true }
        });
      })
      .finally(() => {
        this.closeDialogAndGoToCart();
      });
  }

  static noButtonClicked() {
    this.port.postMessage({ config: { albumOnCheckoutDisabled: true } });
    this.closeDialogAndGoToCart();
  }

  static replaceCheckoutButton() {
    let checkout_button = document.querySelector("#sidecartCheckout");

    let sidecart_footer = document.querySelector("#sidecartFooter");
    let checkout_button_sub = document.createElement("a");
    checkout_button_sub.className = "buttonLink notSkinnable";
    checkout_button_sub.innerHTML = checkout_button.innerHTML;

    sidecart_footer.appendChild(checkout_button_sub);

    checkout_button.style.display = "none";
    return checkout_button_sub;
  }

  static createDialog() {
    const element = document.createElement("div");
    element.insertAdjacentHTML("beforeend", html);

    const dialog = element.querySelector(".ui-dialog");

    window.document.body.appendChild(dialog);

    return dialog;
  }
}
