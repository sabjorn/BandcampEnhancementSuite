import Logger from "./logger";
import {
  mousedownCallback,
  extractBandFollowInfo,
  extractFanTralbumData,
  getTralbumDetails,
  addAlbumToCart,
  CURRENCY_MINIMUMS
} from "./utilities.js";
import { createInputButtonPair } from "./components/buttons.js";
import { createShoppingCartItem } from "./components/shoppingCart.js";
import { createPlusSvgIcon } from "./components/svgIcons";
import { BandFollowInfo, FanTralbumData } from "./utilities";

interface KeyCombo {
  key: string;
  alt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
}

interface KeyHandlers {
  [key: string]: () => void;
}



const SEEK_STEP_SIZE = 10;
const LARGE_SEEK_STEP_SIZE = 30;
const VOLUME_STEP = 0.05;
const DEFAULT_KEY_HANDLERS: KeyHandlers = {
  " ": () => {
    const playButton = document.querySelector("div.playbutton") as HTMLElement;
    if (!playButton) return;

    playButton.click();
  },
  p: () => {
    const playButton = document.querySelector("div.playbutton") as HTMLElement;
    if (!playButton) return;

    playButton.click();
  },
  ArrowUp: () => {
    const prevButton = document.querySelector("div.prevbutton") as HTMLElement;
    if (!prevButton) return;

    prevButton.click();
  },
  ArrowDown: () => {
    const nextButton = document.querySelector("div.nextbutton") as HTMLElement;
    if (!nextButton) return;

    nextButton.click();
  },
  ArrowRight: () => {
    let audio = document.querySelector("audio") as HTMLAudioElement;
    if (!audio) return;

    audio.currentTime = audio.currentTime + SEEK_STEP_SIZE;
  },
  ArrowLeft: () => {
    let audio = document.querySelector("audio") as HTMLAudioElement;
    if (!audio) return;

    audio.currentTime = audio.currentTime - SEEK_STEP_SIZE;
  },
  "Shift+ArrowLeft": () => {
    let audio = document.querySelector("audio") as HTMLAudioElement;
    if (!audio) return;

    audio.currentTime = audio.currentTime - LARGE_SEEK_STEP_SIZE;
  },
  "Shift+ArrowRight": () => {
    let audio = document.querySelector("audio") as HTMLAudioElement;
    if (!audio) return;

    audio.currentTime = audio.currentTime + LARGE_SEEK_STEP_SIZE;
  },
  "Shift+ArrowUp": () => {
    let input = document.querySelector("input.volume") as HTMLInputElement;
    if (!input) return;

    const currentVolume = parseFloat(input.value);
    const newVolume = currentVolume + VOLUME_STEP;
    input.value = (newVolume > 1.0 ? 1.0 : newVolume).toString();

    const event = new Event("input");
    input.dispatchEvent(event);
  },
  "Shift+ArrowDown": () => {
    let input = document.querySelector("input.volume") as HTMLInputElement;
    if (!input) return;

    const currentVolume = parseFloat(input.value);
    const newVolume = currentVolume - VOLUME_STEP;
    input.value = (newVolume < 0.0 ? 0.0 : newVolume).toString();

    const event = new Event("input");
    input.dispatchEvent(event);
  }
};

function keyComboToString(combo: KeyCombo): string {
  const { key, alt = false, ctrl = false, shift = false, meta = false } = combo;
  return `${alt ? "Alt+" : ""}${ctrl ? "Ctrl+" : ""}${shift ? "Shift+" : ""}${
    meta ? "Meta+" : ""
  }${key}`;
}

export default class Player {
  public log: Logger;
  public keyHandlers: KeyHandlers;
  public preventDefault: boolean;
  public keydownCallback: (e: KeyboardEvent) => void;
  public volumeSliderCallback: (e: Event) => void;
  public createOneClickBuyButton: (price: number, currency: string, tralbumId: string, itemTitle: string, type: string) => HTMLElement;
  public addAlbumToCart: (item_id: string | number, unit_price: string | number, item_type?: string) => Promise<Response>;
  public createInputButtonPair: any;
  public createShoppingCartItem: any;
  public extractBandFollowInfo: () => BandFollowInfo;
  public extractFanTralbumData: () => FanTralbumData;
  public getTralbumDetails: (item_id: string | number, item_type?: string) => Promise<Response>;
  constructor() {
    this.log = new Logger();
    this.keyHandlers = DEFAULT_KEY_HANDLERS;
    this.preventDefault = true;

    this.keydownCallback = this.keydownCallbackImpl.bind(this);
    this.volumeSliderCallback = Player.volumeSliderCallback.bind(this);
    this.createOneClickBuyButton = this.createOneClickBuyButtonImpl.bind(this);

    // re-import
    this.addAlbumToCart = addAlbumToCart;
    this.createInputButtonPair = createInputButtonPair;
    this.createShoppingCartItem = createShoppingCartItem;
    this.extractBandFollowInfo = extractBandFollowInfo;
    this.extractFanTralbumData = extractFanTralbumData;
    this.getTralbumDetails = getTralbumDetails.bind(this);
  }

