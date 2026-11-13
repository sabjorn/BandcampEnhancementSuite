import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { attachTooltip } from '../src/components/tooltip';

describe('tooltip stylesheet delivery', () => {
  const manifest = JSON.parse(readFileSync(resolve(__dirname, '..', 'manifest.json'), 'utf8'));
  const scriptFor = (bundle: string) =>
    manifest.content_scripts.find((script: { js: string[] }) => script.js.includes(bundle));

  it('should inject the tooltip stylesheet everywhere a tooltip can be attached', () => {
    expect(scriptFor('dist/document_end.js').css).toContain('css/tooltip.css');
    expect(scriptFor('dist/findmusic_autologin.js').css).toContain('css/tooltip.css');
  });

  it('should fall back to literal colours, since findmusic.club has no theme tokens', () => {
    const tooltipCss = readFileSync(resolve(__dirname, '..', 'css', 'tooltip.css'), 'utf8');
    const themed: string[] = tooltipCss.match(/var\(\s*--bes-[a-z0-9-]+[^)]*\)/g) ?? [];

    expect(themed.length).toBeGreaterThan(0);
    expect(themed.every(reference => reference.includes(','))).toBe(true);
  });
});

describe('attachTooltip', () => {
  let target: HTMLElement;

  const tooltips = () => Array.from(document.querySelectorAll('.bes-tooltip'));
  const tooltip = () => document.querySelector('.bes-tooltip') as HTMLElement;
  const hover = (node: HTMLElement) => node.dispatchEvent(new MouseEvent('mouseenter'));
  const unhover = (node: HTMLElement) => node.dispatchEvent(new MouseEvent('mouseleave'));

  const sizeTooltip = ({ width, height }: { width: number; height: number }) => {
    vi.spyOn(tooltip(), 'offsetWidth', 'get').mockReturnValue(width);
    vi.spyOn(tooltip(), 'offsetHeight', 'get').mockReturnValue(height);
  };

  const placeTarget = (rect: Partial<DOMRect>) => {
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 200,
      bottom: 230,
      width: 40,
      height: 30,
      ...rect
    } as DOMRect);
  };

  beforeEach(() => {
    target = document.createElement('button');
    document.body.appendChild(target);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('should put the tooltip on the body rather than inside the target', () => {
    attachTooltip(target, 'Hello');

    expect(tooltip().parentElement).toBe(document.body);
    expect(tooltip().textContent).toBe('Hello');
    expect(target.children.length).toBe(0);
  });

  it('should stay hidden until the target is hovered', () => {
    attachTooltip(target, 'Hello');

    expect(tooltip().classList.contains('visible')).toBe(false);

    hover(target);
    expect(tooltip().classList.contains('visible')).toBe(true);

    unhover(target);
    expect(tooltip().classList.contains('visible')).toBe(false);
  });

  it('should centre itself on the target and sit above it', () => {
    attachTooltip(target, 'Hello');
    placeTarget({});
    sizeTooltip({ width: 200, height: 30 });

    hover(target);

    expect(tooltip().style.left).toBe('20px');
    expect(tooltip().style.top).toBe('162px');
    expect(tooltip().style.getPropertyValue('--bes-tooltip-arrow')).toBe('100px');
    expect(tooltip().classList.contains('bes-tooltip-below')).toBe(false);
  });

  it('should flip below the target when there is no room above', () => {
    attachTooltip(target, 'Hello');
    placeTarget({ top: 10, bottom: 40 });
    sizeTooltip({ width: 200, height: 30 });

    hover(target);

    expect(tooltip().style.top).toBe('48px');
    expect(tooltip().classList.contains('bes-tooltip-below')).toBe(true);
  });

  it('should stay inside the viewport when the target sits near the left edge', () => {
    attachTooltip(target, 'Hello');
    placeTarget({ left: 10, width: 14 });
    sizeTooltip({ width: 284, height: 30 });

    hover(target);

    expect(tooltip().style.left).toBe('8px');
    expect(tooltip().style.getPropertyValue('--bes-tooltip-arrow')).toBe('9px');
  });

  it('should stay inside the viewport when the target sits near the right edge', () => {
    attachTooltip(target, 'Hello');
    placeTarget({ left: window.innerWidth - 24, width: 14 });
    sizeTooltip({ width: 284, height: 30 });

    hover(target);

    expect(tooltip().style.left).toBe(`${window.innerWidth - 284 - 8}px`);
    expect(tooltip().style.getPropertyValue('--bes-tooltip-arrow')).toBe('275px');
  });

  it('should reposition on each hover, so a target that moved is still tracked', () => {
    attachTooltip(target, 'Hello');
    sizeTooltip({ width: 200, height: 30 });
    placeTarget({ left: 100 });

    hover(target);
    expect(tooltip().style.left).toBe('20px');

    unhover(target);
    placeTarget({ left: 300 });

    hover(target);
    expect(tooltip().style.left).toBe('220px');
  });

  it('should not show when the caller says it should not', () => {
    let enabled = false;
    attachTooltip(target, 'Hello', { shouldShow: () => enabled });

    hover(target);
    expect(tooltip().classList.contains('visible')).toBe(false);

    enabled = true;
    hover(target);
    expect(tooltip().classList.contains('visible')).toBe(true);
  });

  it('should take the tooltip with it when removed', () => {
    const handle = attachTooltip(target, 'Hello');

    handle.remove();

    expect(tooltips()).toHaveLength(0);

    hover(target);
    expect(tooltips()).toHaveLength(0);
  });

  it('should clean itself up when the target has left the page', () => {
    attachTooltip(target, 'Hello');
    target.remove();

    hover(target);

    expect(tooltips()).toHaveLength(0);
  });
});
