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
  createCartIcons,
  setCartButtonState,
  createAddToCartButton
} from '../src/components/cartButton';
import { addAlbumToCart, removeAlbumFromCart } from '../src/bclient';
import Logger from '../src/logger';

// setup.ts wipes document.body before each test, so a plain appended node is enough.
const setCartData = (items: Array<{ item_id: string | number; item_type: string }>) => {
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

  describe('createCartIcons', () => {
    it('renders add, check and remove icon slots', () => {
      const icons = createCartIcons();
      expect(icons.querySelectorAll('.bes-cart-icon')).toHaveLength(3);
      expect(icons.querySelector('.bes-cart-icon-add')).toBeTruthy();
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

    it('adds to cart and flips to the in-cart state on a successful click', async () => {
      const container = buildButton();
      document.body.appendChild(container);
      const button = container.querySelector('.one-click-button') as HTMLButtonElement;

      button.click();

      await vi.waitFor(() => expect(button.dataset.cartState).toBe('in-cart'));
      expect(addAlbumToCart).toHaveBeenCalledWith('123', 1, 'a');
    });

    it('removes from cart and reverts to the add state when clicked while in cart', async () => {
      setCartData([{ item_id: 123, item_type: 'a' }]);
      const container = buildButton();
      document.body.appendChild(container);
      const button = container.querySelector('.one-click-button') as HTMLButtonElement;
      expect(button.dataset.cartState).toBe('in-cart');

      button.click();

      await vi.waitFor(() => expect(button.dataset.cartState).toBe('add'));
      expect(removeAlbumFromCart).toHaveBeenCalledWith('123');
    });
  });
});
