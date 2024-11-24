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
    if (request.contentScriptQuery != "getTralbumDetails") return false;

    this.log.info("getTralbumDetails request recieved");

    const { item_id, item_type } = request;
    getTralbumDetails(item_id, item_type)
      .then(response => response.json())
      .then(jsonResult => {
        this.log.debug(`got response: ${JSON.stringify(jsonResult, null, 2)}`);
        sendResponse(jsonResult);
      })
      .catch(error => this.log.error(error));

    return true;
  }
}
