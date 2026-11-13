import { element } from './dom';

export const TOOLTIP_CLASS = 'bes-tooltip';

const VISIBLE_CLASS = 'visible';
const BELOW_CLASS = 'bes-tooltip-below';
const ARROW_OFFSET = '--bes-tooltip-arrow';
const GAP = 8;

export interface TooltipHandle {
  element: HTMLElement;
  remove: () => void;
}

export interface TooltipOptions {
  shouldShow?: () => boolean;
}

export function attachTooltip(target: HTMLElement, text: string, options: TooltipOptions = {}): TooltipHandle {
  const tooltip = element('div', { className: TOOLTIP_CLASS });
  tooltip.textContent = text;
  document.body.appendChild(tooltip);

  function position(): void {
    const { left, top, bottom, width } = target.getBoundingClientRect();
    const above = top - tooltip.offsetHeight - GAP;
    const flipped = above < 0;

    const centre = left + width / 2;
    const boxWidth = tooltip.offsetWidth;
    const anchored = Math.min(Math.max(centre - boxWidth / 2, GAP), window.innerWidth - boxWidth - GAP);

    tooltip.classList.toggle(BELOW_CLASS, flipped);
    tooltip.style.left = `${anchored}px`;
    tooltip.style.top = `${flipped ? bottom + GAP : above}px`;
    tooltip.style.setProperty(ARROW_OFFSET, `${centre - anchored}px`);
  }

  function hide(): void {
    tooltip.classList.remove(VISIBLE_CLASS);
  }

  function show(): void {
    if (!target.isConnected) {
      remove();
      return;
    }

    if (options.shouldShow && !options.shouldShow()) return;

    position();
    tooltip.classList.add(VISIBLE_CLASS);
  }

  function remove(): void {
    target.removeEventListener('mouseenter', show);
    target.removeEventListener('mouseleave', hide);
    tooltip.remove();
  }

  target.addEventListener('mouseenter', show);
  target.addEventListener('mouseleave', hide);

  return { element: tooltip, remove };
}
