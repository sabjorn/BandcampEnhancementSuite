import Logger from "../logger";

const log = new Logger();

const fetchAudio = async request => {
  const { url } = request;
  log.info("url recieved, beginning processing audio.");
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();

    return Buffer.from(arrayBuffer).toJSON();
  } catch (error) {
    log.error(error);
  }
};

export const initWaveformBackend = () => {
  log.info("starting waveform backend");

  chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
    const { contentScriptQuery } = request;
    if (contentScriptQuery === "fetchAudio") {
      fetchAudio(request, sendResponse).then(sendResponse);
      return true;
    }
    return false;
  });
};

//    if (request.contentScriptQuery === "getFMApiToken") {
//      WaveformBackend.getFMApiToken(request.bc_token);
//      return true;
//    }
//  static processRequest(request, sender, sendResponse) {
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
