import Logger from "./logger";

const stepSize = 10;

export default class Player {
  constructor() {
    this.log = new Logger();
    this.boundKeydown = Player.keydownCallback.bind(this);
    this.boundMousedown = Player.mousedownCallback.bind(this);
  }

  init() {
    this.log.info("Starting BES Player");

    document.addEventListener("keydown", this.boundKeydown);

    let progressBar = document.querySelector(".progbar");
    progressBar.style.cursor = "pointer";
    progressBar.addEventListener("click", this.boundMousedown);
  }

  static keydownCallback(e) {
    this.log.info("Keydown");
    if (e.key == " " || e.key == "p")
    {
      e.preventDefault();
      document.querySelector("div.playbutton").click();
    }

    if (e.key == "ArrowUp"){
      e.preventDefault();
      document.querySelector("div.prevbutton").click();
    }

    if (e.key == "ArrowDown"){
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
}
