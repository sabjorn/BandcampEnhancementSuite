import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  LIGHT_THEME,
  DARK_THEME,
  DEFAULT_THEME_NAME,
  THEME_TOKENS,
  Theme,
  resolveTheme,
  validateTheme,
  themeToCssVariables,
  themeTokenToCssVariable
} from '../src/types/theme';
import {
  applyTheme,
  watchCustomDesignRules,
  activateTheme,
  THEME_ATTRIBUTE,
  CUSTOM_DESIGN_STYLE_ID
} from '../src/theme';
import { readMirroredThemeName, writeMirroredThemeName, THEME_STORAGE_KEY } from '../src/themeStorage';

describe('Theme', () => {
  /*
   * The tokens exist in two places that must agree exactly: the struct, and the stylesheets that
   * consume them. A token renamed on one side alone silently resolves to nothing at runtime, so
   * the contract is asserted here rather than discovered in a browser.
   */
  describe('stylesheet contract', () => {
    const readCss = (name: string) => readFileSync(resolve(__dirname, '..', 'css', name), 'utf8');

    it('should declare every struct token in css/theme.css for both themes', () => {
      const themeCss = readCss('theme.css');

      for (const token of THEME_TOKENS) {
        const variable = themeTokenToCssVariable(token);
        expect(themeCss).toContain(`${variable}: ${LIGHT_THEME[token]};`);
        expect(themeCss).toContain(`${variable}: ${DARK_THEME[token]};`);
      }
    });

    it('should only reference tokens the struct defines from the generated overrides', () => {
      const declared = new Set([...THEME_TOKENS.map(themeTokenToCssVariable), '--bes-sprite-filter']);
      const referenced = new Set(readCss('theme.generated.css').match(/--bes-[a-z0-9-]+/g) ?? []);

      expect([...referenced].filter(variable => !declared.has(variable))).toEqual([]);
    });

    it('should only reference tokens the struct defines from css/style.css', () => {
      // Layout custom properties share the --bes- prefix but carry no color, so they are not tokens.
      const layoutProperties = ['--bes-drawer-width'];
      const declared = new Set([
        ...THEME_TOKENS.map(themeTokenToCssVariable),
        '--bes-sprite-filter',
        ...layoutProperties
      ]);
      const referenced = new Set(readCss('style.css').match(/var\(\s*(--bes-[a-z0-9-]+)/g) ?? []);
      const names = [...referenced].map(match => match.replace(/^var\(\s*/, ''));

      expect(names.filter(variable => !declared.has(variable))).toEqual([]);
    });

    it('should scope every generated override to the dark theme so light is untouched', () => {
      const selectors = readCss('theme.generated.css')
        .split('\n')
        .filter(line => line.trim().endsWith('{') && !line.trim().startsWith('@'));

      expect(selectors.length).toBeGreaterThan(0);
      expect(selectors.every(line => line.includes("[data-bes-theme='dark']"))).toBe(true);
    });
  });

  describe('resolveTheme', () => {
    it('should return the named built-in theme', () => {
      expect(resolveTheme('dark')).toBe(DARK_THEME);
      expect(resolveTheme('light')).toBe(LIGHT_THEME);
    });

    it('should fall back to the default theme for an unknown name', () => {
      expect(resolveTheme('solarized')).toBe(LIGHT_THEME);
    });

    it('should fall back to the default theme when no name is stored', () => {
      expect(resolveTheme(undefined)).toBe(LIGHT_THEME);
      expect(DEFAULT_THEME_NAME).toBe('light');
    });
  });

  describe('themeTokenToCssVariable', () => {
    it('should kebab-case camelCase token names', () => {
      expect(themeTokenToCssVariable('textStrong')).toBe('--bes-text-strong');
      expect(themeTokenToCssVariable('surface0')).toBe('--bes-surface-0');
      expect(themeTokenToCssVariable('border')).toBe('--bes-border');
    });
  });

  describe('themeToCssVariables', () => {
    it('should emit a declaration for every token', () => {
      const css = themeToCssVariables(DARK_THEME);

      for (const token of THEME_TOKENS) {
        expect(css).toContain(`${themeTokenToCssVariable(token)}: ${DARK_THEME[token]};`);
      }
    });

    it('should translate invertSprites into a usable filter value', () => {
      expect(themeToCssVariables(DARK_THEME)).toContain('--bes-sprite-filter: invert(1) hue-rotate(180deg);');
      expect(themeToCssVariables(LIGHT_THEME)).toContain('--bes-sprite-filter: none;');
    });

    it('should not emit the theme name as a custom property', () => {
      expect(themeToCssVariables(DARK_THEME)).not.toContain('--bes-name');
    });
  });

  describe('validateTheme', () => {
    it('should accept both built-in themes', () => {
      expect(validateTheme(LIGHT_THEME)).toEqual([]);
      expect(validateTheme(DARK_THEME)).toEqual([]);
    });

    it('should reject a token that is not a color', () => {
      const broken: Theme = { ...DARK_THEME, accent: 'not-a-color' };

      expect(validateTheme(broken)).toEqual([
        'Theme token "accent" must be a hex, rgb(a) or hsl(a) color, got "not-a-color"'
      ]);
    });

    it('should accept rgb, rgba and hsl notations', () => {
      expect(validateTheme({ ...DARK_THEME, accent: 'rgb(0, 161, 198)' })).toEqual([]);
      expect(validateTheme({ ...DARK_THEME, accent: 'rgba(0, 161, 198, 0.5)' })).toEqual([]);
      expect(validateTheme({ ...DARK_THEME, accent: 'hsl(190, 100%, 40%)' })).toEqual([]);
    });

    it('should reject an empty theme name', () => {
      expect(validateTheme({ ...DARK_THEME, name: '   ' })).toContain('Theme name must not be empty');
    });

    it('should reject a non-boolean invertSprites', () => {
      const broken = { ...DARK_THEME, invertSprites: 'yes' } as unknown as Theme;

      expect(validateTheme(broken)).toContain('Theme token "invertSprites" must be a boolean');
    });
  });

  describe('applyTheme', () => {
    beforeEach(() => {
      document.documentElement.removeAttribute('style');
      document.documentElement.removeAttribute(THEME_ATTRIBUTE);
    });

    it('should stamp the theme name on the root element', () => {
      applyTheme(DARK_THEME);

      expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    });

    it('should write every token onto the root element', () => {
      applyTheme(DARK_THEME);

      const style = document.documentElement.getAttribute('style') ?? '';
      expect(style).toContain('--bes-surface-0: #121212');
      expect(style).toContain('--bes-accent: #4cc4e3');
    });

    it('should replace previous tokens rather than accumulate them on re-apply', () => {
      applyTheme(DARK_THEME);
      applyTheme(LIGHT_THEME);

      const style = document.documentElement.getAttribute('style') ?? '';
      expect(style).toContain('--bes-surface-0: #ffffff');
      expect(style).not.toContain('#121212');
      expect(style.match(/--bes-surface-0/g)).toHaveLength(1);
    });

    it('should preserve unrelated inline styles', () => {
      document.documentElement.setAttribute('style', 'overflow: hidden');

      applyTheme(DARK_THEME);

      expect(document.documentElement.getAttribute('style')).toContain('overflow: hidden');
    });
  });

  describe('watchCustomDesignRules', () => {
    beforeEach(() => {
      document.getElementById(CUSTOM_DESIGN_STYLE_ID)?.remove();
    });

    afterEach(() => {
      watchCustomDesignRules(false);
      document.getElementById(CUSTOM_DESIGN_STYLE_ID)?.remove();
    });

    const addCustomDesignStyle = (): HTMLStyleElement => {
      const style = document.createElement('style');
      style.id = CUSTOM_DESIGN_STYLE_ID;
      style.textContent = '#pgBd { background: #FCEE21; }';
      document.head.appendChild(style);

      return style;
    };

    it('should disable an artist stylesheet that is already present', () => {
      const style = addCustomDesignStyle();

      watchCustomDesignRules(true);

      expect(style.disabled).toBe(true);
    });

    it('should re-enable the artist stylesheet when theming is turned off', () => {
      const style = addCustomDesignStyle();

      watchCustomDesignRules(true);
      watchCustomDesignRules(false);

      expect(style.disabled).toBe(false);
    });

    it('should disable an artist stylesheet that arrives after the watch starts', async () => {
      watchCustomDesignRules(true);

      const style = addCustomDesignStyle();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(style.disabled).toBe(true);
    });

    it('should leave the page alone when nothing custom is present', () => {
      expect(() => watchCustomDesignRules(true)).not.toThrow();
    });
  });

  describe('activateTheme', () => {
    afterEach(() => {
      watchCustomDesignRules(false);
      document.getElementById(CUSTOM_DESIGN_STYLE_ID)?.remove();
    });

    it('should apply the named theme and neutralise artist styling', () => {
      const style = document.createElement('style');
      style.id = CUSTOM_DESIGN_STYLE_ID;
      document.head.appendChild(style);

      const theme = activateTheme('dark');

      expect(theme).toBe(DARK_THEME);
      expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
      expect(style.disabled).toBe(true);
    });

    it('should hand artist styling back when the light theme is selected', () => {
      const style = document.createElement('style');
      style.id = CUSTOM_DESIGN_STYLE_ID;
      document.head.appendChild(style);

      activateTheme('dark');
      activateTheme('light');

      expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('light');
      expect(style.disabled).toBe(false);
    });
  });

  /*
   * document_start.js and document_end.js are separate bundles, so each ships its own copy of
   * theme.ts with its own module-level observers. Loading the module twice through
   * vi.resetModules() reproduces that faithfully - a single shared instance does not, because
   * then one call tidies up the very observer the other installed.
   *
   * The failure this guards against: document_start themes the page dark and leaves an observer
   * behind; the user toggles to light through document_end's copy; document_start's observer
   * then fires on the next DOM change and re-disables the artist stylesheet that was just
   * restored, leaving artist pages permanently stripped of their own design.
   */
  describe('two module instances, as the two content-script bundles produce', () => {
    let artistStyle: HTMLStyleElement;
    let documentStart: typeof import('../src/theme');
    let documentEnd: typeof import('../src/theme');

    beforeEach(async () => {
      document.getElementById(CUSTOM_DESIGN_STYLE_ID)?.remove();
      artistStyle = document.createElement('style');
      artistStyle.id = CUSTOM_DESIGN_STYLE_ID;
      artistStyle.textContent = '#pgBd { background: #FCEE21; }';
      document.head.appendChild(artistStyle);

      vi.resetModules();
      documentStart = await import('../src/theme');
      vi.resetModules();
      documentEnd = await import('../src/theme');
      expect(documentStart).not.toBe(documentEnd);
    });

    afterEach(() => {
      documentStart.watchCustomDesignRules(false);
      documentEnd.watchCustomDesignRules(false);
      artistStyle.remove();
      document.documentElement.removeAttribute(THEME_ATTRIBUTE);
    });

    const settle = () => new Promise(resolve => setTimeout(resolve, 0));

    it("should not let document_start's observer undo a switch back to light", async () => {
      documentStart.activateTheme('dark');
      expect(artistStyle.disabled).toBe(true);

      documentEnd.activateTheme('light');
      expect(artistStyle.disabled).toBe(false);

      document.body.appendChild(document.createElement('div'));
      await settle();

      expect(artistStyle.disabled).toBe(false);
    });

    it("should let document_start's observer re-assert when switched back to dark", async () => {
      documentStart.activateTheme('dark');
      documentEnd.activateTheme('light');
      documentEnd.activateTheme('dark');

      document.body.appendChild(document.createElement('div'));
      await settle();

      expect(artistStyle.disabled).toBe(true);
    });

    it('should restore an artist sheet that only arrives after switching to light', async () => {
      documentStart.activateTheme('dark');
      documentEnd.activateTheme('light');

      artistStyle.remove();
      const late = document.createElement('style');
      late.id = CUSTOM_DESIGN_STYLE_ID;
      late.disabled = true;
      document.head.appendChild(late);
      await settle();

      expect(late.disabled).toBe(false);
      late.remove();
    });
  });

  /*
   * Contrast is a property of the token values themselves, so it is asserted on the struct
   * rather than discovered in a browser. This is what caught the cart's muted currency labels
   * sitting at 4.34:1 on the raised surface.
   *
   * Only the dark theme is checked. LIGHT_THEME deliberately holds Bandcamp's own palette - its
   * #999 muted grey and #1da0c3 accent do not clear AA against white, and "fixing" them would
   * mean BES restyling Bandcamp in light mode, which is explicitly not what this feature does.
   */
  describe('dark theme contrast', () => {
    const relativeLuminance = (hex: string): number => {
      const channels = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
      const [r, g, b] = channels.map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));

      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const contrast = (a: string, b: string): number => {
      const [high, low] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);

      return (high + 0.05) / (low + 0.05);
    };

    const SURFACES = ['surface0', 'surface1', 'surface2'] as const;
    const FOREGROUNDS = ['textMuted', 'textBody', 'textStrong', 'textMax', 'accent'] as const;
    const AA_NORMAL_TEXT = 4.5;

    it('should verify the helper against a known pair', () => {
      expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 1);
      expect(contrast('#767676', '#ffffff')).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });

    it.each(FOREGROUNDS)('should clear AA for %s on every surface', foreground => {
      for (const surface of SURFACES) {
        const ratio = contrast(DARK_THEME[foreground], DARK_THEME[surface]);

        expect(
          ratio,
          `${foreground} (${DARK_THEME[foreground]}) on ${surface} (${DARK_THEME[surface]}) is ${ratio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      }
    });

    it('should keep accentText legible on the accent fill', () => {
      expect(contrast(DARK_THEME.accentText, DARK_THEME.accent)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });

    it('should keep the muted tone distinguishable from body text', () => {
      expect(DARK_THEME.textMuted).not.toBe(DARK_THEME.textBody);
      expect(relativeLuminance(DARK_THEME.textMuted)).toBeLessThan(relativeLuminance(DARK_THEME.textBody));
    });
  });

  describe('theme storage mirror', () => {
    beforeEach(() => {
      globalThis.chrome = {
        storage: {
          local: {
            get: vi.fn().mockResolvedValue({}),
            set: vi.fn().mockResolvedValue(undefined)
          }
        }
      } as any;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should read the stored theme name', async () => {
      (globalThis.chrome.storage.local.get as any).mockResolvedValue({ [THEME_STORAGE_KEY]: 'dark' });

      await expect(readMirroredThemeName()).resolves.toBe('dark');
    });

    it('should fall back to the default when nothing is stored', async () => {
      await expect(readMirroredThemeName()).resolves.toBe(DEFAULT_THEME_NAME);
    });

    it('should fall back to the default rather than throwing when storage fails', async () => {
      (globalThis.chrome.storage.local.get as any).mockRejectedValue(new Error('no storage'));

      await expect(readMirroredThemeName()).resolves.toBe(DEFAULT_THEME_NAME);
    });

    it('should write the theme name under the shared key', async () => {
      await writeMirroredThemeName('dark');

      expect(globalThis.chrome.storage.local.set).toHaveBeenCalledWith({ [THEME_STORAGE_KEY]: 'dark' });
    });
  });
});
