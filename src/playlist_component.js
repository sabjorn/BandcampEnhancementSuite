import html from "../html/playlist_component.html";
import Logger from "./logger";
import Sortable from "sortablejs";

let track = {
  track_id: 1234,
  artist: "",
  title: "",
  album_title: "", // currently unused
  label: "",
  price: 1.12,
  currency: "CAD",
  link_url: "",
  stream_url: "",
  album_art_url: "",
  timestamp: 123, // currently unused
  is_purchasable: true, // currently unused
  currently_playing: false
};

export default class PlaylistComponent {
  constructor(
    play_button_callback,
    delete_button_callback,
    enable_purchase_button,
    purchase_button_callback,
    check_url_callback
  ) {
    this.log = new Logger();
    this.play_button_callback = play_button_callback;
    this.delete_button_callback = delete_button_callback;
    this.enable_purchase_button = enable_purchase_button;
    this.purchase_button_callback = purchase_button_callback;
    this.check_url_callback = check_url_callback;

    this.actions = {}; // an array of methods that will allow us to do function chaining for setting callbacks - https://levelup.gitconnected.com/learn-how-to-create-chainable-methods-in-javascript-with-a-practical-example-da8ed81d560d
    this.actions.set_play_button_callback = callback => {
      this.play_button_callback = callback;
      return this.actions;
    };
    this.actions.set_delete_button_callback = callback => {
      this.delete_button_callback = callback;
      return this.actions;
    };
    this.actions.set_purchase_button_callback = callback => {
      this.purchase_button_callback = callback;
      return this.actions;
    };
    this.actions.set_check_url_callback = callback => {
      this.check_url_callback = callback;
      return this.actions;
    };
  }

  init() {
    this.log.info("Loaded PlaylistComponent");

    this.audio = document.querySelector("audio");
    this.playlist = document.querySelector(".playlist").querySelector("ul");
    Sortable.create(this.playlist);

    document.addEventListener("keydown", e => {
      // re-add later
    });
  }

  appendTracks(tracks) {
    //this.log.info("Appending Tracks");
    tracks.forEach(track => {
      const li = document.createElement("li");

      if (track["currently_playing"])
        li.setAttribute("id", "bes_currently_playing");

      const div = document.createElement("div");

      const play_button = document.createElement("div");
      play_button.setAttribute("album_art_url", track["album_art_url"]);
      play_button.setAttribute("stream_url", track["stream_url"]);

      play_button.classList.add("play_status");

      play_button.addEventListener("click", event => {
        const album_art = document
          .querySelector(".album_art")
          .querySelector("img");
        album_art.style.display = "block";
        album_art.src = event.target.getAttribute("album_art_url");

        if (event.target.classList.contains("playing")) {
          event.target.classList.remove("playing");
          this.audio.pause();
          return;
        }

        document.querySelectorAll(".play_status").forEach(element => {
          element.classList.remove("playing");
          element.parentElement.parentElement.removeAttribute("id");
        });
        event.target.classList.add("playing");
        event.target.parentElement.parentElement.setAttribute(
          "id",
          "bes_currently_playing"
        );

        // re-add later
        // check if expired
        let mp3_url = event.target.getAttribute("stream_url");
        const new_mp3_url = this.check_url_callback(mp3_url);
        console.log("\n\nnew_mp3_url");
        if (new_mp3_url) mp3_url = new_mp3_url;
        event.target.setAttribute("stream_url", new_mp3_url);

        this.audio.src = new_mp3_url;
        this.audio.play();

        this.play_button_callback();
      });

      const delete_button = document.createElement("button");
      delete_button.innerHTML = "x";
      delete_button.style.height = "15px";
      delete_button.addEventListener("click", event => {
        // gross hack to get next play on clicking x!!!
        try {
          event.target
            .closest("li")
            .nextElementSibling.querySelector(".play_status")
            .click();

          event.target.closest("li").remove();
        } catch (e) {}

        this.delete_button_callback(event.target);
      });

      const purchase_button = document.createElement("button");
      purchase_button.style.visibility = "hidden";
      if (this.enable_purchase_button) {
        purchase_button.style.visibility = "visible";
        purchase_button.innerHTML = "+";
        purchase_button.style.height = "15px";

        purchase_button.setAttribute("price", track["price"]);
        purchase_button.setAttribute("track_id", track["track_id"]);
        purchase_button.addEventListener("click", event => {
          const track_id = event.target.getAttribute("track_id");
          const price = event.target.getAttribute("price");

          this.purchase_button_callback(track_id, price);
        });
      }

      const text = document.createTextNode(
        `${track["artist"]} - ${track["title"]} - ${track["label"]} - ${track["price"]}${track["currency"]}`
      );

      const link = document.createElement("a");
      link.href = `${track["link_url"]}`;
      link.target = "_blank";
      link.appendChild(text);

      div.appendChild(play_button);
      div.appendChild(link);
      div.appendChild(purchase_button);
      div.appendChild(delete_button);

      li.appendChild(div);

      this.playlist.appendChild(li);
    });
  }

  static getHtml() {
    return html;
  }
}
