import { initLabelViewBackend } from './background/label_view_backend.js';
import { initWaveformBackend } from './background/waveform_backend.js';
import { initConfigBackend } from './background/config_backend.js';
import { initHideUnhideCollectionBackend } from './background/hide_unhide_collection_backend.js';
import { initDownloadBackend } from './background/download_backend.js';
import { initCartImportBackend } from './background/cart_import_backend.js';
import { initFindMusicBackend } from './background/findmusic_backend.js';
import { initCacheBackend } from './background/cache_backend.js';

(async () => {
  await initConfigBackend();
  initLabelViewBackend();
  initWaveformBackend();
  initHideUnhideCollectionBackend();
  initDownloadBackend();
  initCartImportBackend();
  initFindMusicBackend();
  initCacheBackend();
})();
