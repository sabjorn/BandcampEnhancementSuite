import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  },
  createLogger: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }))
}));

import { createPlayerDrawer } from '../src/components/playerDrawer';

const stylesheet = readFileSync(join(__dirname, '../css/style.css'), 'utf8');

const ruleFor = (selector: string): string | null => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = stylesheet.match(new RegExp(`(^|,)\\s*${escaped}\\s*(,[^{]*)?\\{([^}]*)\\}`, 'm'));
  return match ? match[3] : null;
};

const selectorsSharingRuleWith = (selector: string): string[] => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = stylesheet.match(new RegExp(`([^{}]*${escaped}[^{}]*)\\{([^}]*)\\}`, 'm'));
  return match ? match[1].split(',').map(part => part.trim()) : [];
};

describe('drawer stylesheet invariants', () => {
  describe('the wedge must never show the open drawer contents', () => {
    it('should hide the header when minimized', () => {
      expect(selectorsSharingRuleWith('.bes-player-drawer.minimized .bes-player-drawer-header')).toContain(
        '.bes-player-drawer.minimized .bes-player-drawer-header'
      );
      expect(ruleFor('.bes-player-drawer.minimized .bes-player-drawer-header')).toContain('display: none');
    });

    it('should hide the tracklist content when minimized', () => {
      expect(ruleFor('.bes-player-drawer.minimized .bes-player-drawer-content')).toContain('display: none');
    });

    it('should not hide the content unconditionally', () => {
      const unscoped = stylesheet.match(/^\.bes-player-drawer-content\s*\{([^}]*)\}/gm) ?? [];

      unscoped.forEach(rule => expect(rule).not.toContain('display: none'));
    });

    it('should show the wedge bar only when minimized', () => {
      expect(ruleFor('.bes-player-drawer.minimized .bes-player-drawer-minimized-bar')).toContain('display: flex');
      expect(ruleFor('.bes-player-drawer-minimized-bar')).toContain('display: none');
    });
  });

  describe('every panel added to the drawer must declare its wedge behaviour', () => {
    const wedgeBar = 'bes-player-drawer-minimized-bar';

    const directChildClasses = (): string[] => {
      const { drawer } = createPlayerDrawer();
      return Array.from(drawer.children).map(child => child.className.split(' ')[0]);
    };

    it('should hide every child except the wedge bar when minimized', () => {
      const unhandled = directChildClasses()
        .filter(className => className !== wedgeBar)
        .filter(className => !(ruleFor(`.bes-player-drawer.minimized .${className}`) ?? '').includes('display: none'));

      expect(unhandled).toEqual([]);
    });

    it('should show the wedge bar in its place', () => {
      expect(directChildClasses()).toContain(wedgeBar);
      expect(ruleFor(`.bes-player-drawer.minimized .${wedgeBar}`)).toContain('display: flex');
    });
  });

  describe('the page gutter follows the drawer', () => {
    it('should narrow the gutter only while the drawer is expanded', () => {
      const rule = ruleFor('body.bes-drawer-expanded #pgBd') ?? '';

      expect(rule).toContain('margin-left: 10px');
      expect(rule).toContain('padding-left: 10px');
    });

    it('should win against the styles the page sets for itself', () => {
      const rule = ruleFor('body.bes-drawer-expanded #pgBd') ?? '';

      expect(rule.match(/!important/g)?.length).toBe(2);
    });

    it('should animate the gutter in both directions', () => {
      expect(ruleFor('body.bes-drawer-host #pgBd')).toContain('transition');
    });
  });

  describe('visual continuity between the two states', () => {
    it('should band the drawer in the same colour as the wedge', () => {
      const wedgeBackground = ruleFor('.bes-player-drawer-minimized-bar') ?? '';
      const band = ruleFor('.bes-player-drawer') ?? '';

      const colour = wedgeBackground.match(/background:\s*(#[0-9a-f]{6})/i)?.[1];

      expect(colour).toBeTruthy();
      expect(band.toLowerCase()).toContain(`border-left: 6px solid ${colour?.toLowerCase()}`);
    });

    it('should keep the band inside the declared width', () => {
      expect(ruleFor('.bes-player-drawer')).toContain('box-sizing: border-box');
    });
  });
});
