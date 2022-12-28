import Logger from "./logger";

export default class WaveformComponent {
  constructor(overlayColor = "red", backColor = "black", num_datapoints = 100) {
    this.log = new Logger();
    this.overlayColor = overlayColor;
    this.backColor = backColor;
    this.num_datapoints = num_datapoints;
  }

  init(audio, canvas) {
    this.log.info("Loaded WaveformComponent");
    this.audio = audio;
    this.canvas = canvas;

    this.audio.addEventListener(
      "timeupdate",
      WaveformComponent.monitorAudioTimeupdateCallback.bind(this)
    );
    this.canvas.addEventListener(
      "click",
      WaveformComponent.mousedownCallback.bind(this)
    );
  }

  fillWaveform(element, audioData, duration) {
    const audioContext = new AudioContext();
    const fs = audioContext.sampleRate;
    const length = duration;

    const audioBuffer = new Uint8Array(audioData.data).buffer;
    const offlineAudioContext = new OfflineAudioContext(2, fs * length, fs);

    offlineAudioContext.decodeAudioData(audioBuffer, buffer => {
      let source = offlineAudioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(offlineAudioContext.destination);
      source.start();

      offlineAudioContext
        .startRendering()
        .then(audioBuffer => {
          let leftChannel = audioBuffer.getChannelData(0);
          const stepSize = Math.round(audioBuffer.length / this.num_datapoints);

          const rmsSize = Math.min(stepSize, 128);
          const subStepSize = Math.round(stepSize / rmsSize); // used to do RMS over subset of each buffer step

          const rmsBuffer = [];
          for (let i = 0; i < this.num_datapoints; i++) {
            let rms = 0.0;
            for (let sample = 0; sample < rmsSize; sample++) {
              const sampleIndex = i * stepSize + sample * subStepSize;
              let audioSample = leftChannel[sampleIndex];
              rms += audioSample ** 2;
            }
            rmsBuffer.push(Math.sqrt(rms / rmsSize));
          }
          let max = rmsBuffer.reduce(function(a, b) {
            return Math.max(a, b);
          });
          for (let i = 0; i < rmsBuffer.length; i++) {
            rmsBuffer[i] /= max;
          }
          return rmsBuffer;
        })
        .then(waveform_data => {
          if (element.parentElement.id == "bes_currently_playing")
            this.fillBar(waveform_data, "red");
          return waveform_data;
        })
        .then(waveform_data => {
          element.setAttribute("waveform-data", waveform_data);
        });
    });
  }

  fillBar(waveform_data) {
    const ctx = this.canvas.getContext("2d");
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.globalCompositeOperation = "source-over";

    ctx.fillStyle = this.backColor;

    const barWidth = this.canvas.width / waveform_data.length;
    waveform_data.forEach((amplitude, index) => {
      const graphHeight = this.canvas.height * amplitude;
      const position = index * barWidth;
      ctx.fillRect(position, this.canvas.height, barWidth, -graphHeight);
    });
  }

  drawOverlay(progress) {
    let ctx = this.canvas.getContext("2d");
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = this.backColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = this.overlayColor;
    ctx.fillRect(0, 0, this.canvas.width * progress, this.canvas.height);
  }

  clearWaveform() {
    const ctx = this.canvas.getContext("2d");
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = this.backColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  static monitorAudioTimeupdateCallback(e) {
    let audio = e.target;
    let progress = audio.currentTime / audio.duration;
    this.drawOverlay(progress);
  }

  static mousedownCallback(e) {
    const elementOffset = e.offsetX;
    const elementWidth = e.path[1].offsetWidth;
    const scaleDuration = elementOffset / elementWidth;

    let audioDuration = this.audio.duration;
    this.audio.currentTime = scaleDuration * audioDuration;
  }
}
