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
  /*
   * The waveform is drawn into a canvas, so it cannot take these from a stylesheet - both
   * players read them through themeToken(). `waveform` is the unplayed bars, `waveformPlayed`
   * the portion behind the playhead. drawOverlay composites source-atop, so both land only on
   * the bars: what has to read clearly is the edge between them, as much as either against the
   * page.
   */
  waveform: string;
  waveformPlayed: string;
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
  'success',
  'waveform',
  'waveformPlayed'
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
  waveform: '#e2e2e6',
  waveformPlayed: '#5b53e8',
  invertSprites: false
};

/*
 * Anchored on Bandcamp's own dark mode rather than invented, so pages we theme and the newer
 * pages Bandcamp themes itself do not read as two different dark modes when you move between
 * them. Their values, sampled from /discover: page background #222, body text #fff, accent
 * #0CACD7 (--blue400). The surface ramp and muted tones are ours - their design is effectively
 * flat, one surface and white text, which is not enough for the drawer, cart panel and
 * tracklist - but they are stepped in the same neutral grey family rather than a blue-tinted one.
 */
export const DARK_THEME: Theme = {
  name: 'dark',
  surface0: '#222222',
  surface1: '#2a2a2a',
  surface2: '#333333',
  border: '#454545',
  textMuted: '#a8a8a8',
  textBody: '#c4c4c4',
  textStrong: '#e8e8e8',
  textMax: '#ffffff',
  accent: '#0cacd7',
  accentText: '#222222',
  danger: '#f4857b',
  warning: '#fba14b',
  success: '#7fc0cf',
  waveform: '#e2e2e6',
  waveformPlayed: '#5b53e8',
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
