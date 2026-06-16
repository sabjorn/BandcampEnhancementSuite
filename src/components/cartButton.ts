import Logger from '../logger';
import { createInputButtonPair } from './buttons.js';
import { createShoppingCartItem } from './shoppingCart.js';
import { createPlusSvgIcon, createCheckSvgIcon, createXSvgIcon } from './svgIcons';
import { addAlbumToCart, removeAlbumFromCart } from '../bclient';

type CartButtonState = 'add' | 'loading' | 'in-cart';

const MIN_SPINNER_MS = 250;

interface CartItem {
  id: string | number;
  item_id: string | number;
  item_type: string;
  url?: string;
}

function removeSidecartRow(lineItemId: string | number | null, tralbumId: string, itemUrl?: string): void {
  if (lineItemId !== null) document.getElementById(`sidecart_item_${lineItemId}`)?.remove();
  document.getElementById(`sidecart_item_${tralbumId}`)?.remove();

  const itemList = document.getElementById('item_list');
  if (!itemList || !itemUrl) return;

  const base = itemUrl.split('?')[0];
  itemList.querySelectorAll('a[href]').forEach(link => {
    if ((link.getAttribute('href') || '').split('?')[0] !== base) return;
    let row: HTMLElement = link as HTMLElement;
    while (row.parentElement && row.parentElement !== itemList) row = row.parentElement;
    if (row.parentElement === itemList) row.remove();
  });
}

function parseCartData(element: Element): any {
  try {
    return JSON.parse(element.getAttribute('data-cart') || 'null');
  } catch {
    return null;
  }
}

function extractCartItems(value: any): CartItem[] {
  if (!value) return [];
  const items = Array.isArray(value.items)
    ? value.items
    : value.cart_data && Array.isArray(value.cart_data.items)
      ? value.cart_data.items
      : Array.isArray(value)
        ? value
        : [];
  return items.filter((item: any) => item && typeof item === 'object' && 'item_id' in item);
}

export function getCartItems(): CartItem[] {
  let fallback: CartItem[] = [];
  for (const element of Array.from(document.querySelectorAll('[data-cart]'))) {
    const items = extractCartItems(parseCartData(element));
    if (items.length === 0) continue;
    if (items.some(item => item.id !== undefined && item.id !== null)) return items;
    if (fallback.length === 0) fallback = items;
  }
  return fallback;
}

export function isItemInCart(itemId: string | number, itemType: string): boolean {
  return getCartItems().some(item => String(item.item_id) === String(itemId) && item.item_type === itemType);
}

export function getCartLineItemId(itemId: string | number, itemType: string): string | number | null {
  const match = getCartItems().find(item => String(item.item_id) === String(itemId) && item.item_type === itemType);
  return match?.id ?? null;
}

export function createCartIcons(): HTMLSpanElement {
  const wrapper = document.createElement('span');
  wrapper.className = 'bes-cart-icons';

  const makeSlot = (className: string, child: Element): HTMLSpanElement => {
    const slot = document.createElement('span');
    slot.className = `bes-cart-icon ${className}`;
    slot.append(child);
    return slot;
  };

  const spinner = document.createElement('span');
  spinner.className = 'bes-cart-spinner';

  wrapper.append(
    makeSlot('bes-cart-icon-add', createPlusSvgIcon()),
    makeSlot('bes-cart-icon-loading', spinner),
    makeSlot('bes-cart-icon-check', createCheckSvgIcon()),
    makeSlot('bes-cart-icon-remove', createXSvgIcon())
  );

  return wrapper;
}

const STATE_TITLES: Record<CartButtonState, string> = {
  add: 'Add to cart',
  loading: 'Working…',
  'in-cart': 'In cart — click to remove'
};

export function setCartButtonState(button: HTMLElement, state: CartButtonState): void {
  button.dataset.cartState = state;
  button.title = STATE_TITLES[state];
  button.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
}

export function playCartAnimation(button: HTMLElement, animationClass: string): void {
  button.classList.remove(animationClass);
  void button.offsetWidth;
  button.classList.add(animationClass);
  button.addEventListener('animationend', () => button.classList.remove(animationClass), { once: true });
}

function withMinDuration<T>(promise: Promise<T>, ms: number): Promise<T> {
  const elapsed = new Promise<void>(resolve => setTimeout(resolve, ms));
  return Promise.all([promise, elapsed]).then(([result]) => result);
}

async function assertCartResponseOk(response: Response): Promise<any> {
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const body = await response
    .clone()
    .json()
    .catch(() => null);
  if (body && body.error) {
    throw new Error(`cart request failed: ${JSON.stringify(body.error)}`);
  }
  return body;
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
  let lineItemId = getCartLineItemId(tralbumId, type);
  setCartButtonState(button, isItemInCart(tralbumId, type) ? 'in-cart' : 'add');

  function handleClick(value: string | number): void {
    const state = button.dataset.cartState;
    if (state === 'loading') return;
    if (state === 'in-cart') {
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

    setCartButtonState(button, 'loading');

    withMinDuration(addAlbumToCart(tralbumId, numericValue, type), MIN_SPINNER_MS)
      .then(assertCartResponseOk)
      .then(body => {
        if (body && body.id !== undefined && body.id !== null) {
          lineItemId = body.id;
        } else {
          const added = extractCartItems(body).find(
            item => String(item.item_id) === String(tralbumId) && item.item_type === type
          );
          if (added) lineItemId = added.id;
        }

        setCartButtonState(button, 'in-cart');
        playCartAnimation(button, 'bes-cart-pop');
        addItemToSidecart(numericValue);
      })
      .catch(error => {
        log.error(error);
        setCartButtonState(button, 'add');
        playCartAnimation(button, 'bes-cart-error');
      });
  }

  function handleRemove(): void {
    const id = lineItemId ?? getCartLineItemId(tralbumId, type);
    if (id === null) {
      log.error('cannot remove from cart: line-item id unknown');
      playCartAnimation(button, 'bes-cart-error');
      return;
    }

    const itemUrl = getCartItems().find(
      item => String(item.item_id) === String(tralbumId) && item.item_type === type
    )?.url;

    setCartButtonState(button, 'loading');

    withMinDuration(removeAlbumFromCart(id), MIN_SPINNER_MS)
      .then(assertCartResponseOk)
      .then(() => {
        lineItemId = null;
        setCartButtonState(button, 'add');
        playCartAnimation(button, 'bes-cart-pop');
        removeSidecartRow(id, tralbumId, itemUrl);
      })
      .catch(error => {
        log.error(error);
        setCartButtonState(button, 'in-cart');
        playCartAnimation(button, 'bes-cart-error');
      });
  }

  function addItemToSidecart(numericValue: number): void {
    const cartItem = createShoppingCartItem({
      itemId: tralbumId,
      itemName: itemTitle,
      itemPrice: numericValue,
      itemCurrency: currency,
      onDelete: () => handleRemove()
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
