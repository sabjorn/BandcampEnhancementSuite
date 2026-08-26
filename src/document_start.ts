import { createLogger } from './logger';

const log = createLogger();

const warmServiceWorker = (): void => {
  chrome.runtime
    .sendMessage({ contentScriptQuery: 'warmup' })
    .catch(() => log.debug('Warm-up message went unanswered; the worker still booted'));
};

const captureUrlCartParam = (): void => {
  const urlParams = new URLSearchParams(window.location.search);
  const besCartParamValue = urlParams.get('bes_cart');
  if (besCartParamValue === null) return;

  log.info('Found bes_cart parameter in URL on page load!');

  sessionStorage.setItem('bes_url_cart_param', besCartParamValue);

  const newUrl = (() => {
    const newSearch = Array.from(urlParams.entries())
      .filter(([key]) => key !== 'bes_cart')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    return window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
  })();

  log.info(`Redirecting to clean URL: ${window.location.origin}${newUrl}`);

  window.location.replace(newUrl);
};

warmServiceWorker();
captureUrlCartParam();
