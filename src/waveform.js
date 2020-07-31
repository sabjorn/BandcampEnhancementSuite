import Logger from "./logger";

export default class Waveform {
  constructor() {
    this.log = new Logger();
    this.currentTarget;
    this.canvas;
    this.canvasDisplayToggle;
    this.waveformColour;
    this.waveformOverlayColour;
  }

  init() {
    this.canvas = Waveform.createCanvas();
    this.canvas.addEventListener("click", e => {
      // TODO: duplicate code in player.js, pull out
      const mousePositionX = e.offsetX;
      this.log.info("offsetX: " + mousePositionX);
      const elementWidth = event.target.width;
      this.log.info("offsetWidth: " + elementWidth);
      const scaleDurration = mousePositionX / elementWidth;
      this.log.info("scaleDurration: " + scaleDurration);

      let audio = document.querySelector("audio");
      let audioDuration = audio.duration;
      audio.currentTime = scaleDurration * audioDuration;
    });

    this.canvasDisplayToggle = Waveform.createCanvasDisplayToggle()
    this.canvasDisplayToggle.addEventListener("change", event => { 
      this.log.info("waveform toggle: " + event.target.checked) 
      this.canvas.style.display = (event.target.checked ? "" : "none");
    });

    let bg = document.querySelector("h2.trackTitle");
    this.waveformColour = window
      .getComputedStyle(bg, null)
      .getPropertyValue("color");
    this.waveformOverlayColour = Waveform.invertColour(this.waveformColour);

    document.querySelector("audio").addEventListener("canplay", () => {
      let audio = document.querySelector("audio");
      if (!audio.paused && this.canvasDisplayToggle.checked) this.generateWaveform();
    });

    document.querySelector("audio").addEventListener("timeupdate", event => {
      let audio = event.target;
      let progress = audio.currentTime / audio.duration;
      Waveform.drawOverlay(
        this.canvas,
        progress,
        this.waveformOverlayColour,
        this.waveformColour
      );
    });
  }

  async generateWaveform() {
    const datapoints = 100;
    const audio = document.querySelector("audio");

    if (this.currentTarget != audio.src) {
      this.currentTarget = audio.src;
      
      this.canvas
        .getContext("2d")
        .clearRect(0, 0, this.canvas.width, this.canvas.height);

      const audioContext = new AudioContext();
      const fs = audioContext.sampleRate;
      const length = audio.duration;
      const src = audio.src.split("stream/")[1]

      chrome.runtime.sendMessage(
        {
          contentScriptQuery: "renderBuffer",
          fs: fs,
          length: length,
          url: src,
          datapoints: datapoints
        },
        rmsBuffer => {
          this.log.info("visualizing");
          let max = rmsBuffer.reduce(function(a, b) {
            return Math.max(a, b);
          });
          for (let i = 0; i < rmsBuffer.length; i++) {
            let amplitude = rmsBuffer[i] / max;
            Waveform.fillBar(
              this.canvas,
              amplitude,
              i,
              datapoints,
              this.waveformColour
            );
          }
        }
      );
    }
  }

  static createCanvas() {
    let canvas = document.createElement("canvas");
    canvas.style.width = "auto";
    canvas.style.marginLeft = "10px";
    canvas.style.marginRight = "10px";
    canvas.height = 30;
    canvas.style.cursor = "pointer";
    canvas.style.display = "none";

    let progbar = document.querySelector("td.progbar_cell");
    progbar.insertBefore(canvas, progbar.childNodes[0]);
    return canvas;
  }

  static createCanvasDisplayToggle() {
    let toggle = document.createElement("input");
    toggle.setAttribute("title", "toggle waveform display");
    toggle.setAttribute("type", "checkbox");
    toggle.setAttribute("class", "waveform");
    
    let inlineplayer = document.querySelector("div.inline_player");
    inlineplayer.append(toggle)

    return toggle
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

  static invertColour(colour) {
    let rgb = colour
      .split("rgb(")[1]
      .split(")")[0]
      .split(",");

    let r = parseInt(255 - rgb[0]);
    let g = parseInt(255 - rgb[1]);
    let b = parseInt(255 - rgb[2]);

    return "rgb(" + r + "," + g + "," + b + ")";
  }
}
