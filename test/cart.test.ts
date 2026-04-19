import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  }
}));

vi.mock('../src/bclient', () => ({
  addAlbumToCart: vi.fn().mockResolvedValue(new Response('{"success": true}', { status: 200 })),
  getTralbumDetails: vi.fn().mockResolvedValue({ id: 123, title: 'Test Album', price: 10 }),
  CURRENCY_MINIMUMS: { USD: 0.5, EUR: 0.25 }
}));

vi.mock('../src/utilities', () => ({
  downloadFile: vi.fn(),
  dateString: vi.fn().mockReturnValue('25-01-01'),
  loadTextFile: vi.fn(),
  createFetchFunction: vi.fn(() => globalThis.fetch)
}));

vi.mock('../src/components/notifications', () => ({
  showSuccessMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  updatePersistentNotification: vi.fn(),
  showPersistentNotification: vi.fn(),
  removePersistentNotification: vi.fn()
}));

const mockButtons: HTMLButtonElement[] = [];

vi.mock('../src/components/buttons', () => ({
  createButton: vi.fn(options => {
    const button = document.createElement('button');
    button.onclick = options?.buttonClicked || (() => {});
    button.textContent = options?.innerText || '';
    button.className = options?.className || '';
    Object.defineProperty(button, 'style', {
      value: { display: 'block' },
      writable: true,
      configurable: true
    });
    mockButtons.push(button);

    const sidecartReveal = document.querySelector('#sidecartReveal');
    if (sidecartReveal) {
      sidecartReveal.appendChild(button);
    }

    return button;
  }),
  createInputButtonPair: vi.fn().mockImplementation(options => {
    const div = document.createElement('div');
    div.classList = { add: vi.fn() } as any;
    Object.defineProperty(div, 'style', {
      value: { display: 'block' },
      writable: true,
      configurable: true
    });
    if (options?.onButtonClick) {
      const button = document.createElement('button');
      button.onclick = () => options.onButtonClick(10);
      div.appendChild(button);
    }

    const sidecartSummary = document.querySelector('#sidecartSummary');
    if (sidecartSummary) {
      sidecartSummary.appendChild(div);
    }

    return div;
  })
}));

vi.mock('../src/components/shoppingCart', () => ({
  createShoppingCartItem: vi.fn().mockReturnValue(document.createElement('div'))
}));

vi.mock('../src/components/svgIcons', () => ({
  createPlusSvgIcon: vi.fn().mockReturnValue(document.createElement('div'))
}));

import { initCart } from '../src/pages/cart';
import { loadTextFile, downloadFile } from '../src/utilities';
import { getTralbumDetails } from '../src/bclient';
import {
  showErrorMessage,
  showSuccessMessage,
  showPersistentNotification,
  updatePersistentNotification
} from '../src/components/notifications';

const mockLoadTextFile = loadTextFile as any;
const mockDownloadFile = downloadFile as any;

