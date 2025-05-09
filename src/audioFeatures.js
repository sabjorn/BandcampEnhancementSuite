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

    this.bpmDisplay = AudioFeatures.createBpmDisplay();

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
    if (this.currentTarget == audio.src) return;
    this.currentTarget = audio.src;
    this.bpmDisplay.innerText = "";
    this.canvas
      .getContext("2d")
      .clearRect(0, 0, this.canvas.width, this.canvas.height);

    const src = audio.src;
    const trackId = (() => {
      const afterPrefix = src.split("mp3-128/")[1];
      const trackId = afterPrefix.split("?")[0];

      return trackId;
    })();

    const cachedData = await (async () => {
      return new Promise(resolve => {
        chrome.runtime.sendMessage(
          {
            contentScriptQuery: "fetchTrackMetadata",
            trackId: trackId
          },
          response => {
            if (chrome.runtime.lastError || !response) {
              resolve(null);
              return;
            }

            const { waveform, bpm } = response;
            resolve({
              waveform,
              bpm
            });
          }
        );
      });
    })();

    const { waveform, bpm } = await (async () => {
      if (cachedData) {
        return cachedData;
      }

      const ctx = new AudioContext();
      const { rmsBuffer: waveform, bpm } = await this.processAudioData(
        src,
        ctx,
        datapoints
      );

      chrome.runtime.sendMessage({
        contentScriptQuery: "postTrackMetadata",
        trackId,
        waveform,
        bpm
      });
      return { waveform, bpm };
    })();

    // Now update the display with the results (moved from the callback)
    this.bpmDisplay.innerText = `bpm: ${bpm.toFixed(2)}`;

    this.log.info("visualizing");
    const max = waveform.reduce(function(a, b) {
      return Math.max(a, b);
    });

    for (let i = 0; i < waveform.length; i++) {
      let amplitude = waveform[i] / max;
      AudioFeatures.fillBar(
        this.canvas,
        amplitude,
        i,
        datapoints,
        this.waveformColour
      );
    }
  }

  // New helper method to extract the audio processing part
  async processAudioData(src, ctx, datapoints) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { contentScriptQuery: "fetchAudio", url: src },
        async audioData => {
          if (!audioData || chrome.runtime.lastError) {
            reject(
              chrome.runtime.lastError ||
                new Error("Failed to fetch audio data")
            );
            return;
          }

          try {
            const audioBuffer = new Uint8Array(audioData.data).buffer;
            const decodedAudio = await ctx.decodeAudioData(audioBuffer);

            this.log.info("calculating bpm");
            const bpm = await analyze(decodedAudio);

            this.log.info("calculating rms");
            const leftChannel = decodedAudio.getChannelData(0);
            const rmsBuffer = (() => {
              const stepSize = Math.round(leftChannel.length / datapoints);
              const rmsSize = Math.min(stepSize, 128);
              const subStepSize = Math.round(stepSize / rmsSize);
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
              return rmsBuffer;
            })();

            resolve({ rmsBuffer, bpm });
          } catch (error) {
            reject(error);
          }
        }
      );
    });
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

  static createBpmDisplay() {
    const bpmDisplay = document.createElement("div");
    bpmDisplay.setAttribute("class", "bpm");

    const inlineplayer = document.querySelector("div.progbar");
    inlineplayer.append(bpmDisplay);

    return bpmDisplay;
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
