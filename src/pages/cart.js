import Logger from "../logger";

import { createButton } from "../components/buttons.js";
import { downloadFile, dateString } from "../utilities";

export default class Cart {
  constructor() {
    this.log = new Logger();

    this.createButton = createButton;
  }

  init() {
    this.log.info("cart init");

    const cartRefreshButton = this.createButton({
      className: "buttonLink",
      innerText: "⟳",
      buttonClicked: () => location.reload()
    });
    document.querySelector("#sidecartReveal").append(cartRefreshButton);
  }
}
