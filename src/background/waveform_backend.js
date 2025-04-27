import Logger from "../logger";

export default class WaveformBackend {
  constructor() {
    this.log = new Logger();
    this.processRequest = WaveformBackend.processRequest.bind(this);
  }

  init() {
    this.log.info("starting waveform backend.");
    chrome.runtime.onMessage.addListener(this.processRequest);
  }

  static processRequest(request, sender, sendResponse) {
    if (request.contentScriptQuery != "renderBuffer") return false;

    this.log.info("url recieved, beginning processing audio.");

    const url = (() => {
      if (request.url.includes("https")) return request.url;
      return "https://t4.bcbits.com/stream/" + request.url;
    })();

    fetch(url)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => {
        let jsonResult = Buffer.from(arrayBuffer).toJSON();
        sendResponse(jsonResult);
      })
      .catch(error => this.log.error(error));

    return true;
  }
}
