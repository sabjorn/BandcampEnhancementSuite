import Logger from "../logger";

export default class PlaylistBackend {
  constructor() {
    this.log = new Logger();
    this.fetchPlaylistData = PlaylistBackend.fetchPlaylistData.bind(this);
    this.connectionListenerCallback = PlaylistBackend.connectionListenerCallback.bind(
      this
    );
  }

  init() {
    this.log.info("starting playlist backend.");
    chrome.runtime.onConnect.addListener(this.connectionListenerCallback);
    chrome.runtime.onMessage.addListener(this.fetchPlaylistData); // for one off messages
  }

  static fetchPlaylistData(request, sender, sendResponse) {
    //if (request.contentScriptQuery != "renderBuffer") return;
    this.log.info("url recieved, grabbing track data.");
    const url = request.url;
    this.log.info(url);
    fetch(url)
      .then(response => response.text())
      .then(text => {
        const parser = new DOMParser();
        const htmlDocument = parser.parseFromString(text, "text/html");
        const album_collection = htmlDocument.documentElement
          .querySelector("script[data-tralbum]")
          .getAttribute("data-tralbum");
        const mp3data = JSON.parse(album_collection);

        sendResponse({
          album_artist: mp3data["artist"],
          album_url: mp3data["url"],
          album_art: mp3data["art_id"],
          track_data: mp3data["trackinfo"]
        });
        // reconcile this!
        //this.port.postMessage({
        //  album_artist: mp3data["artist"],
        //  album_url: mp3data["url"],
        //  album_art: mp3data["art_id"],
        //  track_data: mp3data["trackinfo"]
        //});
      })
      .catch(error => {
        this.log.error("Error:", error);
      });

    return true;
  }

  static connectionListenerCallback(port) {
    this.log.info("connection listener callback");
    if (port.name !== "bandcamplabelview") {
      this.log.error(
        `Unexpected chrome.runtime.onConnect port name: ${port.name}`
      );
      return;
    }

    this.port = port;
    this.port.onMessage.addListener(this.fetchPlaylistData);
  }
}
