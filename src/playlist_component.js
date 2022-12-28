import wishlistHtml from "../html/wishlist_component.html";
import html from "../html/playlist_component.html";
import Logger from "./logger";
import Sortable from "sortablejs";
import WaveformComponent from "./waveform_component";

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
  is_purchasable: true,
  has_digital_download: true, // currently unused
  duration: 123.4
};

export default class PlaylistComponent {
  constructor(enable_purchase_button = false) {
    this.log = new Logger();
    this.appendTracks = PlaylistComponent.appendTracks.bind(this);

    this.enable_purchase_button = enable_purchase_button;
    this.pre_play_callback = () => {};
    this.post_play_callback = src => {};
    this.delete_button_callback = () => {};
    this.purchase_button_callback = () => {};
    this.scroll_callback = () => {};
    this.load_button_callback = () => {};
    this.wishlist_button_callback = () => {};

    this.waveform = new WaveformComponent();
  }

  init(element) {
    this.log.info("Loaded PlaylistComponent");

    element.innerHTML = html;

    this.audio = element.querySelector("audio");
    const canvas = element.querySelector("canvas");
    this.waveform.init(this.audio, canvas);

    this.playlist = element.querySelector(".playlist").querySelector("ul");
    Sortable.create(this.playlist);

    document.querySelector(".playlist").addEventListener("scroll", event => {
      // need to find out if we can capture only when scrolling has stopped
      const a = event.target.scrollTop;
      const b = event.target.scrollHeight - event.target.clientHeight;
      const percent = a / b;

      const li_total = event.target.querySelectorAll("li").length;
      const li_index_current = Math.trunc(percent * li_total);

      this.scroll_callback(event, li_index_current, li_total);
    });

    document.addEventListener("keydown", e => {
      this.log.info("Keydown: " + e.key);
      if (e.target == document.body) {
        const playing = document.querySelector(".playing");
        if (playing == null) return;
        if (e.key == "x") {
          try {
            playing
              .closest("li")
              .querySelector(".bes_delete")
              .click();
          } catch (e) {}
        }
        if (e.key == " " || e.key == "p") {
          // play/pause
          e.preventDefault();
          this.audio.paused ? this.audio.play() : this.audio.pause();
        }

        if (e.key == "ArrowUp") {
          e.preventDefault();
          try {
            playing
              .closest("li")
              .previousElementSibling.querySelector(".play_status")
              .click();
          } catch (e) {}
        }

        if (e.key == "ArrowDown") {
          e.preventDefault();
          try {
            playing
              .closest("li")
              .nextElementSibling.querySelector(".play_status")
              .click();
          } catch (e) {}
        }

        if (e.key == "ArrowLeft") {
          e.preventDefault();
          this.audio.currentTime -= 10;
        }

        if (e.key == "ArrowRight") {
          e.preventDefault();
          this.audio.currentTime += 10;
        }
      }
    });

    const load_button = document.querySelector("#load");
    load_button.onclick = this.load_button_callback;
  }

  set_pre_play_callback(callback) {
    this.pre_play_callback = callback;
    return this;
  }
  set_post_play_callback(callback) {
    this.post_play_callback = callback;
    return this;
  }
  set_delete_button_callback(callback) {
    this.delete_button_callback = callback;
    return this;
  }
  set_purchase_button_callback(callback) {
    this.purchase_button_callback = callback;
    return this;
  }
  set_scroll_callback(callback) {
    this.scroll_callback = callback;
    return this;
  }
  set_load_button_callback(callback) {
    this.load_button_callback = callback;
    return this;
  }
  set_wishlist_button_callback(callback) {
    this.wishlist_button_callback = callback;
    return this;
  }

