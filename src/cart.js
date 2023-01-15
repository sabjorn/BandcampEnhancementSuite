import Logger from "./logger";
import DownloadHelper from "./download_helper";

export default class Cart {
  constructor() {
    this.log = new Logger();
  }

  init() {
    this.log.info("Cart started");

    const export_button = document.createElement("button");
    export_button.textContent = "export";

    export_button.addEventListener("click", event => {
      const cart_items = document
        .getElementById("item_list")
        .querySelectorAll(".item");

      let export_tracks = []
      cart_items.forEach(item => {
        const id = item.id.split("sidecart_item_")[1];
        const url = item.querySelector(".itemName").href;
        const name = item.querySelector(".itemName").textContent.split(",")[0];
        const type = item
          .querySelector(".itemName")
          .textContent.includes("track")
          ? "t"
          : "a";
        const price = item
          .querySelector(".price")
          .textContent.split(" ")[0]
          .substr(1);
        const currency = item.querySelector(".price").textContent.split(" ")[1];
        export_tracks.push({
            id: id,
            url: url,
            name: name,
            type: type,
            price: price,
            currency: currency
            });
        });

        const date = DownloadHelper.dateString();
        DownloadHelper.download(`${date}_cart.json`, JSON.stringify(export_tracks));
    });

    const import_button = document.createElement("button");
    import_button.textContent = "import";
    import_button.addEventListener("click", event => {
      console.log(event.target);
    });

    const clear_button = document.createElement("button");
    clear_button.textContent = "clear";
    clear_button.addEventListener("click", event => {
      console.log(event.target);
    });

    const cart = document.querySelector("#sidecart");
    cart.append(export_button);
    cart.append(import_button);
    cart.append(clear_button);
  }
}
