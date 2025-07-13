// bypasses the Checkout step to ask user for contributions
import html from "../html/popup.html";
import { addAlbumToCart } from "./utilities.js";
import Logger from "./logger";

interface PortMessage {
  onMessage: {
    addListener: (callback: (message: any) => void) => void;
  };
  postMessage: (message: any) => void;
}

interface CheckoutConfig {
  installDateUnixSeconds: number;
  albumPurchaseTimeDelaySeconds: number;
  albumOnCheckoutDisabled: boolean;
  albumPurchasedDuringCheckout: boolean;
}

interface ConfigMessage {
  config: CheckoutConfig;
}

const albumsToPurchase = [1609998585];

export default class Checkout {
  public log: Logger;
  public config?: CheckoutConfig;
  public dialog?: HTMLElement;
  public checkout_button_sub?: HTMLElement;
  public port: PortMessage;
  public checkoutButtonClicked: () => void;
  public applyConfig: (msg: ConfigMessage) => void;
  public closeDialogAndGoToCart: () => void;
  public addAlbumToCart: (item_id: string | number, unit_price: string | number, item_type?: string) => Promise<Response>;
  public yesButtonClicked: () => void;
  public noButtonClicked: () => void;

  constructor(port: PortMessage) {
    this.log = new Logger();

    this.checkoutButtonClicked = this.checkoutButtonClickedImpl.bind(this);
    this.applyConfig = this.applyConfigImpl.bind(this);
    this.closeDialogAndGoToCart = this.closeDialogAndGoToCartImpl.bind(this);
    this.addAlbumToCart = addAlbumToCart.bind(this);

    this.yesButtonClicked = this.yesButtonClickedImpl.bind(this);
    this.noButtonClicked = this.noButtonClickedImpl.bind(this);

    this.port = port;
  }

  init(): void {
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

  applyConfigImpl(msg: ConfigMessage): void {
    this.log.info("config recieved from backend" + JSON.stringify(msg.config));
    this.config = msg.config;
  }

  static applyConfig(_msg: ConfigMessage): void {
    // Legacy static method - not used
  }

  checkoutButtonClickedImpl(): void {
    const enough_time_passed =
      Date.now() / 1000 - this.config!.installDateUnixSeconds >
      this.config!.albumPurchaseTimeDelaySeconds;
    if (
      !this.config!.albumOnCheckoutDisabled &&
      !this.config!.albumPurchasedDuringCheckout &&
      enough_time_passed
    ) {
      this.dialog!.style.display = "block";
      return;
    }

    this.closeDialogAndGoToCart();
  }

  static checkoutButtonClicked(): void {
    // Legacy static method - not used
  }

  closeDialogAndGoToCartImpl(): void {
    this.dialog!.style.display = "none";

    const clickEvent = new MouseEvent("click", {
      view: window,
      bubbles: true,
      cancelable: false
    });
    const checkout_button = document.querySelector("#sidecartCheckout");
    if (checkout_button) {
      checkout_button.dispatchEvent(clickEvent);
    }
  }

  static closeDialogAndGoToCart(): void {
    // Legacy static method - not used
  }

  yesButtonClickedImpl(): void {
    const inputElement = this.dialog!.querySelector("input") as HTMLInputElement;
    if (!inputElement) return;
    
    const unit_price = parseFloat(inputElement.value);
    this.log.info(`price ${unit_price}`);

    const error_div = this.dialog!.querySelector("#bes_checkout_error");
    if (!error_div) return;
    error_div.innerHTML = " ";
    if (unit_price < 5) {
      error_div.innerHTML = "value entered is under $5.00 CAD";
      return;
    }

    this.log.info(`add ${albumsToPurchase} to cart`);
    this.addAlbumToCart(albumsToPurchase[0], unit_price)
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

  static yesButtonClicked(): void {
    // Legacy static method - not used
  }

  noButtonClickedImpl(): void {
    this.port.postMessage({ config: { albumOnCheckoutDisabled: true } });
    this.closeDialogAndGoToCart();
  }

  static noButtonClicked(): void {
    // Legacy static method - not used
  }

  static replaceCheckoutButton(): HTMLElement {
    const checkout_button = document.querySelector("#sidecartCheckout");
    const sidecart_footer = document.querySelector("#sidecartFooter");
    
    if (!checkout_button || !sidecart_footer) {
      return document.createElement("div");
    }

    const checkout_button_sub = document.createElement("a");
    checkout_button_sub.className = "buttonLink notSkinnable";
    checkout_button_sub.innerHTML = checkout_button.innerHTML;

    sidecart_footer.appendChild(checkout_button_sub);

    (checkout_button as HTMLElement).style.display = "none";
    return checkout_button_sub;
  }

  static createDialog(): HTMLElement {
    const element = document.createElement("div");
    element.insertAdjacentHTML("beforeend", html);

    const dialog = element.querySelector("#bes_wrapper");
    if (!dialog) {
      throw new Error("Failed to create dialog element");
    }

    window.document.body.appendChild(dialog);

    return dialog as HTMLElement;
  }
}
