import Logger from "../logger";
import DBUtils from "../utilities.js";

const log = new Logger();

export const initWaveformBackend = () => {
  log.info("starting waveform backend");

  chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
    const { contentScriptQuery } = request;
    if (contentScriptQuery === "fetchAudio") {
      fetchAudio(request, sendResponse).then(sendResponse);
      return true;
    }

    if (request.contentScriptQuery === "getFMApiToken") {
      getFMApiToken(request).then(sendResponse);
      return true;
    }
    return false;
  });
};

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

// TODO: move to just be a function used by callers of API
// not sure how FindMusic will make sure this is triggered
const getFMApiToken = async () => {
  const dbutils = new DBUtils();
  const db = await dbutils.getDB(); // TODO: remove class and make factory
  const fmtoken = await db.get("config", "fmtoken");
  if (fmtoken) {
    return fmtoken;
  }

  const bc_cookie = await chrome.cookies.get({
    url: "https://bandcamp.com/",
    name: "identity"
  });
  const bc_token = bc_cookie.value;

  const response = await fetch("http://nasty-2.local/api/bctoken", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ bc_token })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const data = await response.json();

  await db.put("config", data.token, "fmtoken");

  [
    "https://bandcamp.com/",
    "https://findmusic.club/",
    "http://localhost:3001/",
    "http://nasty-2.local/"
  ].forEach(url => {
    chrome.cookies.set(
      {
        url,
        name: "findmusic",
        value: data.token,
        expirationDate: new Date().getTime() / 1000 + 3600 * 24 * 14, // 14 days
        path: "/",
        secure: true,
        httpOnly: false
      },
      () => {
        if (chrome.runtime.lastError) {
          log.error(chrome.runtime.lastError);
        }
      }
    );
  });

  return data.token;
};
