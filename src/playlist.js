import Logger from "./logger";
import Sortable from "sortablejs";

export default class Playlist {
  constructor() {
    this.log = new Logger();
    this.port = chrome.runtime.connect(null, { name: "bandcamplabelview" });
  }

  init() {
    this.log.info("Loaded Playlist");
    this.add_button = document.querySelector("#add");
    this.export_button = document.querySelector("#export");
    this.form = document.querySelector("input");
    this.audio = document.querySelector("audio");
    this.playlist = document.querySelector(".playlist").querySelector("ul");
    Sortable.create(this.playlist);

    this.add_button.addEventListener("click", () => {
      this.port.postMessage({ url: this.form.value });
    });

    this.add_button.addEventListener("click", () => {
        // eventually db call
        //const yaml = "tracks:\n";
        //document.querySelectorAll("li").forEach((element) => {
        //    const element_yaml = "";
        //    
        //    const link = element.querySelector("a");
        //    const track_text = `\turl: ${link.href}\n`;
        //    const track_metadata = `\tmeta: ${link.innerHTML}\n`;
        //    element_yaml.concat(track_text);
        //    element_yaml.concat
        //});
    });

    this.port.onMessage.addListener(mes => {
      mes["track_data"].forEach(element => {
        const li = document.createElement("li");

        const div = document.createElement("div");

        const play_button = document.createElement("div")
        play_button.setAttribute("img_id", mes["album_art"]);
        play_button.classList.add("play_status");
        play_button.addEventListener("click", (event) => {
          const album_art = document.querySelector(".album_art");
          album_art.style.display = "block";
          const img_id = event.target.getAttribute("img_id"); 
          album_art.querySelector("img").src = `https://f4.bcbits.com/img/a${img_id}_10.jpg`;

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

        const artist_name = element["artist"] ? element["artist"] : mes["album_artist"];
        const text = document.createTextNode(`${element["track_num"]} : ${artist_name} - ${element["title"]}`);
        
        const link = document.createElement("a");
        const base_url = mes["album_url"].split("/track")[0].split("/album")[0];
        link.href = `${base_url}${element["title_link"]}`;
        link.target = '_blank';
        link.appendChild(text);

        div.appendChild(play_button);
        div.appendChild(link);

        li.appendChild(div);

        this.playlist.appendChild(li);
      });
    });
  }
}
