import Logger from "./logger";
import Sortable from "sortablejs";

export default class Playlist {
  constructor() {
    this.log = new Logger();
    this.appendTracks = Playlist.appendTracks.bind(this);
    this.port = chrome.runtime.connect(null, { name: "bandcamplabelview" });
  }

  init() {
    this.log.info("Loaded Playlist");
    this.add_button = document.querySelector("#add");
    this.export_button = document.querySelector("#export");
    this.import_button = document.querySelector("#import");
    this.form = document.querySelector("input");
    this.audio = document.querySelector("audio");
    this.playlist = document.querySelector(".playlist").querySelector("ul");
    Sortable.create(this.playlist);

    this.add_button.addEventListener("click", () => {
      this.port.postMessage({ url: this.form.value });
    });

    this.export_button.addEventListener("click", () => {
      this.log.info("Exporting JSON");
      // eventually db call
      let tracks = [];
      document.querySelectorAll("li").forEach(element => {
        const link = element.querySelector("a");
        const play_button = element.querySelector(".play_status");

        const track_data = {
          url: link.href,
          meta: link.innerHTML,
          img_id: play_button.getAttribute("img_id"),
          "mp3-128": play_button.getAttribute("mp3-128")
        };
        tracks.push(track_data);
      });

      Playlist.download("playlist.json", JSON.stringify(tracks));
    });

    this.import_button.addEventListener("change", event => {
      this.log.info("Importing JSON");
      let file = event.target.files[0];

      let reader = new FileReader();

      reader.readAsText(file);

      reader.onload = () => {
        const parsed = JSON.parse(reader.result);

        parsed.forEach(track => {
          let track_data = [];
          const track_num = track["meta"].split(" : ")[0];
          const artist = track["meta"].split(" : ")[1].split(" - ")[0];
          const title = track["meta"].split(" - ")[1];
          const title_link = track["url"].split(".com")[1];
          track_data.push({
            artist: artist,
            track_num: track_num,
            title: title,
            title_link: title_link,
            file: { "mp3-128": track["mp3-128"] }
          });

          const album_url = `${track["url"].split(".com")[0]}.com`;
          const tracks = {
            track_data: track_data,
            album_url: album_url,
            album_art: track["img_id"]
          };

          this.appendTracks(tracks);
        });
      };
    });

    this.port.onMessage.addListener(this.appendTracks);
  }

  static appendTracks(mes) {
    this.log.info("Appending Tracks");
    mes["track_data"].forEach(element => {
      const li = document.createElement("li");

      const div = document.createElement("div");

      const play_button = document.createElement("div");
      play_button.setAttribute("img_id", mes["album_art"]);
      play_button.setAttribute("mp3-128", element["file"]["mp3-128"]);
      play_button.classList.add("play_status");

      play_button.addEventListener("click", event => {
        const album_art = document.querySelector(".album_art");
        album_art.style.display = "block";
        const img_id = event.target.getAttribute("img_id");
        album_art.querySelector(
          "img"
        ).src = `https://f4.bcbits.com/img/a${img_id}_10.jpg`;

        if (event.target.classList.contains("playing")) {
          event.target.classList.remove("playing");
          this.audio.pause();
          return;
        }

        document.querySelectorAll(".play_status").forEach(element => {
          element.classList.remove("playing");
        });
        event.target.classList.add("playing");
        this.audio.src = event.target.getAttribute("mp3-128");
        this.audio.play();
      });

      const artist_name = element["artist"]
        ? element["artist"]
        : mes["album_artist"];
      const text = document.createTextNode(
        `${element["track_num"]} : ${artist_name} - ${element["title"]}`
      );

      const link = document.createElement("a");
      const base_url = mes["album_url"].split("/track")[0].split("/album")[0];
      link.href = `${base_url}${element["title_link"]}`;
      link.target = "_blank";
      link.appendChild(text);

      div.appendChild(play_button);
      div.appendChild(link);

      li.appendChild(div);

      this.playlist.appendChild(li);
    });
  }
  static download(filename, text) {
    // COPIED FROM download_helper.js, should eventually be moved to utilities.js
    var element = document.createElement("a");

    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(text)
    );
    element.setAttribute("download", filename);

    element.style.display = "none";
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  }
}