  init(): Promise<void> | void {
    this.log.info("Starting BES Player");

    document.addEventListener("keydown", this.keydownCallback);

    let progressBar = document.querySelector(".progbar") as HTMLElement;
    progressBar.style.cursor = "pointer";
    progressBar.addEventListener("click", mousedownCallback);

    Player.movePlaylist();

    this.updatePlayerControlInterface();

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

          if (!is_purchasable) return;

          const infoCol = row.querySelector(".info-col");
          if (infoCol) infoCol.remove();

          const minimumPrice =
            price > 0.0 ? price : CURRENCY_MINIMUMS[currency];
          if (!minimumPrice) return;

          const oneClick = this.createOneClickBuyButton(
            minimumPrice,
            currency,
            tralbumId,
            itemTitle,
            type
          );

          const downloadCol = row.querySelector(".download-col");
          downloadCol.innerHTML = "";
          downloadCol.append(oneClick);
        });

        const {
          price,
          currency,
          id: tralbumId,
          title: itemTitle,
          is_purchasable,
          type
        } = tralbumDetails;
        if (!is_purchasable) return;

        const minimumPrice = price > 0.0 ? price : CURRENCY_MINIMUMS[currency];
        if (!minimumPrice) return;
        const oneClick = this.createOneClickBuyButton(
          minimumPrice,
          currency,
          tralbumId,
          itemTitle,
          type
        );

        (document
          .querySelector("ul.tralbumCommands .buyItem.digital h3.hd") as HTMLElement)
          .append(oneClick);
      })
      .catch(error => {
        this.log.error(error);
      });
  }

  updatePlayerControlInterface(): void {
    let controls = document.createElement("div");
    controls.classList.add("controls");

    let volumeSlider = Player.createVolumeSlider();
    volumeSlider.addEventListener("input", this.volumeSliderCallback);
    controls.append(volumeSlider);

    let playButton = Player.transferPlayButton();
    controls.append(playButton);

    let prevNext = Player.transferPreviousNextButtons();
    controls.append(prevNext);

    let inlineplayer = document.querySelector("div.inline_player") as HTMLElement;
    if (!inlineplayer.classList.contains("hidden"))
      inlineplayer.prepend(controls);
  }

  static movePlaylist(): void {
    const playlist = document.querySelector("table#track_table");
    if (playlist) {
      const player = document.querySelector("div.inline_player") as HTMLElement;
      player.after(playlist);
    }
  }

  static createVolumeSlider(): HTMLInputElement {
    let input = document.createElement("input");
    input.type = "range";
    input.classList.add("volume", "thumb", "progbar_empty");
    input.min = "0";
    input.max = "1";
    input.step = "0.01";
    input.title = "volume control";

    let audio = document.querySelector("audio") as HTMLAudioElement;
    input.value = audio.volume.toString();

    return input;
  }

  static transferPlayButton(): HTMLDivElement {
    let play_cell = document.querySelector("td.play_cell") as HTMLTableCellElement;
    play_cell.parentNode.removeChild(play_cell);
    let play_button = play_cell.querySelector("a") as HTMLAnchorElement;
    let play_div = document.createElement("div");
    play_div.classList.add("play_cell");
    play_div.append(play_button);

    return play_div;
  }

  static transferPreviousNextButtons(): HTMLDivElement {
    let prev_cell = document.querySelector("td.prev_cell") as HTMLTableCellElement;
    prev_cell.parentNode.removeChild(prev_cell);
    let prev_button = prev_cell.querySelector("a") as HTMLAnchorElement;
    let prev_div = document.createElement("div");
    prev_div.classList.add("prev");
    prev_div.append(prev_button);

    let next_cell = document.querySelector("td.next_cell") as HTMLTableCellElement;
    next_cell.parentNode.removeChild(next_cell);
    let next_button = next_cell.querySelector("a") as HTMLAnchorElement;
    let next_div = document.createElement("div");
    next_div.classList.add("next");
    next_div.append(next_button);

    let div = document.createElement("div");
    div.append(prev_div);
    div.append(next_div);
    return div;
  }

  keydownCallbackImpl(e: KeyboardEvent): void {
    if (e.target !== document.body) {
      return;
    }

    if (e.key === "Meta" && !e.altKey && !e.ctrlKey && !e.shiftKey) {
      return;
    }

    const currentCombo = keyComboToString({
      key: e.key,
      alt: e.altKey,
      ctrl: e.ctrlKey,
      shift: e.shiftKey,
      meta: e.metaKey
    });

    this.log.info(`Keydown: ${currentCombo}`);

    const handler = this.keyHandlers[currentCombo] || this.keyHandlers[e.key];

    if (!handler) {
      return;
    }
    handler();

    if (this.preventDefault) {
      e.preventDefault();
    }
  }

  static keydownCallback(_e: KeyboardEvent): void {
    // This method will be bound to instance in constructor
  }

  static mousedownCallback(e: MouseEvent): void {
    const elementOffset = e.offsetX;
    const elementWidth = (e.composedPath()[1] as HTMLElement).offsetWidth;
    const scaleDurration = elementOffset / elementWidth;

    let audio = document.querySelector("audio") as HTMLAudioElement;
    let audioDuration = audio.duration;
    audio.currentTime = scaleDurration * audioDuration;
  }

  static volumeSliderCallback(e: Event): void {
    const volume = (e.target as HTMLInputElement).value;
    const audio = document.querySelector("audio") as HTMLAudioElement;
    audio.volume = parseFloat(volume);
  }

  createOneClickBuyButtonImpl(price: number, currency: string, tralbumId: string, itemTitle: string, type: string): HTMLElement {
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

          if ((document.querySelector("#sidecart") as HTMLElement).style.display === "none") {
            window.location.reload();
            return;
          }

          (document.querySelector("#item_list") as HTMLElement).append(cartItem);
        });
      }
    });
    pair.classList.add("one-click-button-container");

    return pair;
  }

  static createOneClickBuyButton(_price: number, _currency: string, _tralbumId: string, _itemTitle: string, _type: string): HTMLElement {
    // This method will be bound to instance in constructor
    return document.createElement("div");
  }
}
