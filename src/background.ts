import { initLabelViewBackend } from "./background/label_view_backend.js";
import { initWaveformBackend } from "./background/waveform_backend.js";
import { initConfigBackend } from "./background/config_backend.js";
import { initUnhideBackend } from "./background/unhide_backend.js";

initLabelViewBackend();
initWaveformBackend();
initConfigBackend();
initUnhideBackend();