  static appendTracks(tracks) {
    this.log.info("Appending Tracks");
    tracks.forEach(track => {
      // check for already existing track id
      if (document.querySelector(`[track_id=\"${track["track_id"]}\"]`)) return;

      const li = document.createElement("li");
      li.setAttribute("track_id", track["track_id"]);
      li.setAttribute("timestamp", track["timestamp"]);

      const play_button = document.createElement("div");
      play_button.setAttribute("album_art_url", track["album_art_url"]);
      play_button.setAttribute("stream_url", track["stream_url"]);
      play_button.setAttribute("duration", track["duration"]);

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
          element.parentElement.removeAttribute("id");
        });
        event.target.classList.add("playing");
        event.target.parentElement.setAttribute("id", "bes_currently_playing");

        // re-add later
        // check if expired
        let mp3_url = event.target.getAttribute("stream_url");
        const new_mp3_url = this.pre_play_callback(mp3_url);
        if (new_mp3_url) mp3_url = new_mp3_url;
        event.target.setAttribute("stream_url", mp3_url);

        this.audio.src = mp3_url;
        this.audio.play();

        event.target.parentElement.classList.add("bes_has_been_played");

        this.waveform.clearWaveform();
        if (event.target.hasAttribute("waveform-data")) {
          const waveform_data = event.target
            .getAttribute("waveform-data")
            .split(",");
          this.waveform.fillBar(waveform_data, "black");
          return;
        }

        const duration = event.target.getAttribute("duration");
        this.post_play_callback(this.audio.src).then(audioData => {
          this.waveform.fillWaveform(event.target, audioData, duration);
        });
      });

      const delete_button = document.createElement("button");
      delete_button.innerHTML = "x";
      delete_button.classList.add("bes_button");
      delete_button.classList.add("bes_delete");
      delete_button.addEventListener("click", event => {
        this.log.debug(`delete button clicked: ${event.target}`);

        this.audio.pause();
        try {
          // gross hack to get next play on clicking x!!!
          if (event.target.closest("li").id == "bes_currently_playing")
            event.target
              .closest("li")
              .nextElementSibling.querySelector(".play_status")
              .click();
        } catch (e) {}
        event.target.closest("li").remove();

        this.delete_button_callback(event.target);
      });

      const wishlist_button = document.createElement("button");
      wishlist_button.classList.add("bes_button");
      wishlist_button.classList.add("collection-item-actions");
      wishlist_button.classList.add("wishlist"); // wishlist || wishlisted || purchased
      wishlist_button.style.visibility = "unset";
      wishlist_button.style.display = "none";
      wishlist_button.innerHTML = wishlistHtml;
      wishlist_button.addEventListener("click", event => {
        this.wishlist_button_callback(event.target);
      });

      const is_purchasable = track["is_purchasable"];
      const has_price = track["price"] > 0;
      const purchase_button = document.createElement("button");
      purchase_button.style.display = "none";
      if (this.enable_purchase_button & is_purchasable & has_price) {
        purchase_button.style.display = "";
        purchase_button.innerHTML = "$";
        purchase_button.classList.add("bes_button");

        purchase_button.setAttribute("price", track["price"]);
        purchase_button.setAttribute("track_id", track["track_id"]);
        purchase_button.addEventListener("click", event => {
          const track_id = event.target.getAttribute("track_id");
          const price = event.target.getAttribute("price");

          this.purchase_button_callback(track_id, price)
            .then(() => {
              this.log.debug("track successfully added to cart");
            })
            .then(() => {
              const wishlist_button = event.target.parentElement.querySelector(
                ".collection-item-actions"
              );
              wishlist_button.classList.replace("wishlist", "purchased");
              wishlist_button.style.display = "";

              event.target.remove();
            })
            .catch(error => {
              this.log.error(`error adding track to cart: ${error}`);
            });
        });
      }
      const album_art_thumb = document.createElement("img");
      album_art_thumb.classList.add("bes_thumbnail");
      album_art_thumb.src = track["album_art_url"];

      const text = `${track["artist"]} - ${track["title"]} - ${track["label"]} - ${track["price"]}${track["currency"]}`.replace(
        "- null",
        ""
      ).replace(`- null${track["currency"]}`, "");

      const textNode = document.createTextNode(text);
      const link = document.createElement("a");
      link.href = `${track["link_url"]}`;
      link.target = "_blank";
      link.appendChild(textNode);

      li.appendChild(album_art_thumb);
      li.appendChild(play_button);
      li.appendChild(link);
      li.appendChild(wishlist_button);
      li.appendChild(purchase_button);
      li.appendChild(delete_button);

      this.playlist.appendChild(li);
    });
  }
}
