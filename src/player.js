import Logger from "./logger";

const stepSize = 10;

export default class Player {
  constructor() {
    this.log = new Logger();

    this.boundKeydown = Player.keydownCallback.bind(this);
    this.boundMousedown = Player.mousedownCallback.bind(this);
    this.boundVolume = Player.volumeSliderCallback.bind(this);
  }

  init() {
    this.log.info("Starting BES Player");

    document.addEventListener("keydown", this.boundKeydown);

    let progressBar = document.querySelector(".progbar");
    progressBar.style.cursor = "pointer";
    progressBar.addEventListener("click", this.boundMousedown);

    this.addVolumeSlider();
  }

  addVolumeSlider() {
    let input = document.createElement("input");
    input.type = "range";
    input.classList = "volume thumb progbar_empty";
    input.min = 0.0;
    input.max = 1.0;
    input.step = 0.01;
    input.title = "volume control";

    let audio = document.querySelector("audio");
    input.value = audio.volume;

    input.addEventListener("input", this.boundVolume);

    let inlineplayer = document.querySelector("div.inline_player");
    if (!inlineplayer.classList.contains("hidden")) inlineplayer.append(input);
  }

  static keydownCallback(e) {
    this.log.info("Keydown: " + e.key);
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
}
