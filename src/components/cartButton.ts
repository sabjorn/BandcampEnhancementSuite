import Logger from '../logger';
import { createInputButtonPair } from './buttons.js';
import { createShoppingCartItem } from './shoppingCart.js';
import { createPlusSvgIcon, createCheckSvgIcon, createXSvgIcon } from './svgIcons';
import { addAlbumToCart, removeAlbumFromCart } from '../bclient';

type CartButtonState = 'add' | 'in-cart';

interface CartItem {
  item_id: string | number;
  item_type: string;
}

export function getCartItems(): CartItem[] {
  const cartElement = document.querySelector('[data-cart]');
  if (!cartElement) return [];

  try {
    const cart = JSON.parse(cartElement.getAttribute('data-cart') || '{}');
    return Array.isArray(cart.items) ? cart.items : [];
  } catch {
    return [];
  }
}

export function isItemInCart(itemId: string | number, itemType: string): boolean {
  return getCartItems().some(item => String(item.item_id) === String(itemId) && item.item_type === itemType);
}

export function createCartIcons(): HTMLSpanElement {
  const wrapper = document.createElement('span');
  wrapper.className = 'bes-cart-icons';

  const states: Array<[string, Element]> = [
    ['bes-cart-icon-add', createPlusSvgIcon()],
    ['bes-cart-icon-check', createCheckSvgIcon()],
    ['bes-cart-icon-remove', createXSvgIcon()]
  ];

  states.forEach(([className, icon]) => {
    const slot = document.createElement('span');
    slot.className = `bes-cart-icon ${className}`;
    slot.append(icon);
    wrapper.append(slot);
  });

  return wrapper;
}

export function setCartButtonState(button: HTMLElement, state: CartButtonState): void {
  button.dataset.cartState = state;
  button.title = state === 'in-cart' ? 'In cart — click to remove' : 'Add to cart';
}

export function playCartAnimation(button: HTMLElement, animationClass: string): void {
  button.classList.remove(animationClass);
  // Force a reflow so re-adding the class restarts the animation on rapid clicks.
  void button.offsetWidth;
  button.classList.add(animationClass);
  button.addEventListener('animationend', () => button.classList.remove(animationClass), { once: true });
}

interface CreateAddToCartButtonOptions {
  price: number;
  currency: string;
  tralbumId: string;
  itemTitle: string;
  type: string;
  log: Logger;
}

export function createAddToCartButton(options: CreateAddToCartButtonOptions): HTMLElement {
  const { price, currency, tralbumId, itemTitle, type, log } = options;

  const pair = createInputButtonPair({
    inputPrefix: '$',
    inputSuffix: currency,
    inputPlaceholder: price,
    buttonChildElement: createCartIcons(),
    onButtonClick: value => handleClick(value)
  });
  pair.classList.add('one-click-button-container');

  const button = pair.querySelector('.one-click-button') as HTMLButtonElement;
  setCartButtonState(button, isItemInCart(tralbumId, type) ? 'in-cart' : 'add');

  function handleClick(value: string | number): void {
    if (button.dataset.cartState === 'in-cart') {
      handleRemove();
      return;
    }
    handleAdd(value);
  }

  function handleAdd(value: string | number): void {
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    if (numericValue < price) {
      log.error('track price too low');
      return;
    }

    playCartAnimation(button, 'bes-cart-bounce');

    addAlbumToCart(tralbumId, numericValue, type)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        setCartButtonState(button, 'in-cart');
        playCartAnimation(button, 'bes-cart-bounce');
        addItemToSidecart(numericValue);
      })
      .catch(error => {
        log.error(error);
        playCartAnimation(button, 'bes-cart-error');
      });
  }

  function handleRemove(): void {
    removeAlbumFromCart(tralbumId)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        setCartButtonState(button, 'add');
        document.querySelector(`#sidecart_item_${CSS.escape(tralbumId)}`)?.remove();
      })
      .catch(error => {
        log.error(error);
        playCartAnimation(button, 'bes-cart-error');
      });
  }

  function addItemToSidecart(numericValue: number): void {
    const cartItem = createShoppingCartItem({
      itemId: tralbumId,
      itemName: itemTitle,
      itemPrice: numericValue,
      itemCurrency: currency
    });

    const sidecart = document.querySelector('#sidecart') as HTMLElement | null;
    if (sidecart && sidecart.style.display === 'none') {
      window.location.reload();
      return;
    }

    const itemList = document.querySelector('#item_list');
    if (itemList) {
      itemList.append(cartItem);
    }
  }

  return pair;
}
