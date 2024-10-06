import Logger from "./logger";
import {
  mousedownCallback,
  extractBandFollowInfo,
  getTralbumDetails,
  addAlbumToCart
} from "./utilities.js";

const stepSize = 10;

export default class Player {
  constructor() {
    this.log = new Logger();

    this.keydownCallback = Player.keydownCallback.bind(this);
    this.volumeSliderCallback = Player.volumeSliderCallback.bind(this);
    this.getTralbumDetails = getTralbumDetails.bind(this);
  }

  init() {
    this.log.info("Starting BES Player");

    document.addEventListener("keydown", this.keydownCallback);

    let progressBar = document.querySelector(".progbar");
    progressBar.style.cursor = "pointer";
    progressBar.addEventListener("click", mousedownCallback);

    Player.movePlaylist();

    // remove info column

    const bandFollowInfo = extractBandFollowInfo();
    const tralbumId = bandFollowInfo.tralbum_id;
    const tralbumType = bandFollowInfo.tralbum_type;
    const tralbumDetails = this.getTralbumDetails(tralbumId, tralbumType)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(tralbumDetails => {
        document.querySelectorAll("tr.track_row_view").forEach((row, i) => {
          const price = tralbumDetails.tracks[i].price;
          const currency = tralbumDetails.tracks[i].currency;
          const tralbumId = tralbumDetails.tracks[i].track_id;
          const pair = Player.createInputButtonPair(
            {
              prefix: "$",
              suffix: currency,
              placeholder: price
            },
            {
              onButtonClick: (value, tralbumDetails) => {
                if (value < tralbumDetails.minPrice) {
                  this.info.error("track price too low");
                  return;
                }
                addAlbumToCart(
                  tralbumDetails.tralbumId,
                  value,
                  tralbumDetails.tralbumType
                ).then(response => {
                  if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                  }
                  window.location.reload();
                });
              }
            },
            {
              tralbumId: tralbumId,
              minPrice: price,
              tralbumType: "t"
            }
          );

          row.removeChild(row.querySelector(".info-col"));
          row.removeChild(row.querySelector(".download-col"));

          const td = document.createElement("td");
          td.classList.add("download-col");
          td.append(pair);

          row.append(td);
        });
      })
      .catch(error => this.log.error(error));

    this.updatePlayerControlInterface();
  }

  updatePlayerControlInterface() {
    let controls = document.createElement("div");
    controls.classList.add("controls");

    let volumeSlider = Player.createVolumeSlider();
    volumeSlider.addEventListener("input", this.volumeSliderCallback);
    controls.append(volumeSlider);

    let playButton = Player.transferPlayButton();
    controls.append(playButton);

    let prevNext = Player.transferPreviousNextButtons();
    controls.append(prevNext);

    let inlineplayer = document.querySelector("div.inline_player");
    if (!inlineplayer.classList.contains("hidden"))
      inlineplayer.prepend(controls);
  }

  static movePlaylist() {
    const playlist = document.querySelector("table#track_table");
    if (playlist) {
      const player = document.querySelector("div.inline_player");
      player.after(playlist);
    }
  }

  static createVolumeSlider() {
    let input = document.createElement("input");
    input.type = "range";
    input.classList = "volume thumb progbar_empty";
    input.min = 0.0;
    input.max = 1.0;
    input.step = 0.01;
    input.title = "volume control";

    let audio = document.querySelector("audio");
    input.value = audio.volume;

    return input;
  }

  static transferPlayButton() {
    let play_cell = document.querySelector("td.play_cell");
    play_cell.parentNode.removeChild(play_cell);
    let play_button = play_cell.querySelector("a");
    let play_div = document.createElement("div");
    play_div.classList.add("play_cell");
    play_div.append(play_button);

    return play_div;
  }

  static transferPreviousNextButtons() {
    let prev_cell = document.querySelector("td.prev_cell");
    prev_cell.parentNode.removeChild(prev_cell);
    let prev_button = prev_cell.querySelector("a");
    let prev_div = document.createElement("div");
    prev_div.classList.add("prev");
    prev_div.append(prev_button);

    let next_cell = document.querySelector("td.next_cell");
    next_cell.parentNode.removeChild(next_cell);
    let next_button = next_cell.querySelector("a");
    let next_div = document.createElement("div");
    next_div.classList.add("next");
    next_div.append(next_button);

    let div = document.createElement("div");
    div.append(prev_div);
    div.append(next_div);
    return div;
  }

  static keydownCallback(e) {
    this.log.info("Keydown: " + e.key);
    if (e.target == document.body) {
      if (e.key == "Meta") {
        return;
      }
      if (e.key == " " || e.key == "p") {
        e.preventDefault();
        document.querySelector("div.playbutton").click();
      }

      if (e.key == "ArrowUp") {
        e.preventDefault();
        document.querySelector("div.prevbutton").click();
      }

      if (e.key == "ArrowDown") {
        e.preventDefault();
        document.querySelector("div.nextbutton").click();
      }

      if (e.key == "ArrowRight") {
        e.preventDefault();
        let audio = document.querySelector("audio");
        audio.currentTime = audio.currentTime + stepSize;
      }

      if (e.key == "ArrowLeft") {
        e.preventDefault();
        let audio = document.querySelector("audio");
        audio.currentTime = audio.currentTime - stepSize;
      }
    }
  }

  static mousedownCallback(e) {
    this.log.info("Mousedown");
    const elementOffset = e.offsetX;
    const elementWidth = e.path[1].offsetWidth;
    const scaleDurration = elementOffset / elementWidth;

    let audio = document.querySelector("audio");
    let audioDuration = audio.duration;
    audio.currentTime = scaleDurration * audioDuration;
  }

  static volumeSliderCallback(e) {
    let volume = e.target.value;
    let audio = document.querySelector("audio");
    audio.volume = volume;

    this.log.info("volume:", volume);
  }

  static createCurrencyInput(options = {}) {
    const {
      prefix = "$",
      suffix = "",
      placeholder = 0.0,
      inputClass = "currency-input",
      wrapperClass = "currency-input-wrapper"
    } = options;

    const wrapper = document.createElement("div");
    wrapper.className = wrapperClass;

    const input = document.createElement("input");
    input.type = "number";
    input.min = placeholder;
    input.value = placeholder;
    input.className = inputClass;
    input.placeholder = placeholder;

    wrapper.appendChild(input);

    if (prefix) {
      wrapper.dataset.prefix = prefix;
    }

    if (suffix) {
      wrapper.dataset.suffix = suffix;
    }

    return { wrapper, input };
  }

  static createButton(options = {}) {
    const { buttonText = "+", onButtonClick = () => {} } = options;

    const button = document.createElement("button");
    button.className = "one-click-button";
    button.textContent = buttonText;
    button.onclick = onButtonClick;

    return button;
  }

  static createInputButtonPair(
    inputOptions,
    buttonOptions,
    tralbumDetails = { tralbumType: "t" }
  ) {
    const { wrapper, input } = Player.createCurrencyInput(inputOptions);
    const button = Player.createButton({
      ...buttonOptions,
      onButtonClick: () => {
        if (typeof buttonOptions.onButtonClick === "function") {
          buttonOptions.onButtonClick(input.value, tralbumDetails);
        }
      }
    });

    const container = document.createElement("div");
    container.className = "one-click-button-container";

    container.appendChild(wrapper);
    container.appendChild(button);

    return container;
  }
}
