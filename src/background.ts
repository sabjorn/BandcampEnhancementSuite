import { initLabelViewBackend } from './background/label_view_backend';
import { initWaveformBackend } from './background/waveform_backend';
import { initConfigBackend } from './background/config_backend';
import { initHideUnhideCollectionBackend } from './background/hide_unhide_collection_backend';
import { initDownloadBackend } from './background/download_backend';
import { initCartImportBackend } from './background/cart_import_backend';
import { initFindMusicBackend } from './background/findmusic_backend';
import { initCacheBackend } from './background/cache_backend';
import { initPlayedBackend } from './background/played_backend';

(async () => {
  await initConfigBackend();
  initLabelViewBackend();
  initWaveformBackend();
  initHideUnhideCollectionBackend();
  initDownloadBackend();
  initCartImportBackend();
  initFindMusicBackend();
  initCacheBackend();
  initPlayedBackend();
})();
