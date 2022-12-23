import Logger from "./logger";
import PlaylistComponent from "./playlist_component";
import { addAlbumToCart } from "./utilities";

export default class Playlist {
  constructor() {
    this.log = new Logger();
    this.port = chrome.runtime.connect(null, { name: "bandcamplabelview" });
    this.playlist_component = new PlaylistComponent(true);
    this.playlist_component
      .set_pre_play_callback(
        (mp3_url => {
          // check if URL is still valid -- if not, send to get updated
          this.log.info("pre play callback");
          this.log.info(`mp3_url: ${mp3_url}`);

          // mark played in DB
        }).bind(this)
      )
      .set_post_play_callback(
        ((audio, canvas, link) => {
          this.log.info("post play callback");

          this.log.info(audio);
          this.log.info(canvas);
          // maybe, instead of generating waveform, could pass back
          // the data -- or set data in attribute of link
          // and then component can be responsible for filling?
          if (link.hasAttribute("waveform-data")) return;
          this.generateWaveform(audio, canvas, link).catch(error => {
            this.log.error("Error:", error);
          });
        }).bind(this)
      )
      .set_delete_button_callback(
        (target => {
          this.log.info("delete button callback");
          this.log.info(target);
        }).bind(this)
      )
      .set_purchase_button_callback(
        ((track_id, price) => {
          this.log.info("puchase button callback");
          this.log.info(`${track_id}, ${price}`);
        }).bind(this)
      )
      .set_scroll_callback(
        ((event, li_index_current, li_total) => {
          if (li_index_current != li_total - 1) return;

          this.log.info("scroll callback");
          this.log.info(`${li_index_current}, ${li_total}`);

          const last_playlist_element = event.target.querySelectorAll("li")[
            li_total - 1
          ];
          const oldest_date = last_playlist_element.getAttribute("timestamp");

          this.log.info(oldest_date);
          //this.port.postMessage({
          //  route: "fan_activity",
          //  oldest_story_date: oldest_date
          //});
        }).bind(this)
      )
      .set_load_button_callback(
        (() => {
          const playlists = document.querySelector(".bes_player");
          const tracks = playlists.querySelectorAll("li");
          if (!tracks) return;
          const last_track = tracks[tracks.length - 1];
          const timestamp = last_track.getAttribute("timestamp");
          this.log.info(`load button clicked with timestamp: ${timestamp}`);
          this.port.postMessage({
            route: "fan_activity",
            oldest_story_date: timestamp,
            tracks: 40
          });
        }).bind(this)
      );
  }

  init() {
    this.log.info("Loaded Playlist");

    const element = document.querySelector("#stories-vm");
    this.playlist_component.init(element);

    const preload = JSON.parse(element.getAttribute("data-initial-values"));
    // copied from playlist_backend
    const entries = preload["stories"];
    const track_list = preload["track_list"];
    let tracks = [];
    entries.forEach((item, index) => {
      if (item["item_type"] === "a")
        // for now we ignore albums because price is wrong
        return;

      const selected_track = track_list[index];
      const track = {
        track_id: selected_track["track_id"],
        artist: selected_track["band_name"],
        title: selected_track["title"],
        album_title: item["album_title"],
        label: selected_track["label"],
        price: selected_track["price"],
        currency: selected_track["currency"],
        link_url: item["item_url"],
        stream_url: selected_track["streaming_url"]["mp3-128"],
        album_art_url: item["item_art_url"],
        is_purchasable: item["is_purchasable"],
        timestamp: Date.parse(item["story_date"]) / 1000
      };
      tracks.push(track);
    });
    this.playlist_component.appendTracks(tracks);

    // get pre-loaded page data
    // this might work for blocking scrollbar until filled
    this.port.onMessage.addListener(
      (tracks => {
        //this.scrollbar_enabled = false;
        this.playlist_component.appendTracks(tracks);
        //this.scrollbar_enabled = true;
      }).bind(this)
    );
    // set oldest_date with current pre-loaded page data -- or attach to scroll_callback...
    const oldest_date = preload["oldest_story_date"];
    this.port.postMessage({
      route: "fan_activity",
      oldest_story_date: oldest_date,
      tracks: 40
    });
  }

  async generateWaveform(audio, canvas, audio_link) {
    const datapoints = 100;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

    const audioContext = new AudioContext();
    const fs = audioContext.sampleRate;
    const length = audio.duration;
    this.log.info(`audio length: ${length}`);

    chrome.runtime.sendMessage(
      {
        contentScriptQuery: "renderBuffer",
        url: audio.src
      },
      audioData => {
        const audioBuffer = new Uint8Array(audioData.data).buffer;
        const offlineAudioContext = new OfflineAudioContext(2, fs * length, fs);
        offlineAudioContext.decodeAudioData(audioBuffer, buffer => {
          this.log.info("processing with audio node");
          let source = offlineAudioContext.createBufferSource();
          source.buffer = buffer;
          source.connect(offlineAudioContext.destination);
          source.start();

          offlineAudioContext.startRendering().then(audioBuffer => {
            this.log.info("calculating rms");

            let leftChannel = audioBuffer.getChannelData(0);
            const stepSize = Math.round(audioBuffer.length / datapoints);

            const rmsSize = Math.min(stepSize, 128);
            const subStepSize = Math.round(stepSize / rmsSize); // used to do RMS over subset of each buffer step

            let rmsBuffer = [];
            for (let i = 0; i < datapoints; i++) {
              let rms = 0.0;
              for (let sample = 0; sample < rmsSize; sample++) {
                const sampleIndex = i * stepSize + sample * subStepSize;
                let audioSample = leftChannel[sampleIndex];
                rms += audioSample ** 2;
              }
              rmsBuffer.push(Math.sqrt(rms / rmsSize));
            }
            this.log.info("visualizing");
            let max = rmsBuffer.reduce(function(a, b) {
              return Math.max(a, b);
            });
            for (let i = 0; i < rmsBuffer.length; i++) {
              rmsBuffer[i] /= max;
            }
            audio_link.setAttribute("waveform-data", rmsBuffer);
          });
        });
      }
    );
  }
}
