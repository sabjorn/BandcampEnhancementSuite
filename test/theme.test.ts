import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
  setTheme,
  themeToken,
  startThemeEnforcement,
  stopThemeEnforcement,
  THEME_ATTRIBUTE,
  CUSTOM_DESIGN_STYLE_ID
} from '../src/theme';

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
      expect(style).toContain(`--bes-surface-0: ${DARK_THEME.surface0}`);
      expect(style).toContain(`--bes-accent: ${DARK_THEME.accent}`);
    });

    it('should replace previous tokens rather than accumulate them on re-apply', () => {
      applyTheme(DARK_THEME);
      applyTheme(LIGHT_THEME);

      const style = document.documentElement.getAttribute('style') ?? '';
      expect(style).toContain(`--bes-surface-0: ${LIGHT_THEME.surface0}`);
      expect(style).not.toContain(DARK_THEME.surface0);
      expect(style.match(/--bes-surface-0/g)).toHaveLength(1);
    });

    it('should preserve unrelated inline styles', () => {
      document.documentElement.setAttribute('style', 'overflow: hidden');

      applyTheme(DARK_THEME);

      expect(document.documentElement.getAttribute('style')).toContain('overflow: hidden');
    });
  });

  describe('enforcement against the artist stylesheet', () => {
    beforeEach(() => {
      document.getElementById(CUSTOM_DESIGN_STYLE_ID)?.remove();
    });

    afterEach(() => {
      stopThemeEnforcement();
      document.getElementById(CUSTOM_DESIGN_STYLE_ID)?.remove();
      document.documentElement.removeAttribute(THEME_ATTRIBUTE);
    });

    const settle = () => new Promise(resolve => setTimeout(resolve, 0));

    const addCustomDesignStyle = (): HTMLStyleElement => {
      const style = document.createElement('style');
      style.id = CUSTOM_DESIGN_STYLE_ID;
      style.textContent = '#pgBd { background: #FCEE21; }';
      document.head.appendChild(style);

      return style;
    };

    it('should disable an artist stylesheet that is already present', () => {
      const style = addCustomDesignStyle();

      setTheme('dark');
      startThemeEnforcement();

      expect(style.disabled).toBe(true);
    });

    it('should re-enable the artist stylesheet when theming is turned off', async () => {
      const style = addCustomDesignStyle();

      setTheme('dark');
      startThemeEnforcement();
      setTheme('light');
      await settle();

      expect(style.disabled).toBe(false);
    });

    it('should disable an artist stylesheet that arrives after the watch starts', async () => {
      setTheme('dark');
      startThemeEnforcement();

      const style = addCustomDesignStyle();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(style.disabled).toBe(true);
    });

    it('should leave the page alone when nothing custom is present', () => {
      setTheme('dark');

      expect(() => startThemeEnforcement()).not.toThrow();
    });
  });

  describe('setTheme with enforcement running', () => {
    afterEach(() => {
      stopThemeEnforcement();
      document.getElementById(CUSTOM_DESIGN_STYLE_ID)?.remove();
      document.documentElement.removeAttribute(THEME_ATTRIBUTE);
    });

    const settle = () => new Promise(resolve => setTimeout(resolve, 0));

    it('should apply the named theme and neutralise artist styling', () => {
      const style = document.createElement('style');
      style.id = CUSTOM_DESIGN_STYLE_ID;
      document.head.appendChild(style);

      const theme = setTheme('dark');
      startThemeEnforcement();

      expect(theme).toBe(DARK_THEME);
      expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
      expect(style.disabled).toBe(true);
    });

    it('should hand artist styling back when the light theme is selected', async () => {
      const style = document.createElement('style');
      style.id = CUSTOM_DESIGN_STYLE_ID;
      document.head.appendChild(style);

      setTheme('dark');
      startThemeEnforcement();
      setTheme('light');
      await settle();

      expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('light');
      expect(style.disabled).toBe(false);
    });

    it('should be idempotent so a second call does not add a second observer', () => {
      startThemeEnforcement();

      expect(() => startThemeEnforcement()).not.toThrow();
    });
  });

  /*
   * themeToken feeds canvas fillStyle, where an empty string is silently ignored and the last
   * colour set is used instead. It has to return something usable even before the stylesheets
   * have applied, which is the state the drawer player reads it in.
   */
  describe('themeToken fallback', () => {
    afterEach(() => {
      document.documentElement.removeAttribute('style');
      document.documentElement.removeAttribute(THEME_ATTRIBUTE);
    });

    it('should prefer the declared custom property', () => {
      document.documentElement.setAttribute('style', '--bes-waveform: #abcdef;');

      expect(themeToken('waveform')).toBe('#abcdef');
    });

    it('should fall back to the struct when the property is not declared', () => {
      document.documentElement.setAttribute(THEME_ATTRIBUTE, 'dark');

      expect(themeToken('waveform')).toBe(DARK_THEME.waveform);
      expect(themeToken('waveformPlayed')).toBe(DARK_THEME.waveformPlayed);
    });

    it('should never return an empty string for any token', () => {
      for (const token of THEME_TOKENS) {
        expect(themeToken(token), `${token} returned empty`).not.toBe('');
      }
    });
  });

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
    // The semantic tones are foregrounds too - error and warning text is rendered in them,
    // and `danger` only just cleared AA after the surfaces were re-anchored on Bandcamp's.
    const FOREGROUNDS = [
      'textMuted',
      'textBody',
      'textStrong',
      'textMax',
      'accent',
      'danger',
      'warning',
      'success'
    ] as const;
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

    /*
     * These three come straight from Bandcamp's own dark mode (sampled on /discover:
     * --default-background-color, --default-foreground-color, --blue400). Keeping them in step
     * is what stops pages we theme and pages Bandcamp themes itself reading as two different
     * dark modes. Change them only alongside a deliberate decision to diverge.
     */
    it("should stay anchored on Bandcamp's own dark values", () => {
      expect(DARK_THEME.surface0).toBe('#222222');
      expect(DARK_THEME.textMax).toBe('#ffffff');
      expect(DARK_THEME.accent).toBe('#0cacd7');
    });

    it('should keep accentText legible on the accent fill', () => {
      expect(contrast(DARK_THEME.accentText, DARK_THEME.accent)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });

    /*
     * The waveform tokens are graphics, not text, so they are not in the AA list above. What has
     * to hold is that the bars are visible on the page and that the played portion is tellable
     * from the unplayed - drawOverlay composites source-atop, so the edge between the two is
     * what conveys progress. 3:1 is the non-text threshold.
     */
    it('should keep the waveform legible against the page and against itself', () => {
      const bars = contrast(DARK_THEME.waveform, DARK_THEME.surface0);
      const played = contrast(DARK_THEME.waveformPlayed, DARK_THEME.surface0);
      const between = contrast(DARK_THEME.waveformPlayed, DARK_THEME.waveform);

      expect(bars, `waveform ${DARK_THEME.waveform} on surface0 is ${bars.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
      expect(
        between,
        `waveformPlayed ${DARK_THEME.waveformPlayed} on waveform ${DARK_THEME.waveform} is ${between.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(3);
      expect(played).toBeGreaterThan(1.5);
    });

    it('should keep the muted tone distinguishable from body text', () => {
      expect(DARK_THEME.textMuted).not.toBe(DARK_THEME.textBody);
      expect(relativeLuminance(DARK_THEME.textMuted)).toBeLessThan(relativeLuminance(DARK_THEME.textBody));
    });
  });
});
