import Logger from "./logger";
import {
  mousedownCallback,
  extractBandFollowInfo,
  getTralbumDetails,
  addAlbumToCart
} from "./utilities.js";
import { createInputButtonPair } from "./components/inputButtonPair.js";
import {
  createShoppingCartItem,
  createShoppingCartResetButton
} from "./components/shoppingCart.js";

const stepSize = 10;

export default class Player {
  constructor() {
    this.log = new Logger();

    this.keydownCallback = Player.keydownCallback.bind(this);
    this.volumeSliderCallback = Player.volumeSliderCallback.bind(this);
    this.getTralbumDetails = getTralbumDetails.bind(this);
    this.createShoppingCartResetButton = createShoppingCartResetButton;
  }

  init() {
    this.log.info("Starting BES Player");

    document.addEventListener("keydown", this.keydownCallback);

    let progressBar = document.querySelector(".progbar");
    progressBar.style.cursor = "pointer";
    progressBar.addEventListener("click", mousedownCallback);

    Player.movePlaylist();

    const cartRefreshButton = this.createShoppingCartResetButton({
      className: "buttonLink",
      innerText: "⟳",
      buttonClicked: () => location.reload()
    });
    document.querySelector("#sidecartReveal").append(cartRefreshButton);

    //const bandFollowInfo = extractBandFollowInfo();
    //const tralbumId = bandFollowInfo.tralbum_id;
    //const tralbumType = bandFollowInfo.tralbum_type;
    //this.getTralbumDetails(tralbumId, tralbumType)
    //  .then(response => {
    //    if (!response.ok) {
    //      throw new Error(`HTTP error! status: ${response.status}`);
    //    }
    //    return response.json();
    //  })
    //  .then(tralbumDetails => {
    //    document.querySelectorAll("tr.track_row_view").forEach((row, i) => {
    //      const {
    //        price,
    //        currency,
    //        track_id: tralbumId,
    //        title: trackTitle
    //      } = tralbumDetails.tracks[i];

    //      const handleButtonClick = (value, defaultPrice, tralbumDetails) => {
    //        if (value < defaultPrice) {
    //          this.info.error("track price too low");
    //          return;
    //        }

    //        Player.createAndAddCartItem(
    //          tralbumDetails.tralbumId,
    //          value,
    //          tralbumDetails.tralbumType,
    //          trackTitle,
    //          price,
    //          currency
    //        ).catch(error =>
    //          this.log.error("Error adding item to cart:", error)
    //        );
    //      };

    //      const pair = createInputButtonPair({
    //        inputPrefix: "$",
    //        inputSuffix: currency,
    //        inputPlaceholder: price,
    //        tralbumDetails: { tralbumId: tralbumId, tralbumType: "t" },
    //        onButtonClick: handleButtonClick
    //      });
    //      pair.classList.add("one-click-button-container");

    //      row.removeChild(row.querySelector(".info-col"));
    //      row.removeChild(row.querySelector(".download-col"));

    //      const td = document.createElement("td");
    //      td.classList.add("download-col");
    //      td.append(pair);

    //      row.append(td);
    //    });
    //  })
    //  .catch(error => this.log.error(error));

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

  static createAndAddCartItem(
    tralbumId,
    value,
    tralbumType,
    trackTitle,
    price,
    currency
  ) {
    return addAlbumToCart(tralbumId, value, tralbumType).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const cartItem = createShoppingCartItem({
        itemId: tralbumId,
        itemName: trackTitle,
        itemPrice: price,
        itemCurrency: currency
      });

      if (document.querySelector("#sidecart").style.display === "none") {
        window.location.reload();
        return;
      }

      document.querySelector("#item_list").append(cartItem);
    });
  }
}
