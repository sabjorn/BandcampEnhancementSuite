import Logger from "./logger";
import DownloadHelper from "./download_helper";
import { getUrl, getClientId } from "./utilities";

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

      let export_tracks = [];
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
      DownloadHelper.download(
        `${date}_cart.json`,
        JSON.stringify(export_tracks, null, 2)
      );
    });

    const import_button = document.createElement("button");
    import_button.textContent = "import";
    import_button.addEventListener("click", () => {
      const file_input = document.createElement("input");
      file_input.type = "file";

      file_input.addEventListener("change", event => {
        const fr = new FileReader();

        fr.addEventListener("load", () => {
          const data = JSON.parse(fr.result);
          data.forEach(item => {
            const url = getUrl();
            const client_id = getClientId();
            this.log.error(`item.id: ${item.id} is not correct :(`);
            fetch(`https://${url}/cart/cb`, {
              headers: {
                accept: "application/json, text/javascript, */*; q=0.01",
                "accept-language": "en-US,en;q=0.9,ar;q=0.8",
                "content-type": "application/x-www-form-urlencoded",
                "sec-ch-ua":
                  '"Not?A_Brand";v="8", "Chromium";v="108", "Google Chrome";v="108"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"macOS"',
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "x-requested-with": "XMLHttpRequest"
              },
              referrer:
                "https://urbanstghetto.bandcamp.com/track/what-u-gonna-do",
              referrerPolicy: "no-referrer-when-downgrade",
              body: `req=add&local_id=&item_type=${item.type}&item_id=3582474048&base_price=1&unit_price=1&quantity=1&option_id&discount_id&discount_type&download_type&download_id&purchase_note&notify_me&notify_me_label&band_id=&releases&ip_country_code=CA&associated_license_id&checkout_now&shipping_exception_mode&is_cardable=&cart_length=2&fan_id=&client_id=${client_id}&sync_num=&req_id=`,
              method: "POST",
              mode: "cors",
              credentials: "include"
            })
              .then(response => response.text())
              .then(result => location.reload())
              .catch(error => {
                this.log.error(error);
              });
          });
        });

        fr.readAsText(event.target.files[0]);
      });

      file_input.click();
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