describe('Cart', () => {
  let mockPort: any;

  beforeEach(() => {
    mockPort = {
      onMessage: {
        addListener: vi.fn()
      },
      postMessage: vi.fn()
    };

    global.chrome = {
      runtime: {
        connect: vi.fn().mockReturnValue(mockPort)
      }
    } as any;

    global.location = {
      reload: vi.fn()
    } as any;

    global.MutationObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn()
    }));
  });

  afterEach(() => {
    cleanupTestNodes();
    mockButtons.length = 0;
    vi.clearAllMocks();
  });

  describe('init()', () => {
    beforeEach(() => {
      createDomNodes(`
        <div id="sidecartReveal">
          <div class="cart-controls"></div>
        </div>
        <div id="sidecartSummary"></div>
        <div id="item_list"></div>
      `);
    });

    it('should initialize cart functionality', async () => {
      await expect(initCart(mockPort)).resolves.not.toThrow();
    });
  });

  describe('cart import functionality', () => {
    let importButton: HTMLButtonElement;

    beforeEach(async () => {
      createDomNodes(`
        <div id="sidecartReveal"></div>
        <div id="sidecartSummary"></div>
        <div id="item_list"></div>
        <div data-tralbum='{"current":{"id":1609998585,"type":"album"},"artist":"BES"}' style="display:none"></div>
      `);

      initCart(mockPort);

      importButton = mockButtons.find(btn => btn.textContent === 'import') as HTMLButtonElement;
    });

    it('should handle valid JSON import', async () => {
      const mockCartData = {
        tracks_export: [
          {
            item_id: 123,
            item_type: 'a',
            item_title: 'Test Album',
            band_name: 'Test Band',
            unit_price: 10,
            currency: 'USD',
            url: 'https://test.bandcamp.com/album/test'
          }
        ]
      };

      mockLoadTextFile.mockResolvedValue(JSON.stringify(mockCartData));

      await importButton.click();

      expect(mockLoadTextFile).toHaveBeenCalled();
      expect(showPersistentNotification).toHaveBeenCalledWith({
        id: 'cart-import-progress',
        message: 'Starting import of 1 items...',
        type: 'info'
      });
      expect(mockPort.postMessage).toHaveBeenCalledWith({
        cartImport: { items: mockCartData.tracks_export }
      });
    });

    it('should handle import with missing prices', async () => {
      const mockCartData = {
        tracks_export: [
          {
            item_id: 123,
            item_type: 'a',
            item_title: 'Test Album',
            band_name: 'Test Band',
            currency: 'USD',
            url: 'https://test.bandcamp.com/album/test'
          }
        ]
      };

      mockLoadTextFile.mockResolvedValue(JSON.stringify(mockCartData));

      await importButton.click();

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        cartImport: { items: mockCartData.tracks_export }
      });
    });

    it('should show error for invalid JSON format', async () => {
      mockLoadTextFile.mockResolvedValue(JSON.stringify({ invalid: 'data' }));

      await importButton.click();

      expect(showErrorMessage).toHaveBeenCalledWith('Invalid JSON format - missing tracks_export');
    });

    it('should show error for empty cart', async () => {
      mockLoadTextFile.mockResolvedValue(JSON.stringify({ tracks_export: [] }));

      await importButton.click();

      expect(showErrorMessage).toHaveBeenCalledWith('No items found in import file');
    });

    it('should handle file load errors', async () => {
      mockLoadTextFile.mockRejectedValue(new Error('File load failed'));

      await importButton.click();

      expect(showErrorMessage).toHaveBeenCalledWith('Error loading file: Error: File load failed');
    });
  });

  describe('URL import functionality', () => {
    let importButton: HTMLButtonElement;

    beforeEach(async () => {
      createDomNodes(`
        <div id="sidecartReveal"></div>
        <div id="sidecartSummary"></div>
        <div id="item_list"></div>
        <div data-tralbum='{"current":{"id":1609998585,"type":"album"},"artist":"BES"}' style="display:none"></div>
      `);

      initCart(mockPort);
      importButton = mockButtons.find(btn => btn.textContent === 'import') as HTMLButtonElement;
    });

    it('should handle valid URL import', async () => {
      const urlContent = `https://test.bandcamp.com/album/test-album
https://test.bandcamp.com/track/test-track`;

      mockLoadTextFile.mockResolvedValue(urlContent);

      await importButton.click();

      expect(mockLoadTextFile).toHaveBeenCalled();
      expect(showPersistentNotification).toHaveBeenCalledWith({
        id: 'cart-import-progress',
        message: 'Starting import of 2 URLs...',
        type: 'info'
      });
      expect(mockPort.postMessage).toHaveBeenCalledWith({
        cartUrlImport: {
          urls: ['https://test.bandcamp.com/album/test-album', 'https://test.bandcamp.com/track/test-track']
        }
      });
    });

    it('should filter out non-bandcamp URLs', async () => {
      const urlContent = `https://test.bandcamp.com/album/test-album
https://spotify.com/track/invalid
https://test.bandcamp.com/track/test-track
invalid line`;

      mockLoadTextFile.mockResolvedValue(urlContent);

      await importButton.click();

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        cartUrlImport: {
          urls: ['https://test.bandcamp.com/album/test-album', 'https://test.bandcamp.com/track/test-track']
        }
      });
    });

    it('should show error when no valid URLs found', async () => {
      mockLoadTextFile.mockResolvedValue('https://spotify.com/invalid\nhttps://youtube.com/invalid');

      await importButton.click();

      expect(showErrorMessage).toHaveBeenCalledWith('File contains no valid JSON data or Bandcamp URLs');
    });

    it('should handle JSON files as cart import', async () => {
      const jsonContent = '{"tracks_export": []}';

      mockLoadTextFile.mockResolvedValue(jsonContent);

      await importButton.click();

      expect(showErrorMessage).toHaveBeenCalledWith('No items found in import file');
    });
  });

  describe('cart export functionality', () => {
    beforeEach(() => {
      createDomNodes(`
        <div id="sidecartReveal"></div>
        <div id="sidecartSummary"></div>
        <div id="item_list"></div>
        <div data-cart='{"items": [{"cart_id": "test123", "item_type": "a", "item_id": 123, "band_name": "Test Band", "item_title": "Test Album", "unit_price": 15, "url": "https://test.bandcamp.com/album/test", "currency": "USD"}]}'></div>
        <div data-tralbum='{"current":{"id":1609998585,"type":"album"},"artist":"BES"}' style="display:none"></div>
      `);
    });

    it('should export cart with price optimization', async () => {
      (getTralbumDetails as any).mockResolvedValue({ price: 10.0 });

      initCart(mockPort);

      const exportButton = mockButtons.find(btn => btn.textContent === 'export') as HTMLButtonElement;

      await exportButton.click();

      expect(getTralbumDetails).toHaveBeenCalled();
      expect(mockDownloadFile).toHaveBeenCalledWith(
        '25-01-01_test123_bes_cart_export.json',
        expect.stringContaining('"unit_price": 15')
      );
    });

    it('should omit price when it matches minimum', async () => {
      (getTralbumDetails as any).mockResolvedValue({ price: 15.0 });

      createDomNodes(`
        <div id="sidecartReveal"></div>
        <div data-cart='{"items": [{"cart_id": "test123", "item_type": "a", "item_id": 123, "band_name": "Test Band", "item_title": "Test Album", "unit_price": 15, "url": "https://test.bandcamp.com/album/test", "currency": "USD"}]}'></div>
      `);

      initCart(mockPort);

      const exportButton = mockButtons.find(btn => btn.textContent === 'export') as HTMLButtonElement;

      await exportButton.click();

      const downloadCall = mockDownloadFile.mock.calls[0];
      const exportedData = JSON.parse(downloadCall[1]);

      expect(exportedData.tracks_export[0]).not.toHaveProperty('unit_price');
    });

    it('should handle export errors gracefully', async () => {
      (getTralbumDetails as any).mockRejectedValue(new Error('HTTP 404: Not Found'));

      initCart(mockPort);

      const exportButton = mockButtons.find(btn => btn.textContent === 'export') as HTMLButtonElement;

      await exportButton.click();

      const downloadCall = mockDownloadFile.mock.calls[0];
      const exportedData = JSON.parse(downloadCall[1]);

      expect(exportedData.tracks_export[0]).toHaveProperty('unit_price', 15);
    });

    it('should not export when cart is empty', async () => {
      cleanupTestNodes();
      createDomNodes(`
        <div id="sidecartReveal"></div>
        <div id="sidecartSummary"></div>
        <div id="item_list"></div>
        <div data-cart='{"items": []}'></div>
        <div data-tralbum='{"current":{"id":1609998585,"type":"album"},"artist":"BES"}' style="display:none"></div>
      `);

      initCart(mockPort);

      const exportButton = mockButtons.find(btn => btn.textContent === 'export') as HTMLButtonElement;

      await exportButton.click();

      expect(mockDownloadFile).not.toHaveBeenCalled();
    });
  });

  describe('cart import message handling', () => {
    beforeEach(async () => {
      createDomNodes(`
        <div id="sidecartReveal"></div>
        <div id="sidecartSummary"></div>
        <div id="item_list"></div>
        <div data-tralbum='{"current":{"id":1609998585,"type":"album"},"artist":"BES"}' style="display:none"></div>
      `);
      initCart(mockPort);
    });

    it('should add successful cart items to DOM', async () => {
      const mockCartRequest = {
        item_id: 12345,
        item_type: 'a',
        item_title: 'Test Album',
        band_name: 'Test Band',
        unit_price: 10.5,
        currency: 'USD',
        url: 'https://test.bandcamp.com/album/test'
      };

      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0];

      await messageHandler({ cartAddRequest: mockCartRequest });

      const itemList = document.querySelector('#item_list');
      expect(itemList?.children.length).toBe(1);

      const { createShoppingCartItem } = await import('../src/components/shoppingCart');
      expect(createShoppingCartItem).toHaveBeenCalledWith({
        itemId: '12345',
        itemName: 'Test Album',
        itemPrice: 10.5,
        itemCurrency: 'USD'
      });
    });

    it('should show individual error notifications for failed cart additions', async () => {
      const mockCartRequest = {
        item_id: 12345,
        item_type: 'a',
        item_title: 'Test Album',
        band_name: 'Test Band',
        unit_price: 10.5,
        currency: 'USD',
        url: 'https://test.bandcamp.com/album/test'
      };

      const { addAlbumToCart } = await import('../src/bclient');
      (addAlbumToCart as any).mockResolvedValue(new Response('{}', { status: 400 }));

      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0];

      await messageHandler({ cartAddRequest: mockCartRequest });

      expect(showErrorMessage).toHaveBeenCalledWith('Failed to add "Test Album" to cart');

      const itemList = document.querySelector('#item_list');
      expect(itemList?.children.length).toBe(0);
    });

    it('should show simple completion message', async () => {
      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0];

      await messageHandler({ cartImportComplete: { message: 'Successfully added 2 items to cart' } });

      expect(showSuccessMessage).toHaveBeenCalledWith('Successfully added 2 items to cart');
    });

    it('should show individual item error notifications from backend', async () => {
      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0];

      await messageHandler({
        cartItemError: {
          message: 'Failed to add "Test Album" to cart'
        }
      });

      expect(showErrorMessage).toHaveBeenCalledWith('Failed to add "Test Album" to cart');
    });

    it('should handle cart import state updates with rich HTML', async () => {
      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0];

      const importState = {
        isProcessing: true,
        processedCount: 2,
        totalCount: 5,
        errors: ['Error processing item 123'],
        operation: 'url_import'
      };

      await messageHandler({ cartImportState: importState });

      expect(updatePersistentNotification).toHaveBeenCalledWith(
        'cart-import-progress',
        expect.stringContaining('🛒 Importing URLs...')
      );
      expect(updatePersistentNotification).toHaveBeenCalledWith(
        'cart-import-progress',
        expect.stringContaining('Progress: 2/5')
      );
      expect(updatePersistentNotification).toHaveBeenCalledWith(
        'cart-import-progress',
        expect.stringContaining('1 errors occurred')
      );
    });
  });

  describe('URL-based cart import', () => {
    beforeEach(() => {
      createDomNodes(`
        <div id="sidecartReveal"></div>
        <div id="sidecartSummary"></div>
        <div id="item_list"></div>
        <div data-tralbum='{"current":{"id":1609998585,"type":"album"},"artist":"BES"}' style="display:none"></div>
      `);

      global.sessionStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn()
      };
    });

    it('should not process when no bes_cart parameter exists', async () => {
      delete (global as any).window;
      (global as any).window = {
        location: { search: '', href: 'https://bandcamp.com/' },
        history: { replaceState: vi.fn() }
      };

      initCart(mockPort);

      expect(mockPort.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ cartImport: expect.anything() })
      );
    });

    it('should process valid bes_cart parameter with items only', async () => {
      const cartData = {
        items: [
          { id: 1234, type: 'a' },
          { id: 5678, type: 't' }
        ]
      };
      const encoded = btoa(JSON.stringify(cartData));

      delete (global as any).window;
      (global as any).window = {
        location: { search: `?bes_cart=${encoded}`, href: `https://bandcamp.com/?bes_cart=${encoded}` },
        history: { replaceState: vi.fn() },
        sessionStorage: global.sessionStorage
      };

      initCart(mockPort);

      expect(showPersistentNotification).toHaveBeenCalledWith({
        id: 'cart-import-progress',
        message: 'Starting import of 2 items from URL...',
        type: 'info'
      });

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        cartImport: {
          items: [
            { item_id: 1234, item_type: 'a', item_title: '', band_name: '', currency: '', url: '' },
            { item_id: 5678, item_type: 't', item_title: '', band_name: '', currency: '', url: '' }
          ]
        }
      });
    });

    it('should process valid bes_cart parameter with donation item', async () => {
      const cartData = {
        items: [{ id: 1234, type: 'a' }],
        donation: { id: 9999, type: 'a', message: 'Thank you for your support!' }
      };
      const encoded = btoa(JSON.stringify(cartData));

      delete (global as any).window;
      (global as any).window = {
        location: { search: `?bes_cart=${encoded}`, href: `https://bandcamp.com/?bes_cart=${encoded}` },
        history: { replaceState: vi.fn() },
        sessionStorage: global.sessionStorage
      };

      initCart(mockPort);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        cartImport: {
          items: [{ item_id: 1234, item_type: 'a', item_title: '', band_name: '', currency: '', url: '' }]
        }
      });

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        cartDonationItem: {
          item_id: 9999,
          item_type: 'a',
          message: 'Thank you for your support!'
        }
      });
    });

    it('should process donation without custom message', async () => {
      const cartData = {
        items: [{ id: 1234, type: 'a' }],
        donation: { id: 9999, type: 'a' }
      };
      const encoded = btoa(JSON.stringify(cartData));

      delete (global as any).window;
      (global as any).window = {
        location: { search: `?bes_cart=${encoded}`, href: `https://bandcamp.com/?bes_cart=${encoded}` },
        history: { replaceState: vi.fn() },
        sessionStorage: global.sessionStorage
      };

      initCart(mockPort);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        cartDonationItem: {
          item_id: 9999,
          item_type: 'a',
          message: undefined
        }
      });
    });

    it('should remove bes_cart parameter from URL after processing', async () => {
      const cartData = { items: [{ id: 1234, type: 'a' }] };
      const encoded = btoa(JSON.stringify(cartData));

      const mockReplaceState = vi.fn();
      delete (global as any).window;
      (global as any).window = {
        location: {
          search: `?bes_cart=${encoded}&other=param`,
          href: `https://bandcamp.com/?bes_cart=${encoded}&other=param`
        },
        history: { replaceState: mockReplaceState },
        sessionStorage: global.sessionStorage
      };

      initCart(mockPort);

      expect(mockReplaceState).toHaveBeenCalledWith({}, '', 'https://bandcamp.com/?other=param');
    });

    it('should show error for invalid base64', async () => {
      delete (global as any).window;
      (global as any).window = {
        location: { search: '?bes_cart=invalid!!!base64', href: 'https://bandcamp.com/?bes_cart=invalid!!!base64' },
        history: { replaceState: vi.fn() },
        sessionStorage: global.sessionStorage
      };

      initCart(mockPort);

      expect(showErrorMessage).toHaveBeenCalledWith('Invalid cart data in URL');
      expect(mockPort.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ cartImport: expect.anything() })
      );
    });

    it('should show error for invalid JSON structure', async () => {
      const encoded = btoa('not valid json{]');

      delete (global as any).window;
      (global as any).window = {
        location: { search: `?bes_cart=${encoded}`, href: `https://bandcamp.com/?bes_cart=${encoded}` },
        history: { replaceState: vi.fn() },
        sessionStorage: global.sessionStorage
      };

      initCart(mockPort);

      expect(showErrorMessage).toHaveBeenCalledWith('Invalid cart data in URL');
    });

    it('should show error for missing items array', async () => {
      const cartData = { donation: { id: 1, type: 'a' } };
      const encoded = btoa(JSON.stringify(cartData));

      delete (global as any).window;
      (global as any).window = {
        location: { search: `?bes_cart=${encoded}`, href: `https://bandcamp.com/?bes_cart=${encoded}` },
        history: { replaceState: vi.fn() },
        sessionStorage: global.sessionStorage
      };

      initCart(mockPort);

      expect(showErrorMessage).toHaveBeenCalledWith('Invalid cart data in URL');
    });

    it('should show error for empty items array', async () => {
      const cartData = { items: [] };
      const encoded = btoa(JSON.stringify(cartData));

      delete (global as any).window;
      (global as any).window = {
        location: { search: `?bes_cart=${encoded}`, href: `https://bandcamp.com/?bes_cart=${encoded}` },
        history: { replaceState: vi.fn() },
        sessionStorage: global.sessionStorage
      };

      initCart(mockPort);

      expect(showErrorMessage).toHaveBeenCalledWith('Invalid cart data in URL');
    });

    it('should validate item structure and show error for invalid items', async () => {
      const cartData = {
        items: [{ id: 'not-a-number', type: 'a' }]
      };
      const encoded = btoa(JSON.stringify(cartData));

      delete (global as any).window;
      (global as any).window = {
        location: { search: `?bes_cart=${encoded}`, href: `https://bandcamp.com/?bes_cart=${encoded}` },
        history: { replaceState: vi.fn() },
        sessionStorage: global.sessionStorage
      };

      initCart(mockPort);

      expect(showErrorMessage).toHaveBeenCalledWith('Invalid cart data in URL');
    });

    it('should skip invalid donation but still process items', async () => {
      const cartData = {
        items: [{ id: 1234, type: 'a' }],
        donation: { id: 'invalid', type: 'a' }
      };
      const encoded = btoa(JSON.stringify(cartData));

      delete (global as any).window;
      (global as any).window = {
        location: { search: `?bes_cart=${encoded}`, href: `https://bandcamp.com/?bes_cart=${encoded}` },
        history: { replaceState: vi.fn() },
        sessionStorage: global.sessionStorage
      };

      initCart(mockPort);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        cartImport: {
          items: [{ item_id: 1234, item_type: 'a', item_title: '', band_name: '', currency: '', url: '' }]
        }
      });

      expect(mockPort.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ cartDonationItem: expect.anything() })
      );
    });
  });

  describe('donation banner', () => {
    beforeEach(async () => {
      createDomNodes(`
        <div id="sidecartReveal"></div>
        <div id="sidecartSummary"></div>
        <div id="item_list">
          <div id="sidecart_item_9999" class="item"></div>
        </div>
        <div data-tralbum='{"current":{"id":1609998585,"type":"album"},"artist":"BES"}' style="display:none"></div>
      `);

      global.sessionStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn()
      };

      initCart(mockPort);
    });

    it('should display donation banner when cartDonationAdded message received', async () => {
      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0];

      await messageHandler({
        cartDonationAdded: {
          item_id: 9999,
          item_title: 'Support Album',
          message: 'Thank you!'
        }
      });

      const banner = document.querySelector('#bes-donation-banner-9999');
      expect(banner).not.toBeNull();
      expect(banner?.textContent).toContain('Thank you!');
    });

    it('should use default message when no custom message provided', async () => {
      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0];

      await messageHandler({
        cartDonationAdded: {
          item_id: 9999,
          item_title: 'Support Album'
        }
      });

      const banner = document.querySelector('#bes-donation-banner-9999');
      expect(banner?.textContent).toContain('Support this project');
    });

    it('should not display donation banner if already dismissed', async () => {
      (global.sessionStorage.getItem as any).mockReturnValue(JSON.stringify(['9999']));

      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0];

      await messageHandler({
        cartDonationAdded: {
          item_id: 9999,
          item_title: 'Support Album',
          message: 'Thank you!'
        }
      });

      const banner = document.querySelector('#bes-donation-banner-9999');
      expect(banner).toBeNull();
    });

    it('should remove banner and store in sessionStorage when close button clicked', async () => {
      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0];

      await messageHandler({
        cartDonationAdded: {
          item_id: 9999,
          item_title: 'Support Album',
          message: 'Thank you!'
        }
      });

      const banner = document.querySelector('#bes-donation-banner-9999');
      const closeButton = banner?.querySelector('.bes-donation-close') as HTMLButtonElement;

      expect(closeButton).not.toBeNull();

      closeButton.click();

      expect(document.querySelector('#bes-donation-banner-9999')).toBeNull();
      expect(global.sessionStorage.setItem).toHaveBeenCalledWith('bes_dismissed_donations', JSON.stringify(['9999']));
    });

    it('should position banner after cart item', async () => {
      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0];

      await messageHandler({
        cartDonationAdded: {
          item_id: 9999,
          item_title: 'Support Album',
          message: 'Thank you!'
        }
      });

      const cartItem = document.querySelector('#sidecart_item_9999');
      const banner = document.querySelector('#bes-donation-banner-9999');

      expect(cartItem?.nextElementSibling).toBe(banner);
    });
  });
});
