interface ElementSpec {
  className?: string;
  html?: string;
  attributes?: Record<string, string>;
  children?: (HTMLElement | null)[];
}

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  spec: ElementSpec = {}
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (spec.className) node.className = spec.className;
  if (spec.html) node.innerHTML = spec.html;

  Object.entries(spec.attributes ?? {}).forEach(([name, value]) => node.setAttribute(name, value));
  appendChildren(node, spec.children ?? []);

  return node;
}

export function appendChildren(parent: HTMLElement, children: (HTMLElement | null)[]): void {
  children.filter((child): child is HTMLElement => child !== null).forEach(child => parent.appendChild(child));
}

export function replaceChildren(parent: HTMLElement | null, ...children: (HTMLElement | null)[]): void {
  if (!parent) return;

  parent.innerHTML = '';
  appendChildren(parent, children);
}
