import { describe, it, expect } from 'vitest';
import { prevIcon, nextIcon, playIcon, pauseIcon } from '../src/components/playerIcons';

const parse = (markup: string): SVGElement => {
  const holder = document.createElement('div');
  holder.innerHTML = markup;
  return holder.querySelector('svg') as unknown as SVGElement;
};

describe('playerIcons', () => {
  it('should render at the requested size', () => {
    [prevIcon, nextIcon, playIcon, pauseIcon].forEach(icon => {
      const svg = parse(icon(14));
      expect(svg.getAttribute('width')).toBe('14');
      expect(svg.getAttribute('height')).toBe('14');
    });
  });

  it('should share one viewBox so shapes stay aligned across sizes', () => {
    [prevIcon, nextIcon, playIcon, pauseIcon].forEach(icon => {
      expect(parse(icon(16)).getAttribute('viewBox')).toBe('0 0 24 24');
    });
  });

  it('should take their colour from the surrounding context', () => {
    expect(prevIcon(18)).toContain('currentColor');
    expect(nextIcon(18)).toContain('currentColor');
    expect(playIcon(16)).toContain('currentColor');
    expect(pauseIcon(16)).toContain('currentColor');
  });

  it('should tag play and pause so a container can toggle between them', () => {
    expect(parse(playIcon(16)).getAttribute('class')).toBe('bes-play-icon');
    expect(parse(pauseIcon(16)).getAttribute('class')).toBe('bes-pause-icon');
  });

  it('should hide icons from assistive technology, since buttons carry the label', () => {
    [prevIcon, nextIcon, playIcon, pauseIcon].forEach(icon => {
      expect(parse(icon(16)).getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('should draw distinct shapes for previous and next', () => {
    const prev = parse(prevIcon(18)).querySelector('path')?.getAttribute('d');
    const next = parse(nextIcon(18)).querySelector('path')?.getAttribute('d');

    expect(prev).toBeTruthy();
    expect(next).toBeTruthy();
    expect(prev).not.toBe(next);
  });
});
