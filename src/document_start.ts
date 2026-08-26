import { createLogger } from './logger';

const log = createLogger();

// Runs before the page has built any DOM. Nothing here may touch document elements --
// hand work over to document_idle through sessionStorage instead.

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

  // Replacing this early aborts the current load, so document_idle never runs on this
  // navigation -- the cart data is picked up from sessionStorage after the redirect.
  window.location.replace(newUrl);
};

const documentStart = (): void => {
  captureUrlCartParam();
};

documentStart();
