import Logger from './logger';

const log = new Logger();
const status = document.getElementById('status')!;
const button = document.getElementById('grant-permission') as HTMLButtonElement;
const cancelButton = document.getElementById('cancel-button')!;
const domainName = document.getElementById('domain-name')!;

const headerLogo = document.getElementById('header-logo') as HTMLImageElement;
if (headerLogo) {
  headerLogo.src = chrome.runtime.getURL('icons/icon48.png');
}

const urlParams = new URLSearchParams(window.location.search);
const domain = urlParams.get('domain');

if (!domain) {
  status.textContent = 'Error: No domain specified';
  status.classList.add('show', 'error');
  button.disabled = true;
} else {
  domainName.textContent = `https://*.${domain}/* and http://*.${domain}/*`;
}

cancelButton.addEventListener('click', () => {
  log.info('User cancelled custom domain authorization');
  window.close();
});

async function registerContentScripts(domain: string): Promise<void> {
  try {
    const scriptId = `bes-custom-${domain}`;

    const existingScripts = await chrome.scripting.getRegisteredContentScripts({ ids: [scriptId] });
    if (existingScripts.length > 0) {
      log.info(`Content script already registered for ${domain}, updating...`);
      await chrome.scripting.unregisterContentScripts({ ids: [scriptId] });
    }

    await chrome.scripting.registerContentScripts([
      {
        id: scriptId,
        matches: [`https://*.${domain}/*`, `http://*.${domain}/*`],
        js: ['dist/main.js'],
        css: ['css/style.css'],
        runAt: 'document_idle'
      }
    ]);

    log.info(`Registered content scripts for domain: ${domain}`);
  } catch (error) {
    log.error(`Failed to register content scripts: ${error}`);
    throw error;
  }
}

button.addEventListener('click', async () => {
  if (!domain) {
    return;
  }

  try {
    status.textContent = 'Requesting permission...';
    status.classList.add('show');
    status.classList.remove('error');
    button.disabled = true;

    const patterns = [`https://*.${domain}/*`, `http://*.${domain}/*`];

    const granted = await chrome.permissions.request({
      origins: patterns
    });

    if (granted) {
      status.textContent = 'Permission granted! Registering content scripts...';
      log.info(`User granted permissions for domain: ${domain}`);

      await registerContentScripts(domain);

      status.textContent = 'Success! Saving configuration...';

      const port = chrome.runtime.connect(null, { name: 'bes' });
      port.postMessage({ addCustomDomain: domain });

      await new Promise(resolve => setTimeout(resolve, 500));

      window.close();
    } else {
      status.textContent = 'Permission denied. Please try again.';
      status.classList.add('error');
      log.warn(`User denied permissions for domain: ${domain}`);
      button.disabled = false;
    }
  } catch (error) {
    log.error(`Error requesting permission: ${error}`);
    status.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    status.classList.add('error');
    button.disabled = false;
  }
});
