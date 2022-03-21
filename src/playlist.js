import Logger from "./logger";
import Sortable from 'sortablejs';

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

    this.port.onMessage.addListener((mes) => {
        mes.forEach((element) => {
          let li = document.createElement("li");
          li.style.cursor = "pointer";
          
          const text = `${element['track_num']} : ${element['title']}`;
          li.appendChild(document.createTextNode(text));
          li.addEventListener("click", () => {
              this.audio.src = element["file"]["mp3-128"];
              this.audio.play();
          });
         
          this.playlist.appendChild(li);
        });
    });
  }
}

