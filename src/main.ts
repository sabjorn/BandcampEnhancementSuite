import { createLogger } from './logger';
import { initLabelView } from './label_view';
import { initDownload } from './pages/download';
import { initPlayer } from './player';
import { initAudioFeatures } from './audioFeatures';
import { initCart } from './pages/cart';
import { initHideUnhide } from './pages/hide_unhide_collection';

const log = createLogger();

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

  const settingsTitle = document.createElement('h3');
  settingsTitle.textContent = 'Settings';

  const waveformSettingRow = document.createElement('div');
  waveformSettingRow.className = 'bes-drawer-setting';

  const waveformLabelText = document.createElement('span');
  waveformLabelText.className = 'bes-drawer-setting-label';
  waveformLabelText.textContent = 'Display Waveform';

  const waveformToggle = document.createElement('input');
  waveformToggle.setAttribute('type', 'checkbox');
  waveformToggle.setAttribute('class', 'waveform');
  waveformToggle.setAttribute('id', 'bes-waveform-toggle');

  const waveformLabel = document.createElement('label');
  waveformLabel.setAttribute('class', 'waveform');
  waveformLabel.htmlFor = 'bes-waveform-toggle';
  waveformLabel.innerHTML = 'Toggle';

  const waveformToggleContainer = document.createElement('div');
  waveformToggleContainer.appendChild(waveformToggle);
  waveformToggleContainer.appendChild(waveformLabel);

  waveformSettingRow.appendChild(waveformLabelText);
  waveformSettingRow.appendChild(waveformToggleContainer);

  settingsSection.appendChild(settingsTitle);
  settingsSection.appendChild(waveformSettingRow);

  config_port.onMessage.addListener((msg: any) => {
    if (msg.config && typeof msg.config.displayWaveform === 'boolean') {
      waveformToggle.checked = msg.config.displayWaveform;
    }
  });

  waveformToggle.addEventListener('change', () => {
    config_port.postMessage({ toggleWaveformDisplay: {} });
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
    } catch (error) {
      log.error(`Failed to check permissions: ${error}`);
      findMusicButton.textContent = 'Enable FindMusic.club Integration';
    }
  };

  updateButtonText();

  findMusicSection.appendChild(findMusicTitle);
  findMusicSection.appendChild(findMusicDesc);
  findMusicSection.appendChild(findMusicButton);

  const customDomainsSection = document.createElement('div');
  customDomainsSection.className = 'bes-drawer-section';

  const customDomainsTitle = document.createElement('h3');
  customDomainsTitle.textContent = 'Custom Bandcamp Domains';

  const customDomainsDesc = document.createElement('p');
  customDomainsDesc.textContent = 'Add custom domains where artists host their Bandcamp pages (e.g., example.com)';

  const domainInputRow = document.createElement('div');
  domainInputRow.className = 'bes-domain-input-row';

  const domainInput = document.createElement('input');
  domainInput.type = 'text';
  domainInput.className = 'bes-domain-input';
  domainInput.placeholder = 'example.com';

  const addButton = document.createElement('button');
  addButton.className = 'bes-drawer-button';
  addButton.textContent = 'Add Domain';
  addButton.style.marginLeft = '8px';

  domainInputRow.appendChild(domainInput);
  domainInputRow.appendChild(addButton);

  const domainList = document.createElement('div');
  domainList.className = 'bes-domain-list';

  const loadDomains = () => {
    config_port.postMessage({ getCustomDomains: {} });
  };

  config_port.onMessage.addListener((msg: any) => {
    if (msg.customDomains) {
      domainList.innerHTML = '';
      msg.customDomains.forEach((domain: string) => {
        const domainItem = document.createElement('div');
        domainItem.className = 'bes-domain-item';

        const domainText = document.createElement('span');
        domainText.textContent = domain;

        const removeButton = document.createElement('button');
        removeButton.className = 'bes-domain-remove';
        removeButton.innerHTML = '×';
        removeButton.setAttribute('aria-label', `Remove ${domain}`);

        removeButton.addEventListener('click', () => {
          chrome.runtime.sendMessage({
            contentScriptQuery: 'removeCustomDomain',
            domain: domain
          });
          config_port.postMessage({ removeCustomDomain: domain });
        });

        domainItem.appendChild(domainText);
        domainItem.appendChild(removeButton);
        domainList.appendChild(domainItem);
      });
    }
  });

  addButton.addEventListener('click', () => {
    const domain = domainInput.value.trim();
    if (domain) {
      chrome.runtime.sendMessage({
        contentScriptQuery: 'requestAddCustomDomain',
        domain: domain
      });
      domainInput.value = '';
    }
  });

  domainInput.addEventListener('keypress', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      addButton.click();
    }
  });

  customDomainsSection.appendChild(customDomainsTitle);
  customDomainsSection.appendChild(customDomainsDesc);
  customDomainsSection.appendChild(domainInputRow);
  customDomainsSection.appendChild(domainList);

  content.appendChild(settingsSection);
  content.appendChild(findMusicSection);
  content.appendChild(customDomainsSection);

  drawer.appendChild(header);
  drawer.appendChild(content);

  const overlay = document.createElement('div');
  overlay.className = 'bes-drawer-overlay';

  const openDrawer = async () => {
    await updateButtonText();
    loadDomains();
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
        throw e;
      } else {
        throw e;
      }
    }
  })();

  initLabelView(config_port);

  const checkIsPageWithPlayer: Element | null = document.querySelector('div.inline_player');
  if (checkIsPageWithPlayer && window.location.href !== 'https://bandcamp.com/') {
    await initPlayer();
    initAudioFeatures(config_port);
  }

  const dataBlobElement: Element | null = document.querySelector('[data-blob]');
  if (dataBlobElement) {
    const dataBlobAttr: string | null = dataBlobElement.getAttribute('data-blob');
    if (dataBlobAttr) {
      const { has_cart }: { has_cart: boolean } = JSON.parse(dataBlobAttr);
      if (has_cart) {
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
