import { describe, it, expect } from 'vitest';
import { prevIcon, nextIcon, playIcon, pauseIcon, starIcon } from '../src/components/player/icons';

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

  describe('starIcon', () => {
    it('should render at the requested size and share the common viewBox', () => {
      [starIcon(12, true), starIcon(12, false)].forEach(markup => {
        const svg = parse(markup);
        expect(svg.getAttribute('width')).toBe('12');
        expect(svg.getAttribute('height')).toBe('12');
        expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
      });
    });

    it('should fill the star when the item is wishlisted and outline it when it is not', () => {
      expect(parse(starIcon(12, true)).getAttribute('fill')).toBe('currentColor');
      expect(parse(starIcon(12, false)).getAttribute('fill')).toBe('none');
      expect(parse(starIcon(12, false)).getAttribute('stroke')).toBe('currentColor');
    });

    it('should draw the same shape whether filled or not', () => {
      const filled = parse(starIcon(12, true)).querySelector('path')?.getAttribute('d');
      const outline = parse(starIcon(12, false)).querySelector('path')?.getAttribute('d');

      expect(filled).toBeTruthy();
      expect(filled).toBe(outline);
    });

    it('should hide the star from assistive technology', () => {
      expect(parse(starIcon(12, true)).getAttribute('aria-hidden')).toBe('true');
    });
  });
});
