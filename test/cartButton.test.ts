import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  }
}));

vi.mock('../src/bclient', () => ({
  addAlbumToCart: vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))),
  removeAlbumFromCart: vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
}));

import {
  getCartItems,
  isItemInCart,
  getCartLineItemId,
  createCartIcons,
  setCartButtonState,
  createAddToCartButton
} from '../src/components/cartButton';
import { addAlbumToCart, removeAlbumFromCart } from '../src/bclient';
import Logger from '../src/logger';

const setCartData = (items: Array<{ id?: string | number; item_id: string | number; item_type: string }>) => {
  const el = document.createElement('div');
  el.setAttribute('data-cart', JSON.stringify({ items }));
  document.body.appendChild(el);
};

const buildButton = (overrides: Record<string, any> = {}) =>
  createAddToCartButton({
    price: 1,
    currency: 'USD',
    tralbumId: '123',
    itemTitle: 'Test Album',
    type: 'a',
    log: new Logger() as any,
    ...overrides
  });

describe('cartButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCartItems / isItemInCart', () => {
    it('returns an empty list when there is no cart element', () => {
      expect(getCartItems()).toEqual([]);
      expect(isItemInCart('123', 'a')).toBe(false);
    });

    it('reads items from the [data-cart] blob', () => {
      setCartData([{ item_id: 123, item_type: 'a' }]);
      expect(getCartItems()).toHaveLength(1);
    });

    it('matches an item by id and type (coercing id to string)', () => {
      setCartData([{ item_id: 123, item_type: 'a' }]);
      expect(isItemInCart('123', 'a')).toBe(true);
      expect(isItemInCart(123, 'a')).toBe(true);
      expect(isItemInCart('123', 't')).toBe(false);
      expect(isItemInCart('999', 'a')).toBe(false);
    });

    it('tolerates malformed cart data', () => {
      const el = document.createElement('div');
      el.setAttribute('data-cart', 'not json');
      document.body.appendChild(el);
      expect(getCartItems()).toEqual([]);
    });
  });

  describe('getCartLineItemId', () => {
    it('returns the line-item id (not the tralbum id) for a matching item', () => {
      setCartData([{ id: 555, item_id: 123, item_type: 'a' }]);
      expect(getCartLineItemId('123', 'a')).toBe(555);
      expect(getCartLineItemId(123, 'a')).toBe(555);
    });

    it('returns null when the item is not in the cart', () => {
      setCartData([{ id: 555, item_id: 123, item_type: 'a' }]);
      expect(getCartLineItemId('999', 'a')).toBeNull();
      expect(getCartLineItemId('123', 't')).toBeNull();
    });
  });

  describe('createCartIcons', () => {
    it('renders add, loading, check and remove icon slots', () => {
      const icons = createCartIcons();
      expect(icons.querySelectorAll('.bes-cart-icon')).toHaveLength(4);
      expect(icons.querySelector('.bes-cart-icon-add')).toBeTruthy();
      expect(icons.querySelector('.bes-cart-icon-loading .bes-cart-spinner')).toBeTruthy();
      expect(icons.querySelector('.bes-cart-icon-check')).toBeTruthy();
      expect(icons.querySelector('.bes-cart-icon-remove')).toBeTruthy();
    });
  });

  describe('setCartButtonState', () => {
    it('sets the data attribute and title', () => {
      const button = document.createElement('button');
      setCartButtonState(button, 'in-cart');
      expect(button.dataset.cartState).toBe('in-cart');
      expect(button.title.toLowerCase()).toContain('remove');

      setCartButtonState(button, 'add');
      expect(button.dataset.cartState).toBe('add');
      expect(button.title.toLowerCase()).toContain('add');
    });

    it('marks the button busy while loading', () => {
      const button = document.createElement('button');
      setCartButtonState(button, 'loading');
      expect(button.dataset.cartState).toBe('loading');
      expect(button.getAttribute('aria-busy')).toBe('true');
    });
  });

  describe('createAddToCartButton', () => {
    it('starts in the add state when the item is not in the cart', () => {
      const container = buildButton();
      const button = container.querySelector('.one-click-button') as HTMLElement;
      expect(button.dataset.cartState).toBe('add');
    });

    it('starts in the in-cart state when the item is already in the cart', () => {
      setCartData([{ item_id: 123, item_type: 'a' }]);
      const container = buildButton();
      const button = container.querySelector('.one-click-button') as HTMLElement;
      expect(button.dataset.cartState).toBe('in-cart');
    });

    it('shows the loading state immediately on click', () => {
      const container = buildButton();
      document.body.appendChild(container);
      const button = container.querySelector('.one-click-button') as HTMLButtonElement;

      button.click();

      expect(button.dataset.cartState).toBe('loading');
    });

    it('adds to cart and flips to the in-cart state on a successful click', async () => {
      const container = buildButton();
      document.body.appendChild(container);
      const button = container.querySelector('.one-click-button') as HTMLButtonElement;

      button.click();

      await vi.waitFor(() => expect(button.dataset.cartState).toBe('in-cart'));
      expect(addAlbumToCart).toHaveBeenCalledWith('123', 1, 'a');
    });

    it('appends a sidecart row whose × removes the item using the captured line-item id', async () => {
      const itemList = document.createElement('ol');
      itemList.id = 'item_list';
      document.body.appendChild(itemList);

      (addAlbumToCart as any).mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [{ id: 999, item_id: 123, item_type: 'a' }] }), { status: 200 })
      );

      const container = buildButton();
      document.body.appendChild(container);
      const button = container.querySelector('.one-click-button') as HTMLButtonElement;

      button.click();
      await vi.waitFor(() => expect(button.dataset.cartState).toBe('in-cart'));

      const row = document.getElementById('sidecart_item_123');
      expect(row).toBeTruthy();
      const del = row!.querySelector('.delete') as HTMLElement;
      expect(del.style.pointerEvents).not.toBe('none');

      del.click();
      await vi.waitFor(() => expect(button.dataset.cartState).toBe('add'));
      expect(removeAlbumFromCart).toHaveBeenCalledWith(999);
      expect(document.getElementById('sidecart_item_123')).toBeNull();
    });

    it('captures the line-item id from the add response so same-session removal works', async () => {
      (addAlbumToCart as any).mockResolvedValueOnce(
        new Response(JSON.stringify({ req: 'add', id: 388964184, sync_num: 100 }), { status: 200 })
      );

      const container = buildButton();
      document.body.appendChild(container);
      const button = container.querySelector('.one-click-button') as HTMLButtonElement;

      button.click();
      await vi.waitFor(() => expect(button.dataset.cartState).toBe('in-cart'));

      button.click();
      await vi.waitFor(() => expect(button.dataset.cartState).toBe('add'));
      expect(removeAlbumFromCart).toHaveBeenCalledWith(388964184);
    });

    it('removes from cart using the line-item id and reverts to add when clicked while in cart', async () => {
      setCartData([{ id: 555, item_id: 123, item_type: 'a' }]);
      const container = buildButton();
      document.body.appendChild(container);
      const button = container.querySelector('.one-click-button') as HTMLButtonElement;
      expect(button.dataset.cartState).toBe('in-cart');

      button.click();

      await vi.waitFor(() => expect(button.dataset.cartState).toBe('add'));
      expect(removeAlbumFromCart).toHaveBeenCalledWith(555);
    });
  });
});
