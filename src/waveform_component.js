import Logger from "./logger";

export default class WaveformComponent {
  constructor() {
    this.log = new Logger();
  }

  init(audio, canvas) {
    this.log.info("Loaded WaveformComponent");
    this.audio = audio;
    this.canvas = canvas;
  }

  fillWaveform(element, audioData) {
    const datapoints = 100;

    const audioContext = new AudioContext();
    const fs = audioContext.sampleRate;
    const length = this.audio.duration;

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
          const stepSize = Math.round(audioBuffer.length / datapoints);

          const rmsSize = Math.min(stepSize, 128);
          const subStepSize = Math.round(stepSize / rmsSize); // used to do RMS over subset of each buffer step

          const rmsBuffer = [];
          for (let i = 0; i < datapoints; i++) {
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
          this.fillBar(waveform_data, "red");
          return waveform_data;
        })
        .then(waveform_data => {
          element.setAttribute("waveform-data", waveform_data);
        });
    });
  }

  static handleClick() {}

  fillBar(waveform_data, colour = "white") {
    let ctx = this.canvas.getContext("2d");
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.globalCompositeOperation = "source-over";

    ctx.fillStyle = colour;

    const barWidth = this.canvas.width / waveform_data.length;
    waveform_data.forEach((amplitude, index) => {
      const graphHeight = this.canvas.height * amplitude;
      const position = index * barWidth;
      ctx.fillRect(position, this.canvas.height, barWidth, -graphHeight);
    });
  }
}
