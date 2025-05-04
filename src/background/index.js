import LabelViewBackend from "./label_view_backend.js";
import { initWaveformBackend } from "./waveform_backend.js";
import ConfigBackend from "./config_backend.js";

const lvb = new LabelViewBackend();
lvb.init();

initWaveformBackend();

const cb = new ConfigBackend();
cb.init();
