export function createShoppingCartItem(options = {}) {
  const { itemId, itemName, itemPrice, itemCurrency } = options;

  const itemContainer = document.createElement("div");
  itemContainer.id = `sidecart_item_${itemId}`;
  itemContainer.className = "item first";

  const revealContainer = document.createElement("div");
  revealContainer.className = "cartItemReveal reveal";

  const contentsContainer = document.createElement("div");
  contentsContainer.className = "cartItemContents";

  const paragraph = document.createElement("p");

  const nameSpan = document.createElement("span");
  nameSpan.className = "itemName notSkinnable";
  nameSpan.textContent = `${itemName}, digital download`;

  const deleteLink = document.createElement("a");
  deleteLink.className = "delete notSkinnable";
  deleteLink.style.pointerEvents = "none";
  const deleteSpan = document.createElement("span");
  deleteSpan.textContent = "⊘";
  deleteLink.appendChild(deleteSpan);

  const priceSpan = document.createElement("span");
  priceSpan.className = "price";
  priceSpan.textContent = `\$${itemPrice} ${itemCurrency}`;

  paragraph.appendChild(nameSpan);
  paragraph.appendChild(document.createElement("br"));
  paragraph.appendChild(deleteLink);
  paragraph.appendChild(priceSpan);

  contentsContainer.appendChild(paragraph);
  revealContainer.appendChild(contentsContainer);
  itemContainer.appendChild(revealContainer);

  return itemContainer;
}
