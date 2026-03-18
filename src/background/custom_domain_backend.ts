import Logger from '../logger';

const log = new Logger();

export function validateDomain(domain: string): { valid: boolean; error?: string } {
  if (!domain || typeof domain !== 'string') {
    return { valid: false, error: 'Domain must be a non-empty string' };
  }

  const trimmedDomain = domain.trim();

  if (trimmedDomain.length === 0) {
    return { valid: false, error: 'Domain cannot be empty' };
  }

  if (trimmedDomain.length > 253) {
    return { valid: false, error: 'Domain is too long (max 253 characters)' };
  }

  if (trimmedDomain.includes('://')) {
    return { valid: false, error: 'Domain should not include protocol (http:// or https://)' };
  }

  if (trimmedDomain.includes('/')) {
    return { valid: false, error: 'Domain should not include paths' };
  }

  if (trimmedDomain.includes('*')) {
    return { valid: false, error: 'Domain should not include wildcards' };
  }

  if (trimmedDomain.includes('<') || trimmedDomain.includes('>')) {
    return { valid: false, error: 'Domain contains invalid characters' };
  }

  const domainPattern =
    /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  if (!domainPattern.test(trimmedDomain)) {
    return { valid: false, error: 'Invalid domain format' };
  }

  return { valid: true };
}

export function domainToMatchPatterns(domain: string): string[] {
  return [`https://*.${domain}/*`, `http://*.${domain}/*`];
}

export async function unregisterContentScriptsForDomain(domain: string): Promise<void> {
  try {
    const scriptId = `bes-custom-${domain}`;
    await chrome.scripting.unregisterContentScripts({ ids: [scriptId] });
    log.info(`Unregistered content scripts for domain: ${domain}`);
  } catch (error) {
    log.warn(`Failed to unregister content scripts for ${domain}: ${error}`);
  }
}

export async function processRemoveDomain(domain: string): Promise<void> {
  log.info(`Processing remove domain request for: ${domain}`);

  const patterns = domainToMatchPatterns(domain);

  try {
    await chrome.permissions.remove({
      origins: patterns
    });
    log.info(`Removed permissions for domain: ${domain}`);
  } catch (error) {
    log.error(`Failed to remove permissions for ${domain}: ${error}`);
  }

  await unregisterContentScriptsForDomain(domain);
}

export function processRequestAddDomain(domain: string): void {
  log.info(`Processing add domain request for: ${domain}`);

  const validation = validateDomain(domain);
  if (!validation.valid) {
    log.error(`Invalid domain: ${validation.error}`);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon48.png'),
      title: 'Invalid Domain',
      message: validation.error || 'Invalid domain format'
    });
    return;
  }

  chrome.windows.getCurrent((currentWindow: chrome.windows.Window) => {
    const width = 500;
    const height = 600;
    const left = currentWindow.left ? Math.round(currentWindow.left + (currentWindow.width! - width) / 2) : undefined;
    const top = currentWindow.top ? Math.round(currentWindow.top + (currentWindow.height! - height) / 2) : undefined;

    chrome.windows.create({
      url: chrome.runtime.getURL(`html/custom_domain_permission.html?domain=${encodeURIComponent(domain)}`),
      type: 'popup',
      width,
      height,
      left,
      top,
      focused: true
    });
  });
}

export function processRequest(
  request: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  if (request.contentScriptQuery === 'requestAddCustomDomain') {
    processRequestAddDomain(request.domain);
    sendResponse({ success: true });
    return true;
  }

  if (request.contentScriptQuery === 'removeCustomDomain') {
    processRemoveDomain(request.domain).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  return false;
}

export async function initCustomDomainBackend(): Promise<void> {
  log.info('starting Custom Domain backend.');
  chrome.runtime.onMessage.addListener(processRequest);
}
