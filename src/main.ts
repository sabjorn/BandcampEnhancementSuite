import { createLogger } from './logger';
import { initLabelView } from './label_view';
import { initDownload } from './pages/download';
import { initPlayer, updateKeyboardHandlers } from './player';
import { initAudioFeatures } from './audioFeatures';
import { initCart } from './pages/cart';
import { initHideUnhide } from './pages/hide_unhide_collection';
import { createKeyboardSettingsSection } from './components/keyboardSettings.js';
import { KeyboardSettings } from './types/keyboard.js';

const log = createLogger();

function createToggleSetting(id: string, labelText: string, visible: boolean = true, tooltipText?: string) {
  const row = document.createElement('div');
  row.className = 'bes-drawer-setting';
  if (!visible) row.style.display = 'none';

  const labelContainer = document.createElement('div');
  labelContainer.style.display = 'flex';
  labelContainer.style.alignItems = 'center';
  labelContainer.style.gap = '6px';
  labelContainer.style.flex = '1';
  labelContainer.style.width = 'auto';

  const label = document.createElement('span');
  label.style.fontSize = '14px';
  label.style.color = '#333';
  label.textContent = labelText;

  labelContainer.appendChild(label);

  if (tooltipText) {
    const tooltipWrapper = document.createElement('span');
    tooltipWrapper.style.position = 'relative';
    tooltipWrapper.style.display = 'inline-flex';
    tooltipWrapper.style.flexShrink = '0';

    const tooltip = document.createElement('span');
    tooltip.className = 'bes-tooltip-icon';
    tooltip.textContent = '?';
    tooltip.style.display = 'inline-flex';
    tooltip.style.alignItems = 'center';
    tooltip.style.justifyContent = 'center';
    tooltip.style.width = '14px';
    tooltip.style.height = '14px';
    tooltip.style.fontSize = '11px';
    tooltip.style.fontWeight = 'bold';
    tooltip.style.borderRadius = '50%';
    tooltip.style.border = '1px solid currentColor';
    tooltip.style.opacity = '0.6';

    const tooltipContent = document.createElement('span');
    tooltipContent.className = 'bes-tooltip-text';
    tooltipContent.textContent = tooltipText;
    tooltipContent.style.visibility = 'hidden';
    tooltipContent.style.width = '200px';
    tooltipContent.style.backgroundColor = '#333';
    tooltipContent.style.color = '#fff';
    tooltipContent.style.textAlign = 'left';
    tooltipContent.style.borderRadius = '4px';
    tooltipContent.style.padding = '8px';
    tooltipContent.style.position = 'absolute';
    tooltipContent.style.zIndex = '1000';
    tooltipContent.style.bottom = '125%';
    tooltipContent.style.left = '50%';
    tooltipContent.style.marginLeft = '-100px';
    tooltipContent.style.fontSize = '12px';
    tooltipContent.style.lineHeight = '1.4';
    tooltipContent.style.opacity = '0';
    tooltipContent.style.transition = 'opacity 0.2s';
    tooltipContent.style.pointerEvents = 'none';

    tooltip.addEventListener('mouseenter', () => {
      tooltipContent.style.visibility = 'visible';
      tooltipContent.style.opacity = '1';
    });

    tooltip.addEventListener('mouseleave', () => {
      tooltipContent.style.visibility = 'hidden';
      tooltipContent.style.opacity = '0';
    });

    tooltipWrapper.appendChild(tooltip);
    tooltipWrapper.appendChild(tooltipContent);
    labelContainer.appendChild(tooltipWrapper);
  }

  const toggle = document.createElement('input');
  toggle.setAttribute('type', 'checkbox');
  toggle.setAttribute('class', 'bes-toggle');
  toggle.setAttribute('id', id);

  const toggleLabel = document.createElement('label');
  toggleLabel.setAttribute('class', 'bes-toggle');
  toggleLabel.htmlFor = id;
  toggleLabel.innerHTML = 'Toggle';

  const toggleContainer = document.createElement('div');
  toggleContainer.appendChild(toggle);
  toggleContainer.appendChild(toggleLabel);

  row.appendChild(labelContainer);
  row.appendChild(toggleContainer);

  return { row, toggle };
}

