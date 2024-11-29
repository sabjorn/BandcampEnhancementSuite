import Logger from "./logger";
import {
  mousedownCallback,
  extractBandFollowInfo,
  extractFanTralbumData,
  getTralbumDetails,
  addAlbumToCart
} from "./utilities.js";
import { createInputButtonPair } from "./components/buttons.js";
import { createShoppingCartItem } from "./components/shoppingCart.js";
import { createPlusSvgIcon } from "./components/svgIcons";

const stepSize = 10;

export default class Player {
  constructor() {
    this.log = new Logger();

    this.keydownCallback = Player.keydownCallback.bind(this);
    this.volumeSliderCallback = Player.volumeSliderCallback.bind(this);
    this.createOneClickBuyButton = Player.createOneClickBuyButton.bind(this);

    // re-import
    this.addAlbumToCart = addAlbumToCart;
    this.createInputButtonPair = createInputButtonPair;
    this.createShoppingCartItem = createShoppingCartItem;
    this.extractBandFollowInfo = extractBandFollowInfo;
    this.extractFanTralbumData = extractFanTralbumData;
    this.getTralbumDetails = getTralbumDetails.bind(this);
  }

  init() {
    this.log.info("Starting BES Player");

    document.addEventListener("keydown", this.keydownCallback);

    let progressBar = document.querySelector(".progbar");
    progressBar.style.cursor = "pointer";
    progressBar.addEventListener("click", mousedownCallback);

    Player.movePlaylist();

    this.updatePlayerControlInterface();
    return;

    const {
      is_purchased,
      part_of_purchased_album
    } = this.extractFanTralbumData();
    if (is_purchased || part_of_purchased_album) return;

    const bandFollowInfo = this.extractBandFollowInfo();
    const tralbumId = bandFollowInfo.tralbum_id;
    const tralbumType = bandFollowInfo.tralbum_type;
    return this.getTralbumDetails(tralbumId, tralbumType)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(tralbumDetails => {
        document.querySelectorAll("tr.track_row_view").forEach((row, i) => {
          if (tralbumDetails.tracks[i] === undefined) return;

          const {
            price,
            currency,
            track_id: tralbumId,
            title: itemTitle,
            is_purchasable
          } = tralbumDetails.tracks[i];
          const type = "t";

          const infoCol = row.querySelector(".info-col");
          if (infoCol) infoCol.remove();

          const oneClick = this.createOneClickBuyButton(
            price,
            currency,
            tralbumId,
            itemTitle,
            is_purchasable,
            type
          );

          if (!is_purchasable) return;

          const downloadCol = row.querySelector(".download-col");
          downloadCol.innerHTML = "";
          downloadCol.append(oneClick);
        });

        const {
          price,
          currency,
          album_id: tralbumId,
          title: itemTitle,
          is_purchasable,
          type
        } = tralbumDetails;
        const oneClick = this.createOneClickBuyButton(
          price,
          currency,
          tralbumId,
          itemTitle,
          is_purchasable,
          type
        );
        if (!is_purchasable) return;

        document
          .querySelector("ul.tralbumCommands .buyItem.digital h3.hd")
          .append(oneClick);
      })
      .catch(error => {
        this.log.error(error);
      });
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

  static createOneClickBuyButton(
    price,
    currency,
    tralbumId,
    itemTitle,
    is_purchasable,
    type
  ) {
    if (!is_purchasable) {
      return;
    }

    const pair = this.createInputButtonPair({
      inputPrefix: "$",
      inputSuffix: currency,
      inputPlaceholder: price,
      buttonChildElement: createPlusSvgIcon(),
      onButtonClick: value => {
        if (value < price) {
          this.log.error("track price too low");
          return;
        }

        this.addAlbumToCart(tralbumId, value, type).then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const cartItem = this.createShoppingCartItem({
            itemId: tralbumId,
            itemName: itemTitle,
            itemPrice: value,
            itemCurrency: currency
          });

          if (document.querySelector("#sidecart").style.display === "none") {
            window.location.reload();
            return;
          }

          document.querySelector("#item_list").append(cartItem);
        });
      }
    });
    pair.classList.add("one-click-button-container");

    return pair;
  }
}
