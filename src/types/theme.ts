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
  waveform: string;
  waveformPlayed: string;
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

export function themeTokenToCssVariable(token: keyof Theme): string {
  const kebab = String(token)
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .toLowerCase();

  return `--bes-${kebab}`;
}

export function themeToCssVariables(theme: Theme): string {
  const declarations = THEME_TOKENS.map(token => `${themeTokenToCssVariable(token)}: ${theme[token]};`);

  declarations.push(`--bes-sprite-filter: ${theme.invertSprites ? 'invert(1) hue-rotate(180deg)' : 'none'};`);

  return declarations.join(' ');
}
