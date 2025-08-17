import { initLabelViewBackend } from "./background/label_view_backend.js";
import { initWaveformBackend } from "./background/waveform_backend.js";
import { initConfigBackend } from "./background/config_backend.js";
import { initHideUnhideCollectionBackend } from "./background/hide_unhide_collection_backend.js";

initLabelViewBackend();
initWaveformBackend();
initConfigBackend();
initHideUnhideCollectionBackend();
