import Logger from "./logger";
import Sortable from "sortablejs";

export default class Playlist {
  constructor() {
    this.log = new Logger();
    this.port = chrome.runtime.connect(null, { name: "bandcamplabelview" });
  }

  init() {
    this.log.info("Loaded Playlist");
    this.button = document.querySelector("button");
    this.form = document.querySelector("input");
    this.audio = document.querySelector("audio");
    this.playlist = document.querySelector(".playlist").querySelector("ul");
    Sortable.create(this.playlist);

    this.button.addEventListener("click", () => {
      this.port.postMessage({ url: this.form.value });
    });

    this.port.onMessage.addListener(mes => {
      mes.forEach(element => {
        let li = document.createElement("li");
        li.style.cursor = "pointer";

        const div = document.createElement("div");

        const play_button = document.createElement("div")
        play_button.classList.add("play_status");
        play_button.addEventListener("click", (event) => {
          if(event.target.classList.contains("playing")) {
            event.target.classList.remove("playing");
            this.audio.pause();
            return;
          }

          document.querySelectorAll(".play_status").forEach((element) => { element.classList.remove("playing"); });
          event.target.classList.add("playing");
          this.audio.src = element["file"]["mp3-128"];
          this.audio.play();
        });

        const link = document.createElement("a"); // needs to come back with "mess"
        const text = document.createTextNode(`${element["track_num"]} : ${element["title"]}`);
        link.appendChild(text);

        div.appendChild(play_button);
        div.appendChild(link);

        li.appendChild(div);

        this.playlist.appendChild(li);
      });
    });
  }
}
