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
    const playButton = document.querySelector("div.playbutton");
    if (!playButton) return;

    (playButton as HTMLElement).click();
  },
  p: () => {
    const playButton = document.querySelector("div.playbutton");
    if (!playButton) return;

    (playButton as HTMLElement).click();
  },
  ArrowUp: () => {
    const prevButton = document.querySelector("div.prevbutton");
    if (!prevButton) return;

    (prevButton as HTMLElement).click();
  },
  ArrowDown: () => {
    const nextButton = document.querySelector("div.nextbutton");
    if (!nextButton) return;

    (nextButton as HTMLElement).click();
  },
  ArrowRight: () => {
    const audio = document.querySelector("audio") as HTMLAudioElement;
    if (!audio) return;

    audio.currentTime = audio.currentTime + SEEK_STEP_SIZE;
  },
  ArrowLeft: () => {
    const audio = document.querySelector("audio") as HTMLAudioElement;
    if (!audio) return;

    audio.currentTime = audio.currentTime - SEEK_STEP_SIZE;
  },
  "Shift+ArrowLeft": () => {
    const audio = document.querySelector("audio") as HTMLAudioElement;
    if (!audio) return;

    audio.currentTime = audio.currentTime - LARGE_SEEK_STEP_SIZE;
  },
  "Shift+ArrowRight": () => {
    const audio = document.querySelector("audio") as HTMLAudioElement;
    if (!audio) return;

    audio.currentTime = audio.currentTime + LARGE_SEEK_STEP_SIZE;
  },
  "Shift+ArrowUp": () => {
    const input = document.querySelector("input.volume") as HTMLInputElement;
    if (!input) return;

    const currentVolume = parseFloat(input.value);
    const newVolume = currentVolume + VOLUME_STEP;
    input.value = (newVolume > 1.0 ? 1.0 : newVolume).toString();

    const event = new Event("input");
    input.dispatchEvent(event);
  },
  "Shift+ArrowDown": () => {
    const input = document.querySelector("input.volume") as HTMLInputElement;
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

    const progressBar = document.querySelector(".progbar") as HTMLElement;
    if (progressBar) {
      progressBar.style.cursor = "pointer";
      progressBar.addEventListener("click", mousedownCallback);
    }

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

        const buyItemElement = document.querySelector("ul.tralbumCommands .buyItem.digital h3.hd");
        if (buyItemElement) {
          buyItemElement.append(oneClick);
        }
      })
      .catch(error => {
        this.log.error(error);
      });
  }

  updatePlayerControlInterface(): void {
    const controls = document.createElement("div");
    controls.classList.add("controls");

    const volumeSlider = Player.createVolumeSlider();
    volumeSlider.addEventListener("input", this.volumeSliderCallback);
    controls.append(volumeSlider);

    const playButton = Player.transferPlayButton();
    controls.append(playButton);

    const prevNext = Player.transferPreviousNextButtons();
    controls.append(prevNext);

    const inlineplayer = document.querySelector("div.inline_player");
    if (inlineplayer && !inlineplayer.classList.contains("hidden")) {
      inlineplayer.prepend(controls);
    }
  }

  static movePlaylist(): void {
    const playlist = document.querySelector("table#track_table");
    if (playlist) {
      const player = document.querySelector("div.inline_player");
      if (player) {
        player.after(playlist);
      }
    }
  }

  static createVolumeSlider(): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "range";
    input.classList.add("volume", "thumb", "progbar_empty");
    input.min = "0";
    input.max = "1";
    input.step = "0.01";
    input.title = "volume control";

    const audio = document.querySelector("audio") as HTMLAudioElement;
    if (audio) {
      input.value = audio.volume.toString();
    }

    return input;
  }

  static transferPlayButton(): HTMLDivElement {
    const play_cell = document.querySelector("td.play_cell") as HTMLTableCellElement;
    if (!play_cell || !play_cell.parentNode) {
      return document.createElement("div");
    }
    
    play_cell.parentNode.removeChild(play_cell);
    const play_button = play_cell.querySelector("a");
    const play_div = document.createElement("div");
    play_div.classList.add("play_cell");
    if (play_button) {
      play_div.append(play_button);
    }

    return play_div;
  }

  static transferPreviousNextButtons(): HTMLDivElement {
    const prev_cell = document.querySelector("td.prev_cell") as HTMLTableCellElement;
    const prev_div = document.createElement("div");
    prev_div.classList.add("prev");
    
    if (prev_cell && prev_cell.parentNode) {
      prev_cell.parentNode.removeChild(prev_cell);
      const prev_button = prev_cell.querySelector("a");
      if (prev_button) {
        prev_div.append(prev_button);
      }
    }

    const next_cell = document.querySelector("td.next_cell") as HTMLTableCellElement;
    const next_div = document.createElement("div");
    next_div.classList.add("next");
    
    if (next_cell && next_cell.parentNode) {
      next_cell.parentNode.removeChild(next_cell);
      const next_button = next_cell.querySelector("a");
      if (next_button) {
        next_div.append(next_button);
      }
    }

    const div = document.createElement("div");
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
    const path = e.composedPath();
    if (path.length < 2) return;
    
    const element = path[1] as HTMLElement;
    if (!element || !element.offsetWidth) return;
    
    const elementWidth = element.offsetWidth;
    const scaleDurration = elementOffset / elementWidth;

    const audio = document.querySelector("audio") as HTMLAudioElement;
    if (!audio) return;
    
    const audioDuration = audio.duration;
    audio.currentTime = scaleDurration * audioDuration;
  }

  static volumeSliderCallback(e: Event): void {
    const target = e.target as HTMLInputElement;
    if (!target || !target.value) return;
    
    const volume = target.value;
    const audio = document.querySelector("audio") as HTMLAudioElement;
    if (!audio) return;
    
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

          const sidecart = document.querySelector("#sidecart") as HTMLElement;
          if (sidecart && sidecart.style.display === "none") {
            window.location.reload();
            return;
          }

          const itemList = document.querySelector("#item_list");
          if (itemList) {
            itemList.append(cartItem);
          }
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
