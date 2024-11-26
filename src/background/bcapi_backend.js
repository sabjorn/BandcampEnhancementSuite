import Logger from "../logger";
import { getTralbumDetails } from "../utilities";

export default class BCAPIBackend {
  constructor() {
    this.log = new Logger();
    this.processRequest = BCAPIBackend.processRequest.bind(this);
  }

  init() {
    this.log.info("starting waveform backend.");
    chrome.runtime.onMessage.addListener(this.processRequest);
  }

  static processRequest(request, sender, sendResponse) {
    if (request.contentScriptQuery === "getTralbumDetails") {
      this.log.info("getTralbumDetails request recieved");

      const { item_id, item_type } = request;
      getTralbumDetails(item_id, item_type)
        .then(response => response.json())
        .then(jsonResult => {
          //this.log.debug(
          //  `got response: ${JSON.stringify(jsonResult, null, 2)}`
          //);
          sendResponse(jsonResult);
        })
        .catch(error => {
          this.log.error(error);
        });

      return true;
    }

    if (request.contentScriptQuery === "getCartID") {
      chrome.cookies.get(
        {
          url: "https://bandcamp.com/",
          name: "cart_client_id"
        },
        cookie => {
          if (!cookie) {
            return;
          }
          sendResponse({ cart_client_id: cookie.value });
        }
      );
      return true;
    }

    if (request.contentScriptQuery === "addToCart") {
      this.log.info("addToCart request recieved");
      const { item_id, item_type, unit_price, cart_client_id } = request;
      fetch("https://halfpastvibe.bandcamp.com/cart/cb", {
        headers: {
          accept: "application/json, text/javascript, */*; q=0.01",
          "accept-language": "en-US,en;q=0.9,ar;q=0.8",
          "cache-control": "no-cache",
          "content-type": "application/x-www-form-urlencoded",
          pragma: "no-cache",
          priority: "u=1, i",
          "sec-ch-ua":
            '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "x-requested-with": "XMLHttpRequest",
          cookie: `cart_client_id=${cart_client_id}`
        },
        referrer: "https://halfpastvibe.bandcamp.com/track/handschuh",
        referrerPolicy: "no-referrer-when-downgrade",
        body: `req=add&local_id=0.10689294733389665&item_type=${item_type}&item_id=${item_id}&unit_price=${unit_price}&quantity=1&option_id&discount_id&discount_type&download_type&download_id&purchase_note&notify_me&notify_me_label&band_id=857243381&releases&ip_country_code=CA&associated_license_id&checkout_now&shipping_exception_mode&is_cardable=true&cart_length=6&fan_id=896389&ref_token=326949274i857243381t2216785535x1732597451&client_id&sync_num=516&req_id=0.9550041015683621`,
        method: "POST",
        mode: "cors"
      }).then(response => this.log.info(JSON.stringify(response, null, 2)));
    }
  }
}
