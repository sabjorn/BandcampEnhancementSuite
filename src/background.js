import LabelViewBackend from "./background/label_view_backend.js";
import WaveformBackend from "./background/waveform_backend.js";
import ConfigBackend from "./background/config_backend.js";

window.onload = () => {
  const lvb = new LabelViewBackend();
  lvb.init();

  const wb = new WaveformBackend();
  wb.init();

  const cb = new ConfigBackend();
  cb.init();
};
