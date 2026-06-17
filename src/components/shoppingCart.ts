interface ShoppingCartItemOptions {
  itemId: string;
  itemName: string;
  itemPrice: number;
  itemCurrency: string;
  onDelete?: (event: Event) => void;
}

export function createShoppingCartItem(
  options: ShoppingCartItemOptions = {} as ShoppingCartItemOptions
): HTMLDivElement {
  const { itemId, itemName, itemPrice, itemCurrency, onDelete } = options;

  const itemContainer = document.createElement('div');
  itemContainer.id = `sidecart_item_${itemId}`;
  itemContainer.className = 'item first';

  const revealContainer = document.createElement('div');
  revealContainer.className = 'cartItemReveal reveal';

  const contentsContainer = document.createElement('div');
  contentsContainer.className = 'cartItemContents';

  const paragraph = document.createElement('p');

  const nameSpan = document.createElement('span');
  nameSpan.className = 'itemName notSkinnable';
  nameSpan.textContent = `${itemName}, digital download`;

  const deleteLink = document.createElement('a');
  deleteLink.className = 'delete notSkinnable';
  const deleteSpan = document.createElement('span');
  deleteLink.appendChild(deleteSpan);

  if (onDelete) {
    deleteSpan.textContent = '×';
    deleteLink.href = '#';
    deleteLink.title = 'Remove from cart';
    deleteLink.addEventListener('click', event => {
      event.preventDefault();
      onDelete(event);
    });
  } else {
    deleteSpan.textContent = '⊘';
    deleteLink.style.pointerEvents = 'none';
  }

  const priceSpan = document.createElement('span');
  priceSpan.className = 'price';
  priceSpan.textContent = `\$${itemPrice} ${itemCurrency}`;

  paragraph.appendChild(nameSpan);
  paragraph.appendChild(document.createElement('br'));
  paragraph.appendChild(deleteLink);
  paragraph.appendChild(priceSpan);

  contentsContainer.appendChild(paragraph);
  revealContainer.appendChild(contentsContainer);
  itemContainer.appendChild(revealContainer);

  return itemContainer;
}
