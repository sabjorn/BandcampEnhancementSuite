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
    this.movePreviousNextButtons();
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

  movePreviousNextButtons() {
    let prev_cell = document.querySelector("td.prev_cell")
    prev_cell.parentNode.removeChild(prev_cell);
    prev_cell.style.padding = "5px 0px 5px 2px";

    let next_cell = document.querySelector("td.next_cell")
    next_cell.parentNode.removeChild(next_cell);
    next_cell.style.padding = "5px 0px 5px 0px";

    let play_cell = document.querySelector("td.play_cell")
    play_cell.append(prev_cell)
    play_cell.append(next_cell)
  }

  static keydownCallback(e) {
    this.log.info("Keydown: " + e.key);
    if (e.target == document.body) {
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
}
