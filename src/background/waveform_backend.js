import Logger from "../logger";

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

const getFMApiToken = async () => {
  const findmusic_cookie = await chrome.cookies.get({
    url: "https://bandcamp.com/",
    name: "findmusic"
  });
  if (findmusic_cookie.value) {
    return findmusic_cookie.value;
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
  chrome.cookies.set(
    {
      url: "https://bandcamp.com/",
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

  return data.token;
};
