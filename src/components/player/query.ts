const DRAWER = '.bes-player-drawer';

export const inDrawer = <T extends HTMLElement>(selector: string): T | null =>
  document.querySelector<T>(`${DRAWER} ${selector}`);

export const allInDrawer = <T extends HTMLElement>(selector: string): T[] =>
  Array.from(document.querySelectorAll<T>(`${DRAWER} ${selector}`));

export const setText = (selector: string, text: string): void => {
  const element = inDrawer(selector);
  if (element) element.textContent = text;
};

export const setStyle = (selector: string, apply: (style: CSSStyleDeclaration) => void): void => {
  const element = inDrawer(selector);
  if (element) apply(element.style);
};
