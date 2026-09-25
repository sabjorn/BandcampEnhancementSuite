/**
 * Theme tokens.
 *
 * Bandcamp's stylesheets are built almost entirely out of a greyscale ramp plus a cyan accent,
 * so a theme is expressed as that same ramp. `surface0` is the furthest-back background and
 * `textMax` the highest-contrast foreground; every step in between moves monotonically. A dark
 * theme is simply the ramp walked in the other direction, which keeps every contrast
 * relationship Bandcamp's own CSS relies on intact.
 */
export interface Theme {
  name: string;
  surface0: string;
  surface1: string;
  surface2: string;
  border: string;
  textMuted: string;
  textBody: string;
  textStrong: string;
  textMax: string;
  accent: string;
  accentText: string;
  danger: string;
  warning: string;
  success: string;
  /** Bandcamp's icon sheets are dark-on-transparent; a dark surface needs them inverted. */
  invertSprites: boolean;
}

export const THEME_TOKENS: ReadonlyArray<keyof Theme> = [
  'surface0',
  'surface1',
  'surface2',
  'border',
  'textMuted',
  'textBody',
  'textStrong',
  'textMax',
  'accent',
  'accentText',
  'danger',
  'warning',
  'success'
];

/** Bandcamp's own values, so selecting the light theme is a no-op rather than a re-skin. */
export const LIGHT_THEME: Theme = {
  name: 'light',
  surface0: '#ffffff',
  surface1: '#f5f5f5',
  surface2: '#ebebeb',
  border: '#cccccc',
  textMuted: '#999999',
  textBody: '#666666',
  textStrong: '#333333',
  textMax: '#000000',
  accent: '#1da0c3',
  accentText: '#ffffff',
  danger: '#c43329',
  warning: '#f9780a',
  success: '#619aa9',
  invertSprites: false
};

export const DARK_THEME: Theme = {
  name: 'dark',
  surface0: '#121212',
  surface1: '#1c1c1e',
  surface2: '#27272a',
  border: '#3f3f46',
  textMuted: '#8a8a91',
  textBody: '#b4b4bb',
  textStrong: '#e4e4e7',
  textMax: '#fafafa',
  accent: '#4cc4e3',
  accentText: '#0b1416',
  danger: '#f2685c',
  warning: '#fba14b',
  success: '#7fc0cf',
  invertSprites: true
};

export const BUILTIN_THEMES: Record<string, Theme> = {
  [LIGHT_THEME.name]: LIGHT_THEME,
  [DARK_THEME.name]: DARK_THEME
};

export const DEFAULT_THEME_NAME = LIGHT_THEME.name;

/**
 * The single lookup seam. A future user-theme editor extends this to consult stored custom
 * themes before falling back to the built-ins; nothing else needs to change.
 */
export function resolveTheme(name: string | undefined): Theme {
  if (!name) return BUILTIN_THEMES[DEFAULT_THEME_NAME];

  return BUILTIN_THEMES[name] ?? BUILTIN_THEMES[DEFAULT_THEME_NAME];
}

const CSS_COLOR_PATTERN = /^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/;

export function validateTheme(theme: Theme): string[] {
  const errors: string[] = [];

  if (!theme.name || !theme.name.trim()) {
    errors.push('Theme name must not be empty');
  }

  for (const token of THEME_TOKENS) {
    const value = theme[token];

    if (typeof value !== 'string' || !CSS_COLOR_PATTERN.test(value.trim())) {
      errors.push(`Theme token "${token}" must be a hex, rgb(a) or hsl(a) color, got "${value}"`);
    }
  }

  if (typeof theme.invertSprites !== 'boolean') {
    errors.push('Theme token "invertSprites" must be a boolean');
  }

  return errors;
}

/**
 * Kebab-cases a token name so `textStrong` becomes `--bes-text-strong` and `surface0` becomes
 * `--bes-surface-0`. The trailing-digit split matters: css/theme.css and the generated overrides
 * both spell the ramp `--bes-surface-0`, so the two must agree exactly.
 */
export function themeTokenToCssVariable(token: keyof Theme): string {
  const kebab = String(token)
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .toLowerCase();

  return `--bes-${kebab}`;
}

/** Serializes a theme into a `--bes-*: value;` declaration list for a style attribute or block. */
export function themeToCssVariables(theme: Theme): string {
  const declarations = THEME_TOKENS.map(token => `${themeTokenToCssVariable(token)}: ${theme[token]};`);

  declarations.push(`--bes-sprite-filter: ${theme.invertSprites ? 'invert(1) hue-rotate(180deg)' : 'none'};`);

  return declarations.join(' ');
}
