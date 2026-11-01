export function wrapWithTooltip(target: HTMLElement, text: string): HTMLElement {
  const wrapper = document.createElement('span');
  wrapper.className = 'bes-tooltip-wrapper';
  wrapper.style.position = 'relative';
  wrapper.style.display = 'inline-flex';
  wrapper.style.flexShrink = '0';

  const content = document.createElement('span');
  content.className = 'bes-tooltip-text';
  content.textContent = text;
  content.style.visibility = 'hidden';
  content.style.width = '200px';
  content.style.backgroundColor = 'var(--bes-text-strong)';
  content.style.color = 'var(--bes-surface-0)';
  content.style.textAlign = 'left';
  content.style.borderRadius = '4px';
  content.style.padding = '8px';
  content.style.position = 'absolute';
  content.style.zIndex = '1000';
  content.style.bottom = '125%';
  content.style.left = '50%';
  content.style.marginLeft = '-100px';
  content.style.fontSize = '12px';
  content.style.lineHeight = '1.4';
  content.style.opacity = '0';
  content.style.transition = 'opacity 0.2s';
  content.style.pointerEvents = 'none';

  wrapper.appendChild(target);
  wrapper.appendChild(content);

  wrapper.addEventListener('mouseenter', () => {
    content.style.visibility = 'visible';
    content.style.opacity = '1';
  });

  wrapper.addEventListener('mouseleave', () => {
    content.style.visibility = 'hidden';
    content.style.opacity = '0';
  });

  return wrapper;
}
