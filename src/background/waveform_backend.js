import Logger from "../logger";

const log = new Logger();

const processRequest = (request, sender, sendResponse) => {
  log.info("hi");
  return true;
};

export const initWaveformBackend = () => {
  log.info("starting waveform backend");
  chrome.runtime.onMessage.addListener(processRequest);
};

//  init() {
//    this.log.info("starting waveform backend.");
//    chrome.runtime.onMessage.addListener(this.processRequest);
//  }
//
//  static processRequest(request, sender, sendResponse) {
//    if (request.contentScriptQuery === "getFMApiToken") {
//      WaveformBackend.getFMApiToken(request.bc_token);
//      return true;
//    }
//    if (request.contentScriptQuery != "renderBuffer") return false;
//
//    this.log.info("url recieved, beginning processing audio.");
//
//    const url = "https://t4.bcbits.com/stream/" + request.url;
//
//    fetch(url)
//      .then(response => response.arrayBuffer())
//      .then(arrayBuffer => {
//        let jsonResult = Buffer.from(arrayBuffer).toJSON();
//        sendResponse(jsonResult);
//      })
//      .catch(error => this.log.error(error));
//
//    return true;
//  }
//
//  static getFMApiToken(bcToken, sendResponse, log) {
//      chrome.cookies.get(
//        {
//          url: "https://bandcamp.com/",
//          name: "cart_client_id"
//        },
//        cookie => {
//          if (!cookie) {
//            return;
//          }
//          sendResponse({ cart_client_id: cookie.value });
//        }
//      );
//      return true;
//    }
//    const formData = new FormData();
//    formData.append("bc_token", bcToken);
//
//    fetch("http://localhost:8000/api/bctoken", {
//      method: "POST",
//      body: formData
//    })
//      .then(response => {
//        if (!response.ok) {
//          throw new Error(`HTTP error! Status: ${response.status}`);
//        }
//
//        sendResponse(response);
//      })
//      .catch(error => log.error(error));
//  }
//}
