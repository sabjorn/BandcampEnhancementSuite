import Logger from "../logger";

export default class WaveformBackend {
  constructor() {
    this.log = new Logger();
    this.boundProcessAudio = WaveformBackend.processAudio.bind(this);
  }

  init() {
    this.log.info("starting waveform backend.");
    chrome.runtime.onMessage.addListener(this.boundProcessAudio);
  }

  static processAudio(request, sender, sendResponse) {
    if (request.contentScriptQuery != "renderBuffer") return;

    this.log.info("url recieved, beginning processing audio.");

    const datapoints = request.datapoints;
    const length = request.length;
    const fs = request.fs;
    const url = "https://t4.bcbits.com/stream/" + request.url;

    const offlineAudioContext = new OfflineAudioContext(2, fs * length, fs);
    fetch(url)
      .then(response => response.arrayBuffer())
      .then(audioData => offlineAudioContext.decodeAudioData(audioData))
      .then(buffer => {
        this.log.info("processing with audio node");
        let source = offlineAudioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(offlineAudioContext.destination);
        source.start();
        return offlineAudioContext.startRendering();
      })
      .then(audioBuffer => {
        this.log.info("calculating rms");

        let leftChannel = audioBuffer.getChannelData(0);
        const stepSize = Math.round(audioBuffer.length / datapoints);

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
        return rmsBuffer;
      })
      .then(rmsBuffer => sendResponse(rmsBuffer))
      .catch(error => this.log.error(error));

    return true;
  }
}
