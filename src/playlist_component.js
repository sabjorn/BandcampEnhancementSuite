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
  is_purchasable: true // currently unused
};

export default class PlaylistComponent {
  constructor(
    enable_purchase_button = false,
    pre_play_callback = () => {},
    post_play_callback = () => {},
    delete_button_callback = () => {},
    purchase_button_callback = () => {},
    scroll_callback = () => {},
    load_button_callback = () => {}
  ) {
    this.log = new Logger();
    this.appendTracks = PlaylistComponent.appendTracks.bind(this);

    this.enable_purchase_button = enable_purchase_button;
    this.pre_play_callback = pre_play_callback;
    this.post_play_callback = post_play_callback;
    this.delete_button_callback = delete_button_callback;
    this.purchase_button_callback = purchase_button_callback;
    this.scroll_callback = scroll_callback;
    this.load_button_callback = load_button_callback;
    this.observer = new MutationObserver(
      ((mutationList, mutation_observer) => {
        mutationList.forEach(mutation => {
          if (mutation.type != "attributes") return;

          if (!mutation.target.hasAttribute("waveform-data")) return;

          if (mutation.target.parentElement.id != "bes_currently_playing")
            return;

          const waveform_data = mutation.target
            .getAttribute("waveform-data")
            .split(",");

          const canvas = document.querySelector("canvas");
          for (let i = 0; i < waveform_data.length; ++i)
            PlaylistComponent.fillBar(
              canvas,
              waveform_data[i],
              i,
              waveform_data.length,
              "red"
            );
          //mutation_observer.disconnect(); //might not need this
        });
      }).bind(this)
    );
  }

  init(element) {
    this.log.info("Loaded PlaylistComponent");

    element.innerHTML = html;
    this.audio = document.querySelector("audio");

    this.playlist = document.querySelector(".playlist").querySelector("ul");
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
      // re-add later
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
        this.audio.addEventListener("loadeddata", () => {
          // guarantees data from audio is available
          this.post_play_callback(this.audio, event.target);
        });

        const canvas = document.querySelector("canvas");
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

        if (!event.target.hasAttribute("waveform-data")) {
          // should handle if waveform-data is added as attribute
          this.observer.observe(event.target, {
            attributes: true
          });
          return;
        }
        const waveform_data = event.target
          .getAttribute("waveform-data")
          .split(",");

        for (let i = 0; i < waveform_data.length; ++i)
          PlaylistComponent.fillBar(
            canvas,
            waveform_data[i],
            i,
            waveform_data.length,
            "red"
          );
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

      li.appendChild(play_button);
      li.appendChild(link);
      li.appendChild(purchase_button);
      li.appendChild(delete_button);

      this.playlist.appendChild(li);
    });
  }

  static fillBar(canvas, amplitude, index, numElements, colour = "white") {
    let ctx = canvas.getContext("2d");
    ctx.globalCompositeOperation = "source-over";

    ctx.fillStyle = colour;

    let graphHeight = canvas.height * amplitude;
    let barWidth = canvas.width / numElements;
    let position = index * barWidth;
    ctx.fillRect(position, canvas.height, barWidth, -graphHeight);
  }

  static drawOverlay(canvas, progress, colour = "red", clearColour = "black") {
    let ctx = canvas.getContext("2d");
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = clearColour;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, canvas.width * progress, canvas.height);
  }
}
