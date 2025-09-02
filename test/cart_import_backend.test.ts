import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { connectionListenerCallback, portListenerCallback } from '../src/background/cart_import_backend';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
  }
}));

vi.mock('../src/bclient', () => ({
  getTralbumDetails: vi.fn(),
  getTralbumDetailsFromPage: vi.fn(),
  CURRENCY_MINIMUMS: { USD: 0.5, EUR: 0.25 }
}));

import { getTralbumDetails, getTralbumDetailsFromPage } from '../src/bclient';

describe('cart_import_backend', () => {
  let mockPort: chrome.runtime.Port;
  let portState: { port?: chrome.runtime.Port };

  beforeEach(() => {
    mockPort = {
      name: 'bes',
      onMessage: {
        addListener: vi.fn()
      },
      postMessage: vi.fn()
    } as any;

    portState = {};

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('connectionListenerCallback', () => {
    it('should set up port and listener for valid port name', () => {
      connectionListenerCallback(mockPort, portState);

      expect(portState.port).toBe(mockPort);
      expect(mockPort.onMessage.addListener).toHaveBeenCalled();
    });

    it('should reject invalid port names', () => {
      const invalidPort = { ...mockPort, name: 'invalid' };

      connectionListenerCallback(invalidPort as any, portState);

      expect(portState.port).toBeUndefined();
    });
  });

  describe('portListenerCallback', () => {
    beforeEach(() => {
      portState.port = mockPort;
      connectionListenerCallback(mockPort, portState);
    });

    describe('cart import', () => {
      const mockCartItems = [
        {
          item_id: 123,
          item_type: 'a' as const,
          item_title: 'Test Album',
          band_name: 'Test Band',
          currency: 'USD',
          url: 'https://test.bandcamp.com/album/test',
          unit_price: 10
        },
        {
          item_id: 456,
          item_type: 't' as const,
          item_title: 'Test Track',
          band_name: 'Test Band',
          currency: 'USD',
          url: 'https://test.bandcamp.com/track/test'
        }
      ];

      it('should process cart import with existing prices and skip API call (optimization)', async () => {
        (getTralbumDetails as any).mockResolvedValue({ is_purchasable: true });

        await portListenerCallback({ cartImport: { items: [mockCartItems[0]] } }, portState);

        expect(
          getTralbumDetails,
          'should not call getTralbumDetails when price is already provided'
        ).not.toHaveBeenCalled();

        expect(mockPort.postMessage).toHaveBeenCalledWith({
          cartAddRequest: {
            item_id: 123,
            item_type: 'a',
            item_title: 'Test Album',
            band_name: 'Test Band',
            unit_price: 10,
            currency: 'USD',
            url: 'https://test.bandcamp.com/album/test'
          }
        });
      });

      it('should send successful completion message', async () => {
        await portListenerCallback({ cartImport: { items: [mockCartItems[0]] } }, portState);

        expect(mockPort.postMessage).toHaveBeenCalledWith({
          cartImportComplete: { message: 'Successfully added 1 items to cart' }
        });
      });

      it('should fetch price when unit_price is missing', async () => {
        (getTralbumDetails as any).mockResolvedValue({ price: 5.0, is_purchasable: true });

        await portListenerCallback({ cartImport: { items: [mockCartItems[1]] } }, portState);

        expect(getTralbumDetails).toHaveBeenCalledWith(456, 't', 'http://bandcamp.com');
        expect(mockPort.postMessage).toHaveBeenCalledWith({
          cartAddRequest: {
            item_id: 456,
            item_type: 't',
            item_title: 'Test Track',
            band_name: 'Test Band',
            unit_price: 5.0,
            currency: 'USD',
            url: 'https://test.bandcamp.com/track/test'
          }
        });
      });

      it('should use currency minimum when API price is 0', async () => {
        (getTralbumDetails as any).mockResolvedValue({ price: 0, is_purchasable: true });

        await portListenerCallback({ cartImport: { items: [mockCartItems[1]] } }, portState);

        expect(mockPort.postMessage).toHaveBeenCalledWith({
          cartAddRequest: {
            item_id: 456,
            item_type: 't',
            item_title: 'Test Track',
            band_name: 'Test Band',
            unit_price: 0.5,
            currency: 'USD',
            url: 'https://test.bandcamp.com/track/test'
          }
        });
      });

      it('should handle errors when fetching price fails', async () => {
        (getTralbumDetails as any).mockRejectedValue(new Error('HTTP 404: Not Found'));

        await portListenerCallback({ cartImport: { items: [mockCartItems[1]] } }, portState);

        expect(mockPort.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            cartImportState: expect.objectContaining({
              errors: expect.arrayContaining([expect.stringContaining('Error processing item 456')])
            })
          })
        );

        expect(mockPort.postMessage).toHaveBeenCalledWith({
          cartItemError: {
            message: 'Failed to add "Test Track" to cart'
          }
        });
      });

      it('should send completion message with mixed success/failure counts', async () => {
        const mixedItems = [mockCartItems[0], mockCartItems[1]];
        (getTralbumDetails as any).mockRejectedValue(new Error('HTTP 404: Not Found'));

        await portListenerCallback({ cartImport: { items: mixedItems } }, portState);

        expect(mockPort.postMessage).toHaveBeenCalledWith({
          cartImportComplete: { message: 'Successfully added 1 items to cart. 1 items could not be added' }
        });
      });

      it('should track progress correctly during processing', async () => {
        const multipleItems = [mockCartItems[0], mockCartItems[1]];
        (getTralbumDetails as any).mockResolvedValue({ price: 5.0, is_purchasable: true });

        await portListenerCallback({ cartImport: { items: multipleItems } }, portState);

        const stateCalls = (mockPort.postMessage as any).mock.calls.filter(
          (call: any) => call[0].cartImportState !== undefined
        );

        expect(stateCalls.length).toBeGreaterThan(0);

        const stateUpdates = stateCalls.map((call: any) => call[0].cartImportState);

        expect(stateUpdates.some((state: any) => state.isProcessing === true)).toBe(true);

        const finalState = stateUpdates[stateUpdates.length - 1];
        expect(finalState.isProcessing).toBe(false);
        expect(finalState.processedCount).toBe(2);
        expect(finalState.totalCount).toBe(2);
        expect(finalState.errors.length).toBe(0);
      });

      it('should handle empty items array', async () => {
        await portListenerCallback({ cartImport: { items: [] } }, portState);

        expect(mockPort.postMessage).toHaveBeenCalledWith({
          cartImportComplete: { message: 'No items found to import' }
        });
      });
    });

    describe('URL import', () => {
      const mockUrls = ['https://test.bandcamp.com/album/test-album', 'https://test.bandcamp.com/track/test-track'];

      it('should process URL import successfully', async () => {
        (getTralbumDetailsFromPage as any).mockResolvedValueOnce({
          id: 123,
          type: 'a',
          title: 'Test Album',
          tralbum_artist: 'Test Band',
          currency: 'USD',
          bandcamp_url: mockUrls[0],
          price: 10.0
        });
        (getTralbumDetails as any).mockResolvedValueOnce({ price: 10.0, is_purchasable: true });

        await portListenerCallback({ cartUrlImport: { urls: [mockUrls[0]] } }, portState);

        expect(getTralbumDetailsFromPage).toHaveBeenCalledWith(mockUrls[0]);
        expect(getTralbumDetails).toHaveBeenCalledWith(123, 'a', 'http://bandcamp.com');
        expect(mockPort.postMessage).toHaveBeenCalledWith({
          cartAddRequest: {
            item_id: 123,
            item_type: 'a',
            item_title: 'Test Album',
            band_name: 'Test Band',
            unit_price: 10.0,
            currency: 'USD',
            url: mockUrls[0]
          }
        });
      });

      it('should handle URL extraction errors', async () => {
        (getTralbumDetailsFromPage as any).mockRejectedValue(new Error('Invalid URL'));

        await portListenerCallback({ cartUrlImport: { urls: [mockUrls[0]] } }, portState);

        expect(mockPort.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            cartImportState: expect.objectContaining({
              errors: expect.arrayContaining([expect.stringContaining('Error processing URL')])
            })
          })
        );
      });

      it('should handle empty URLs array', async () => {
        await portListenerCallback({ cartUrlImport: { urls: [] } }, portState);

        expect(mockPort.postMessage).toHaveBeenCalledWith({
          cartImportComplete: { message: 'No items found to import' }
        });
      });

      it('should send completion message for URL import', async () => {
        (getTralbumDetailsFromPage as any).mockResolvedValue({
          id: 123,
          type: 'a',
          title: 'Test Album',
          tralbum_artist: 'Test Band',
          currency: 'USD',
          bandcamp_url: mockUrls[0],
          price: 10.0
        });
        (getTralbumDetails as any).mockResolvedValue({ price: 10.0, is_purchasable: true });

        await portListenerCallback({ cartUrlImport: { urls: [mockUrls[0]] } }, portState);

        expect(mockPort.postMessage).toHaveBeenCalledWith({
          cartImportComplete: { message: 'Successfully added 1 items to cart' }
        });
      });

      it('should track progress correctly during URL import', async () => {
        (getTralbumDetailsFromPage as any)
          .mockResolvedValueOnce({
            id: 123,
            type: 'a',
            title: 'Test Album 1',
            tralbum_artist: 'Test Band 1',
            currency: 'USD',
            bandcamp_url: mockUrls[0],
            price: 10.0
          })
          .mockResolvedValueOnce({
            id: 456,
            type: 't',
            title: 'Test Track 2',
            tralbum_artist: 'Test Band 2',
            currency: 'USD',
            bandcamp_url: mockUrls[1],
            price: 5.0
          });
        (getTralbumDetails as any).mockResolvedValue({ price: 10.0, is_purchasable: true });

        await portListenerCallback({ cartUrlImport: { urls: mockUrls } }, portState);

        const stateCalls = (mockPort.postMessage as any).mock.calls.filter(
          (call: any) => call[0].cartImportState !== undefined
        );

        expect(stateCalls.length).toBeGreaterThan(0);

        const stateUpdates = stateCalls.map((call: any) => call[0].cartImportState);

        expect(stateUpdates.some((state: any) => state.isProcessing === true)).toBe(true);

        const finalState = stateUpdates[stateUpdates.length - 1];
        expect(finalState.isProcessing).toBe(false);
        expect(finalState.processedCount).toBe(2);
        expect(finalState.totalCount).toBe(2);
        expect(finalState.operation).toBe('url_import');
      });
    });

    describe('state requests', () => {
      it('should return current state when requested', async () => {
        await portListenerCallback({ getCartImportState: true }, portState);

        expect(mockPort.postMessage).toHaveBeenCalledWith({
          cartImportState: expect.objectContaining({
            isProcessing: false,
            processedCount: 0,
            totalCount: 0,
            errors: []
          })
        });
      });
    });
  });
});
