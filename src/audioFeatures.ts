import { analyze } from "web-audio-beat-detector";

import Logger from "./logger";
import { mousedownCallback } from "./utilities.js";

interface PortMessage {
  onMessage: {
    addListener: (callback: (message: any) => void) => void;
  };
  postMessage: (message: any) => void;
}

interface AudioFeaturesConfig {
  config: {
    displayWaveform: boolean;
  };
}

// Standalone callback functions (no longer need binding)
export function toggleWaveformCanvas(port: PortMessage): void {
  port.postMessage({ toggleWaveformDisplay: {} });
}

export function monitorAudioCanPlay(
  canvasDisplayToggle: HTMLInputElement, 
  generateAudioFeatures: () => void
): void {
  const audio = document.querySelector("audio") as HTMLAudioElement;
  if (audio && !audio.paused && canvasDisplayToggle.checked) {
    generateAudioFeatures();
  }
}

export function monitorAudioTimeupdate(
  e: Event, 
  canvas: HTMLCanvasElement, 
  waveformOverlayColour: string, 
  waveformColour: string
): void {
  const audio = e.target as HTMLAudioElement;
  if (!audio || !audio.duration) return;
  
  const progress = audio.currentTime / audio.duration;
  drawOverlay(canvas, progress, waveformOverlayColour, waveformColour);
}

export function applyAudioConfig(
  msg: AudioFeaturesConfig, 
  canvas: HTMLCanvasElement, 
  canvasDisplayToggle: HTMLInputElement, 
  log: Logger
): void {
  log.info("config recieved from backend" + JSON.stringify(msg.config));
  canvas.style.display = msg.config.displayWaveform ? "inherit" : "none";
  canvasDisplayToggle.checked = msg.config.displayWaveform;
}

export default class AudioFeatures {
  public log: Logger;
  public currentTarget?: string;
  public canvas?: HTMLCanvasElement;
  public canvasDisplayToggle?: HTMLInputElement;
  public canvasDisplayDiv?: HTMLElement;
  public waveformColour?: string;
  public waveformOverlayColour?: string;
  public bpmDisplay?: HTMLDivElement;
  public port: PortMessage;

  constructor(port: PortMessage) {
    this.log = new Logger();
    this.port = port;
  }

  init(): void {
    this.canvas = createCanvas();
    this.canvas.addEventListener("click", mousedownCallback);

    this.canvasDisplayToggle = createCanvasDisplayToggle();
    const parentNode = this.canvasDisplayToggle.parentNode as HTMLElement;
    if (parentNode) {
      this.canvasDisplayDiv = parentNode;
      this.canvasDisplayDiv.addEventListener(
        "click",
        () => toggleWaveformCanvas(this.port)
      );
    }

    this.bpmDisplay = createBpmDisplay();

    const bg: Element | null = document.querySelector("h2.trackTitle");
    if (bg) {
      this.waveformColour = window
        .getComputedStyle(bg, null)
        .getPropertyValue("color");
      this.waveformOverlayColour = invertColour(
        this.waveformColour
      );
    }

    const audio = document.querySelector("audio");
    if (audio) {
      audio.addEventListener("canplay", () => 
        monitorAudioCanPlay(this.canvasDisplayToggle!, () => this.generateAudioFeatures())
      );
      audio.addEventListener("timeupdate", (e: Event) =>
        monitorAudioTimeupdate(e, this.canvas!, this.waveformOverlayColour!, this.waveformColour!)
      );
    }

    this.port.onMessage.addListener((msg: AudioFeaturesConfig) => 
      applyAudioConfig(msg, this.canvas!, this.canvasDisplayToggle!, this.log)
    );
    this.port.postMessage({ requestConfig: {} }); // TO DO: this must be at end of init, write test
  }

  async generateAudioFeatures(): Promise<void> {
    const datapoints = 100;
    const audio = document.querySelector("audio") as HTMLAudioElement;
    if (!audio) return;

    if (this.currentTarget !== audio.src) {
      this.currentTarget = audio.src;

      this.bpmDisplay.innerText = "";
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
            const leftChannel = decodedAudio.getChannelData(0);

            const stepSize = Math.round(decodedAudio.length / datapoints);

            const rmsSize = Math.min(stepSize, 128);
            const subStepSize = Math.round(stepSize / rmsSize); // used to do RMS over subset of each buffer step
            let rmsBuffer = [];
            for (let i = 0; i < datapoints; i++) {
              let rms = 0.0;
              for (let sample = 0; sample < rmsSize; sample++) {
                const sampleIndex = i * stepSize + sample * subStepSize;
                const audioSample = leftChannel[sampleIndex];
                rms += audioSample ** 2;
              }
              rmsBuffer.push(Math.sqrt(rms / rmsSize));
            }

            this.log.info("visualizing");
            const max = rmsBuffer.reduce(function(a, b) {
              return Math.max(a, b);
            });
            for (let i = 0; i < rmsBuffer.length; i++) {
              const amplitude = rmsBuffer[i] / max;
              fillBar(
                this.canvas!,
                amplitude,
                i,
                datapoints,
                this.waveformColour!
              );
            }
          });
        }
      );
    }
  }


}

// Extracted utility functions for better modularity and testability
export function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.style.display = "none";
  canvas.classList.add("waveform");

  // configure element to properly hold canvas
  const progbar = document.querySelector("div.progbar");
  if (progbar) {
    progbar.classList.add("waveform");

    const div = document.createElement("div");
    div.append(canvas);
    progbar.prepend(div);
  }
  return canvas;
}

export function createCanvasDisplayToggle(): HTMLInputElement {
  const toggle = document.createElement("input");

  toggle.setAttribute("title", "toggle waveform display");
  toggle.setAttribute("type", "checkbox");
  toggle.setAttribute("class", "waveform");
  toggle.setAttribute("id", "switch");

  const label = document.createElement("label");
  label.setAttribute("class", "waveform");
  label.htmlFor = "switch";
  label.innerHTML = "Toggle";

  const toggle_div = document.createElement("div");
  toggle_div.append(toggle);
  toggle_div.append(label);

  const inlineplayer = document.querySelector("div.controls");
  if (inlineplayer) {
    inlineplayer.append(toggle_div);
  }

  return toggle;
}

export function createBpmDisplay(): HTMLDivElement {
  const bpmDisplay = document.createElement("div");
  bpmDisplay.setAttribute("class", "bpm");

  const inlineplayer = document.querySelector("div.progbar");
  if (inlineplayer) {
    inlineplayer.append(bpmDisplay);
  }

  return bpmDisplay;
}

export function fillBar(canvas: HTMLCanvasElement, amplitude: number, index: number, numElements: number, colour: string = "white"): void {
  const ctx = canvas.getContext("2d")!;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = colour;

  const graphHeight = canvas.height * amplitude;
  const barWidth = canvas.width / numElements;
  const position = index * barWidth;
  ctx.fillRect(position, canvas.height, barWidth, -graphHeight);
}

export function drawOverlay(canvas: HTMLCanvasElement, progress: number, colour: string = "red", clearColour: string = "black"): void {
  const ctx = canvas.getContext("2d")!;
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = clearColour;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, canvas.width * progress, canvas.height);
}

export function invertColour(colour: string): string {
  const rgb = colour
    .split("rgb(")[1]
    .split(")")[0]
    .split(",");

  const r = parseInt((255 - parseInt(rgb[0])).toString());
  const g = parseInt((255 - parseInt(rgb[1])).toString());
  const b = parseInt((255 - parseInt(rgb[2])).toString());

  return `rgb(${r},${g},${b})`;
}
