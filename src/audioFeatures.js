import { analyze } from "web-audio-beat-detector";

import Logger from "./logger";
import { mousedownCallback } from "./utilities.js";

export default class AudioFeatures {
  constructor(port) {
    this.log = new Logger();

    this.currentTarget;
    this.canvas;
    this.canvasDisplayToggle;
    this.waveformColour;
    this.waveformOverlayColour;
    this.bpmDisplay;

    this.toggleWaveformCanvasCallback = AudioFeatures.toggleWaveformCanvasCallback.bind(
      this
    );
    this.monitorAudioCanPlayCallback = AudioFeatures.monitorAudioCanPlayCallback.bind(
      this
    );
    this.monitorAudioTimeupdateCallback = AudioFeatures.monitorAudioTimeupdateCallback.bind(
      this
    );

    this.applyConfig = AudioFeatures.applyConfig.bind(this);
    this.port = port;
  }

  init() {
    this.canvas = AudioFeatures.createCanvas();
    this.canvas.addEventListener("click", mousedownCallback);

    this.canvasDisplayToggle = AudioFeatures.createCanvasDisplayToggle();
    this.canvasDisplayDiv = this.canvasDisplayToggle.parentNode;
    this.canvasDisplayDiv.addEventListener(
      "click",
      this.toggleWaveformCanvasCallback
    );

    this.bpmDisplay = document.createElement("div");
    this.bpmDisplay.setAttribute("class", "bpm");
    const inlineplayer = document.querySelector("div.progbar");
    inlineplayer.append(this.bpmDisplay);

    let bg = document.querySelector("h2.trackTitle");
    this.waveformColour = window
      .getComputedStyle(bg, null)
      .getPropertyValue("color");
    this.waveformOverlayColour = AudioFeatures.invertColour(
      this.waveformColour
    );

    document
      .querySelector("audio")
      .addEventListener("canplay", this.monitorAudioCanPlayCallback);

    document
      .querySelector("audio")
      .addEventListener("timeupdate", this.monitorAudioTimeupdateCallback);

    this.port.onMessage.addListener(this.applyConfig);
    this.port.postMessage({ requestConfig: {} }); // TO DO: this must be at end of init, write test
  }

  async generateAudioFeatures() {
    const datapoints = 100;
    const audio = document.querySelector("audio");

    if (this.currentTarget != audio.src) {
      this.currentTarget = audio.src;

      this.canvas
        .getContext("2d")
        .clearRect(0, 0, this.canvas.width, this.canvas.height);

      const ctx = new AudioContext();
      const src = audio.src.split("stream/")[1];

      chrome.runtime.sendMessage(
        {
          contentScriptQuery: "renderBuffer",
          url: src
        },
        audioData => {
          const audioBuffer_ = new Uint8Array(audioData.data).buffer;
          const decodePromise = ctx.decodeAudioData(audioBuffer_);

          decodePromise.then(decodedAudio => {
            analyze(decodedAudio)
              .then(
                bpm => (this.bpmDisplay.innerText = `bpm: ${bpm.toFixed(2)}`)
              )
              .catch(err =>
                this.log.error(`error finding bpm for track: ${err}`)
              );
          });

          decodePromise.then(decodedAudio => {
            this.log.info("calculating rms");
            let leftChannel = decodedAudio.getChannelData(0);

            const stepSize = Math.round(decodedAudio.length / datapoints);

            const rmsSize = Math.min(stepSize, 128);
            const subStepSize = Math.round(stepSize / rmsSize); // used to do RMS over subset of each buffer step
            let rmsBuffer = [];
            for (let i = 0; i < datapoints; i++) {
              let rms = 0.0;
              for (let sample = 0; sample < rmsSize; sample++) {
                const sampleIndex = i * stepSize + sample * subStepSize;
                let audioSample = leftChannel[sampleIndex];
                rms += audioSample ** 2;
              }
              rmsBuffer.push(Math.sqrt(rms / rmsSize));
            }

            this.log.info("visualizing");
            let max = rmsBuffer.reduce(function(a, b) {
              return Math.max(a, b);
            });
            for (let i = 0; i < rmsBuffer.length; i++) {
              let amplitude = rmsBuffer[i] / max;
              AudioFeatures.fillBar(
                this.canvas,
                amplitude,
                i,
                datapoints,
                this.waveformColour
              );
            }
          });
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
      this.generateAudioFeatures();
  }

  static monitorAudioTimeupdateCallback(e) {
    let audio = e.target;
    let progress = audio.currentTime / audio.duration;
    AudioFeatures.drawOverlay(
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
