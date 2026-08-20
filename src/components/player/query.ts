let playerRoot: ParentNode = document;

export const setPlayerRoot = (root: ParentNode): void => {
  playerRoot = root;
};

export const inPlayer = <T extends HTMLElement>(selector: string): T | null => playerRoot.querySelector<T>(selector);

export const allInPlayer = <T extends HTMLElement>(selector: string): T[] =>
  Array.from(playerRoot.querySelectorAll<T>(selector));

export const setText = (selector: string, text: string): void => {
  const element = inPlayer(selector);
  if (element) element.textContent = text;
};

export const setStyle = (selector: string, apply: (style: CSSStyleDeclaration) => void): void => {
  const element = inPlayer(selector);
  if (element) apply(element.style);
};

export function getPlayerElements() {
  return {
    playerContainer: inPlayer<HTMLDivElement>('.bes-player-container'),
    tracklistContainer: inPlayer<HTMLDivElement>('.bes-player-tracklist'),
    transportControls: inPlayer<HTMLDivElement>('.bes-player-transport'),
    rightColumn: inPlayer<HTMLDivElement>('.bes-player-right')
  };
}
