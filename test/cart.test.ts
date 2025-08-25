import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPagedata, createDomNodes, cleanupTestNodes } from './utils';

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
  loadTextFile: vi.fn()
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

    // Automatically append buttons to the DOM for easier testing
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

    // Automatically append to the DOM for easier testing
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

// Get the mocked utilities
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
    mockButtons.length = 0; // Clear the mock buttons array
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

      await initCart(mockPort);

      // Get the import button from our mock array
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

      await initCart(mockPort);
      // Get the unified import button from our mock array
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

      await initCart(mockPort);

      const exportButton = mockButtons.find(btn => btn.textContent === 'export') as HTMLButtonElement;

      // Click button and wait for async operations to complete
      const exportPromise = exportButton.click();
      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for next tick
      await exportPromise;

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

      await initCart(mockPort);

      const exportButton = mockButtons.find(btn => btn.textContent === 'export') as HTMLButtonElement;

      await exportButton.click();

      const downloadCall = mockDownloadFile.mock.calls[0];
      const exportedData = JSON.parse(downloadCall[1]);

      expect(exportedData.tracks_export[0]).not.toHaveProperty('unit_price');
    });

    it('should handle export errors gracefully', async () => {
      (getTralbumDetails as any).mockRejectedValue(new Error('HTTP 404: Not Found'));

      await initCart(mockPort);

      const exportButton = mockButtons.find(btn => btn.textContent === 'export') as HTMLButtonElement;

      await exportButton.click();

      const downloadCall = mockDownloadFile.mock.calls[0];
      const exportedData = JSON.parse(downloadCall[1]);

      expect(exportedData.tracks_export[0]).toHaveProperty('unit_price', 15);
    });

    it('should not export when cart is empty', async () => {
      cleanupTestNodes(); // Ensure clean state
      createDomNodes(`
        <div id="sidecartReveal"></div>
        <div id="sidecartSummary"></div>
        <div id="item_list"></div>
        <div data-cart='{"items": []}'></div>
        <div data-tralbum='{"current":{"id":1609998585,"type":"album"},"artist":"BES"}' style="display:none"></div>
      `);

      await initCart(mockPort);

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
      await initCart(mockPort);
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

      // Get the message listener that was set up
      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0];

      // Simulate a successful cart add request
      await messageHandler({ cartAddRequest: mockCartRequest });

      // Verify that the cart item was added to the DOM
      const itemList = document.querySelector('#item_list');
      expect(itemList?.children.length).toBe(1);

      // The createShoppingCartItem mock should have been called with correct params
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

      // Mock addAlbumToCart to fail
      const { addAlbumToCart } = await import('../src/bclient');
      (addAlbumToCart as any).mockResolvedValue(new Response('{}', { status: 400 }));

      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0];

      // Simulate a failed cart add request
      await messageHandler({ cartAddRequest: mockCartRequest });

      // Should show individual error notification
      expect(showErrorMessage).toHaveBeenCalledWith('Failed to add "Test Album" to cart');

      // Should NOT add to DOM when failed
      const itemList = document.querySelector('#item_list');
      expect(itemList?.children.length).toBe(0);
    });

    it('should show simple completion message', async () => {
      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0];

      // Simulate completion
      await messageHandler({ cartImportComplete: { message: 'Successfully added 2 items to cart' } });

      // Should show simple success message
      expect(showSuccessMessage).toHaveBeenCalledWith('Successfully added 2 items to cart');
    });

    it('should show individual item error notifications from backend', async () => {
      const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0];

      // Simulate individual item error from backend
      await messageHandler({
        cartItemError: {
          message: 'Failed to add "Test Album" to cart'
        }
      });

      // Should show the error message
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

      // Should update notification with rich HTML content
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

  describe('cart operations', () => {
    beforeEach(() => {
      createPagedata();
      createDomNodes(`
        <div id="cart-container">
          <div class="cart-item">Test Item</div>
        </div>
      `);
    });

    it('should handle cart items', () => {
      const cartContainer = document.querySelector('#cart-container');
      expect(cartContainer).toBeTruthy();
      expect(cartContainer?.querySelector('.cart-item')).toBeTruthy();
    });
  });
});
