import Logger from "./logger";
import { mousedownCallback } from "./utilities.js";

export default class Waveform {
  constructor() {
    this.log = new Logger();

    this.currentTarget;
    this.canvas;
    this.canvasDisplayToggle;
    this.waveformColour;
    this.waveformOverlayColour;

    this.boundToggleWaveformCanvas = Waveform.toggleWaveformCanvasCallback.bind(
      this
    );
    this.boundMonitorAudioCanPlay = Waveform.monitorAudioCanPlayCallback.bind(
      this
    );
    this.boundMonitorAudioTimeupdate = Waveform.monitorAudioTimeupdateCallback.bind(
      this
    );

    this.boundApplyConfig = Waveform.applyConfig.bind(this);

    try {
      this.port = chrome.runtime.connect(null, { name: "bandcamplabelview" });
    } catch (e) {
      if (e.message.includes("Error in invocation of runtime.connect")) {
        this.log.error(e);
        return;
      } else {
        throw e;
      }
    }
  }

  init() {
    this.canvas = Waveform.createCanvas();
    this.canvas.addEventListener("click", mousedownCallback);

    this.canvasDisplayToggle = Waveform.createCanvasDisplayToggle();
    this.canvasDisplayDiv = this.canvasDisplayToggle.parentNode;
    this.canvasDisplayDiv.addEventListener(
      "click",
      this.boundToggleWaveformCanvas
    );

    let bg = document.querySelector("h2.trackTitle");
    this.waveformColour = window
      .getComputedStyle(bg, null)
      .getPropertyValue("color");
    this.waveformOverlayColour = Waveform.invertColour(this.waveformColour);

    document
      .querySelector("audio")
      .addEventListener("canplay", this.boundMonitorAudioCanPlay);

    document
      .querySelector("audio")
      .addEventListener("timeupdate", this.boundMonitorAudioTimeupdate);

    this.port.onMessage.addListener(this.boundApplyConfig);
    this.port.postMessage({ requestConfig: {} }); // TO DO: this must be at end of init, write test
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
      const src = audio.src.split("stream/")[1];

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

  static applyConfig(msg) {
    this.log.info("config recieved from backend" + JSON.stringify(msg.config));
    this.canvas.style.display = msg.config.displayWaveform ? "inherit" : "none";
    this.canvasDisplayToggle.checked = msg.config.displayWaveform;
  }

  static toggleWaveformCanvasCallback() {
    this.port.postMessage({ toggleWaveformDisplay: {} });
  }

  static monitorAudioCanPlayCallback() {
    let audio = document.querySelector("audio");
    if (!audio.paused && this.canvasDisplayToggle.checked)
      this.generateWaveform();
  }

  static monitorAudioTimeupdateCallback(e) {
    let audio = e.target;
    let progress = audio.currentTime / audio.duration;
    Waveform.drawOverlay(
      this.canvas,
      progress,
      this.waveformOverlayColour,
      this.waveformColour
    );
  }

  static createCanvas() {
    let canvas = document.createElement("canvas");
    canvas.style.display = "none";
    canvas.classList.add("waveform");

    // configure element to properly hold canvas
    let progbar = document.querySelector("div.progbar");
    progbar.classList.add("waveform");

    let div = document.createElement("div");
    div.append(canvas);
    progbar.prepend(div);
    return canvas;
  }

  static createCanvasDisplayToggle() {
    let toggle = document.createElement("input");

    toggle.setAttribute("title", "toggle waveform display");
    toggle.setAttribute("type", "checkbox");
    toggle.setAttribute("class", "waveform");
    toggle.setAttribute("id", "switch");

    let label = document.createElement("label");
    label.setAttribute("class", "waveform");
    label.htmlFor = "switch";
    label.innerHTML = "Toggle";

    let toggle_div = document.createElement("div");
    toggle_div.append(toggle);
    toggle_div.append(label);

    let inlineplayer = document.querySelector("div.controls");
    inlineplayer.append(toggle_div);

    return toggle;
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

    return `rgb(${r},${g},${b})`;
  }
}
