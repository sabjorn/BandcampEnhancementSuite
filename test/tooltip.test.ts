import { describe, it, expect, beforeEach } from 'vitest';

import { wrapWithTooltip } from '../src/components/tooltip';

describe('wrapWithTooltip', () => {
  let button: HTMLButtonElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    button = document.createElement('button');
    button.textContent = 'target';
  });

  it('should keep the target inside the wrapper', () => {
    const wrapper = wrapWithTooltip(button, 'explanation');

    expect(wrapper.contains(button)).toBe(true);
    expect(wrapper.querySelector('.bes-tooltip-text')?.textContent).toBe('explanation');
  });

  it('should start hidden', () => {
    const wrapper = wrapWithTooltip(button, 'explanation');
    const content = wrapper.querySelector<HTMLElement>('.bes-tooltip-text') as HTMLElement;

    expect(content.style.visibility).toBe('hidden');
    expect(content.style.opacity).toBe('0');
  });

  // A disabled button receives no pointer events, so the hover has to live on the wrapper.
  it('should show on hovering the wrapper even when the target is disabled', () => {
    button.disabled = true;
    const wrapper = wrapWithTooltip(button, 'explanation');
    document.body.appendChild(wrapper);

    wrapper.dispatchEvent(new MouseEvent('mouseenter'));

    const content = wrapper.querySelector<HTMLElement>('.bes-tooltip-text') as HTMLElement;
    expect(content.style.visibility).toBe('visible');
    expect(content.style.opacity).toBe('1');
  });

  it('should hide again on leaving', () => {
    const wrapper = wrapWithTooltip(button, 'explanation');
    document.body.appendChild(wrapper);

    wrapper.dispatchEvent(new MouseEvent('mouseenter'));
    wrapper.dispatchEvent(new MouseEvent('mouseleave'));

    const content = wrapper.querySelector<HTMLElement>('.bes-tooltip-text') as HTMLElement;
    expect(content.style.visibility).toBe('hidden');
  });

  it('should not intercept pointer events itself', () => {
    const wrapper = wrapWithTooltip(button, 'explanation');
    const content = wrapper.querySelector<HTMLElement>('.bes-tooltip-text') as HTMLElement;

    expect(content.style.pointerEvents).toBe('none');
  });
});
