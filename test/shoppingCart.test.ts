import { describe, it, expect, vi } from 'vitest';
import { createShoppingCartItem } from '../src/components/shoppingCart';

const base = { itemId: '123', itemName: 'Test Album', itemPrice: 5, itemCurrency: 'USD' };

describe('createShoppingCartItem', () => {
  it('renders an × delete glyph', () => {
    const row = createShoppingCartItem(base);
    expect(row.querySelector('.delete span')?.textContent).toBe('×');
  });

  it('disables the delete control when no onDelete is provided', () => {
    const row = createShoppingCartItem(base);
    const del = row.querySelector('.delete') as HTMLElement;
    expect(del.style.pointerEvents).toBe('none');
  });

  it('wires the delete control to onDelete when provided', () => {
    const onDelete = vi.fn();
    const row = createShoppingCartItem({ ...base, onDelete });
    const del = row.querySelector('.delete') as HTMLElement;

    expect(del.style.pointerEvents).not.toBe('none');
    del.click();
    expect(onDelete).toHaveBeenCalled();
  });
});