export const initBESDrawer = (config_port: chrome.runtime.Port): void => {
  if (document.querySelector('.bes-drawer')) {
    log.debug('BES drawer already exists');
    return;
  }

  const drawer = document.createElement('div');
  drawer.className = 'bes-drawer';

  const header = document.createElement('div');
  header.className = 'bes-drawer-header';

  const title = document.createElement('h2');
  title.textContent = 'Bandcamp Enhancement Suite';

  const closeButton = document.createElement('button');
  closeButton.className = 'bes-drawer-close';
  closeButton.innerHTML = '×';
  closeButton.setAttribute('aria-label', 'Close settings');

  header.appendChild(title);
  header.appendChild(closeButton);

  const content = document.createElement('div');
  content.className = 'bes-drawer-content';

  const settingsSection = document.createElement('div');
  settingsSection.className = 'bes-drawer-section';

  const settingsTitle = document.createElement('h2');
  settingsTitle.textContent = 'Settings';

  const { row: waveformSettingRow, toggle: waveformToggle } = createToggleSetting(
    'bes-waveform-toggle',
    'Display waveform and bpm',
    true,
    'Show audio waveform visualization and BPM (beats per minute) analysis for each track'
  );

  const { row: metadataCachingSettingRow, toggle: metadataCachingToggle } = createToggleSetting(
    'bes-metadata-caching-toggle',
    'Enable metadata caching',
    false,
    'Share and receive pre-computed waveform and BPM data with FindMusic.club.'
  );

  const { row: fetchCachingSettingRow, toggle: fetchCachingToggle } = createToggleSetting(
    'bes-fetch-caching-toggle',
    'Enable fetch caching',
    false,
    'Share your Bandcamp browsing data with FindMusic.club to help build a music discovery database.'
  );

  settingsSection.appendChild(settingsTitle);
  settingsSection.appendChild(waveformSettingRow);
  settingsSection.appendChild(metadataCachingSettingRow);
  settingsSection.appendChild(fetchCachingSettingRow);

  let keyboardSection: HTMLElement | null = null;

  const initKeyboardSection = (settings: KeyboardSettings) => {
    if (keyboardSection) {
      keyboardSection.remove();
    }

    keyboardSection = createKeyboardSettingsSection(settings, updatedSettings => {
      log.info('Keyboard settings updated');
      config_port.postMessage({ updateKeyboardSettings: updatedSettings });
    });

    if (!settingsSection.parentNode) {
      content.appendChild(keyboardSection);
      return;
    }

    const nextSibling = settingsSection.nextSibling;
    if (nextSibling) {
      settingsSection.parentNode.insertBefore(keyboardSection, nextSibling);
      return;
    }

    settingsSection.parentNode.appendChild(keyboardSection);
  };

  document.addEventListener('bes-reset-keyboard-settings', () => {
    log.info('Resetting keyboard settings');
    config_port.postMessage({ resetKeyboardSettings: true });
  });

  config_port.onMessage.addListener((msg: any) => {
    if (msg.config && typeof msg.config.displayWaveform === 'boolean') {
      waveformToggle.checked = msg.config.displayWaveform;
    }

    if (msg.config && typeof msg.config.enableMetadataCaching === 'boolean') {
      metadataCachingToggle.checked = msg.config.enableMetadataCaching;
    }

    if (msg.config && typeof msg.config.enableFetchCaching === 'boolean') {
      fetchCachingToggle.checked = msg.config.enableFetchCaching;
    }

    if (msg.config && msg.config.keyboardSettings) {
      initKeyboardSection(msg.config.keyboardSettings);
    }

    if (msg.keyboardSettingsError) {
      log.error(`Keyboard settings error: ${msg.keyboardSettingsError.join(', ')}`);
      alert(`Keyboard settings error: ${msg.keyboardSettingsError.join(', ')}`);
    }
  });

  waveformToggle.addEventListener('change', () => {
    config_port.postMessage({ toggleWaveformDisplay: {} });
  });

  metadataCachingToggle.addEventListener('change', () => {
    config_port.postMessage({ toggleMetadataCaching: {} });
  });

  fetchCachingToggle.addEventListener('change', () => {
    config_port.postMessage({ toggleFetchCaching: {} });
  });

  config_port.postMessage({ requestConfig: {} });

  const findMusicSection = document.createElement('div');
  findMusicSection.className = 'bes-drawer-section';

  const findMusicTitle = document.createElement('h3');
  findMusicTitle.textContent = 'FindMusic.club Integration';

  const findMusicDesc = document.createElement('p');
  findMusicDesc.textContent = 'Discover new music based on your Bandcamp collection';

  const findMusicButton = document.createElement('button');
  findMusicButton.className = 'bes-drawer-button';
  findMusicButton.textContent = 'Enable FindMusic.club Integration';

  const updateButtonText = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        contentScriptQuery: 'checkFindMusicPermissions'
      });
      log.info(`Permission check response: ${JSON.stringify(response)}`);
      findMusicButton.textContent = response?.granted
        ? 'Log in to FindMusic.club'
        : 'Enable FindMusic.club Integration';

      metadataCachingSettingRow.style.display = response?.granted ? 'flex' : 'none';
      fetchCachingSettingRow.style.display = response?.granted ? 'flex' : 'none';
    } catch (error) {
      log.error(`Failed to check permissions: ${error}`);
      findMusicButton.textContent = 'Enable FindMusic.club Integration';
      metadataCachingSettingRow.style.display = 'none';
      fetchCachingSettingRow.style.display = 'none';
    }
  };

  updateButtonText();

  findMusicSection.appendChild(findMusicTitle);
  findMusicSection.appendChild(findMusicDesc);
  findMusicSection.appendChild(findMusicButton);

  content.appendChild(findMusicSection);
  content.appendChild(settingsSection);

  drawer.appendChild(header);
  drawer.appendChild(content);

  const overlay = document.createElement('div');
  overlay.className = 'bes-drawer-overlay';

  const openDrawer = async () => {
    await updateButtonText();
    drawer.classList.add('open');
    overlay.classList.add('open');
  };

  const closeDrawer = () => {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
  };

  const toggleDrawer = async () => {
    if (drawer.classList.contains('open')) {
      closeDrawer();
      return;
    }
    await openDrawer();
  };

  closeButton.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);

  findMusicButton.addEventListener('click', () => {
    log.info('FindMusic integration button clicked');
    closeDrawer();
    chrome.runtime.sendMessage({ contentScriptQuery: 'openFindMusic' });
  });

  const button = document.createElement('button');
  button.className = 'findmusic-floating-button';
  button.title = 'BES Settings';
  button.setAttribute('aria-label', 'Toggle Bandcamp Enhancement Suite Settings');

  const icon = document.createElement('img');
  icon.className = 'findmusic-button-icon';
  icon.src = chrome.runtime.getURL('icons/icon48.png');
  icon.alt = 'BES Settings';

  button.appendChild(icon);
  button.addEventListener('click', () => {
    log.info('BES settings button clicked');
    toggleDrawer();
  });

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);
  document.body.appendChild(button);

  const carouselPlayer = document.querySelector('.carousel-player');
  if (carouselPlayer?.parentElement) {
    const originalBottom = window.getComputedStyle(button).bottom;

    const observer = new MutationObserver(() => {
      const isPlayerVisible = carouselPlayer.parentElement?.classList.contains('show-player');
      button.style.bottom = isPlayerVisible ? '90px' : originalBottom;
    });

    observer.observe(carouselPlayer.parentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  log.info('BES drawer and button added to page');
};

const main = async (): Promise<void> => {
  const checkIsDownloadPage: Element | null = document.querySelector('.download-item-container');
  if (checkIsDownloadPage) {
    initDownload();
  }

  const config_port: chrome.runtime.Port = (() => {
    try {
      return chrome.runtime.connect(null, { name: 'bes' });
    } catch (e: any) {
      if (e.message?.includes('Error in invocation of runtime.connect in main.js')) {
        log.error(e);
      }
      throw e;
    }
  })();

  initLabelView(config_port);

  const checkIsPageWithPlayer: Element | null = document.querySelector('div.inline_player');
  if (checkIsPageWithPlayer && window.location.href !== 'https://bandcamp.com/') {
    let keyboardSettings: KeyboardSettings | undefined;
    let enableFetchCaching = false;

    const getConfigPromise = new Promise<void>(resolve => {
      const listener = (msg: any) => {
        if (msg.config && msg.config.keyboardSettings) {
          keyboardSettings = msg.config.keyboardSettings;
          enableFetchCaching = msg.config.enableFetchCaching ?? false;
          config_port.onMessage.removeListener(listener);
          resolve();
        }
      };
      config_port.onMessage.addListener(listener);
      config_port.postMessage({ requestConfig: {} });

      setTimeout(() => {
        config_port.onMessage.removeListener(listener);
        resolve();
      }, 1000);
    });

    await getConfigPromise;
    await initPlayer(keyboardSettings, enableFetchCaching);

    config_port.onMessage.addListener((msg: any) => {
      if (msg.config && msg.config.keyboardSettings) {
        log.info('Keyboard settings changed, updating handlers');
        updateKeyboardHandlers(msg.config.keyboardSettings);
      }
    });

    initAudioFeatures(config_port);
  }

  const urlParams = new URLSearchParams(window.location.search);
  const besCartParamValue = urlParams.get('bes_cart');
  const hasBesCartParam = besCartParamValue !== null;
  const hasStoredCartData = sessionStorage.getItem('bes_pending_cart_import') !== null;
  const processingFlag = sessionStorage.getItem('bes_cart_processing');

  log.info(
    `Page load state - hasParam: ${hasBesCartParam}, hasStored: ${hasStoredCartData}, processing: ${processingFlag}`
  );

  if (hasBesCartParam) {
    log.info(`Found bes_cart parameter in URL on page load!`);

    sessionStorage.setItem('bes_url_cart_param', besCartParamValue!);

    const newSearch = Array.from(urlParams.entries())
      .filter(([key]) => key !== 'bes_cart')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;

    log.info(`Redirecting to clean URL: ${window.location.origin}${newUrl}`);

    window.location.replace(newUrl);
    return;
  }

  const dataBlobElement: Element | null = document.querySelector('[data-blob]');
  if (dataBlobElement) {
    const dataBlobAttr: string | null = dataBlobElement.getAttribute('data-blob');
    if (dataBlobAttr) {
      const { has_cart }: { has_cart: boolean } = JSON.parse(dataBlobAttr);
      if (has_cart || hasBesCartParam || hasStoredCartData) {
        await initCart(config_port);
      }
    }
  }

  const checkIsCollectionPage: Element | null = document.querySelector('ol.collection-grid.editable.ui-sortable');
  if (checkIsCollectionPage) {
    await initHideUnhide(config_port);
  }

  initBESDrawer(config_port);
};

main();
