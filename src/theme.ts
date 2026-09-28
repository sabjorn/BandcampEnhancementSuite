import { createLogger } from './logger';
import { Theme, resolveTheme, themeToCssVariables, themeTokenToCssVariable, DEFAULT_THEME_NAME } from './types/theme';

const log = createLogger();

export const THEME_ATTRIBUTE = 'data-bes-theme';
const NATIVE_DARK_ATTRIBUTE = 'data-bes-native-dark';
export const CUSTOM_DESIGN_STYLE_ID = 'custom-design-rules-style';

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (!root) return;

  root.setAttribute('style', mergeThemeIntoStyleAttribute(root.getAttribute('style'), theme));
  root.setAttribute(THEME_ATTRIBUTE, theme.name);
}

function mergeThemeIntoStyleAttribute(existing: string | null, theme: Theme): string {
  const preserved = (existing ?? '')
    .split(';')
    .map(declaration => declaration.trim())
    .filter(declaration => declaration.length > 0 && !declaration.startsWith('--bes-'))
    .join('; ');

  const tokens = themeToCssVariables(theme);

  return preserved ? `${preserved}; ${tokens}` : tokens;
}

let enforcementObserver: MutationObserver | null = null;

function findCustomDesignStyle(): HTMLStyleElement | null {
  return document.getElementById(CUSTOM_DESIGN_STYLE_ID) as HTMLStyleElement | null;
}

function setCustomDesignDisabled(element: HTMLStyleElement, disabled: boolean): void {
  element.disabled = disabled;

  if (element.sheet) element.sheet.disabled = disabled;
}

export function isThemeActive(): boolean {
  const themeName = document.documentElement?.getAttribute(THEME_ATTRIBUTE);

  return themeName !== null && themeName !== undefined && themeName !== DEFAULT_THEME_NAME;
}

function enforceCustomDesignState(): void {
  const element = findCustomDesignStyle();
  if (!element) return;

  const shouldDisable = isThemeActive();
  if (element.disabled === shouldDisable) return;

  log.debug(`${shouldDisable ? 'Disabling' : 'Restoring'} Bandcamp custom design rules`);
  setCustomDesignDisabled(element, shouldDisable);
}

export function applyThemeFromConfig(): void {
  const port = chrome.runtime.connect(null, { name: 'bes' });

  port.onMessage.addListener((msg: { config?: { themeName?: string } }) => {
    if (msg.config) setTheme(msg.config.themeName);
  });

  port.postMessage({ requestConfig: {} });
}

const NATIVE_RAMP = `
  --white: #ffffff;
  --gray100: #f8f8f8;
  --gray200: #e6e6e6;
  --gray300: #aaaaaa;
  --gray400: #767676;
  --gray500: #5a5a5a;
  --gray600: #333333;
  --gray700: #222222;
`;

const SHADOW_EXCEPTION_CSS = `
  #page-footer,
  #page-footer * {
    ${NATIVE_RAMP}
    --default-background-color: #333333;
    --default-foreground-color: #f8f8f8;
    --page-background-color: #333333;
    --page-text-color: #f8f8f8;
  }

  :host(menu-bar),
  :host(menu-bar) * {
    ${NATIVE_RAMP}
    --default-background-color: #222222;
    --default-foreground-color: #ffffff;
    --page-background-color: #222222;
    --page-text-color: #ffffff;
  }
`;

let shadowSheet: CSSStyleSheet | null = null;

function getShadowSheet(): CSSStyleSheet | null {
  if (shadowSheet) return shadowSheet;
  if (typeof CSSStyleSheet === 'undefined') return null;

  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(SHADOW_EXCEPTION_CSS);
    shadowSheet = sheet;

    return shadowSheet;
  } catch (error: unknown) {
    log.error(`Failed to build the shadow theme sheet: ${error}`);

    return null;
  }
}

function findShadowRoots(): ShadowRoot[] {
  return Array.from(document.querySelectorAll('*'))
    .map(element => element.shadowRoot)
    .filter((root): root is ShadowRoot => root !== null);
}

const BANDCAMP_DIALOG_SELECTOR = '.g-dialog.dialog';
const BANDCAMP_DARK_MODE_CLASS = 'dark-mode';

function refreshNativeDarkFlag(enable: boolean): void {
  const root = document.documentElement;
  if (!root) return;

  if (!enable) {
    root.removeAttribute(NATIVE_DARK_ATTRIBUTE);

    return;
  }

  const bandcampOwned = Array.from(document.querySelectorAll(`.${BANDCAMP_DARK_MODE_CLASS}`)).some(
    element => !element.matches(BANDCAMP_DIALOG_SELECTOR)
  );

  if (!bandcampOwned) {
    root.removeAttribute(NATIVE_DARK_ATTRIBUTE);

    return;
  }

  root.setAttribute(NATIVE_DARK_ATTRIBUTE, 'true');
}

function applyBandcampDarkMode(scope: ParentNode, enable: boolean): void {
  scope.querySelectorAll(BANDCAMP_DIALOG_SELECTOR).forEach(dialog => {
    dialog.classList.toggle(BANDCAMP_DARK_MODE_CLASS, enable);
  });
}

function applyShadowException(root: ShadowRoot, enable: boolean): void {
  const sheet = getShadowSheet();
  if (!sheet || !Array.isArray(root.adoptedStyleSheets)) return;

  const without = root.adoptedStyleSheets.filter(adopted => adopted !== sheet);
  root.adoptedStyleSheets = enable ? [...without, sheet] : without;

  applyBandcampDarkMode(root, enable);
}

function enforceShadowState(active: boolean): void {
  refreshNativeDarkFlag(active);
  findShadowRoots().forEach(root => applyShadowException(root, active));
  applyBandcampDarkMode(document, active);
}

function enforceTheme(): void {
  const active = isThemeActive();

  enforceCustomDesignState();
  enforceShadowState(active);
}

export function themeToken(token: keyof Theme): string {
  const declared = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(themeTokenToCssVariable(token))
    .trim();
  if (declared) return declared;

  return String(resolveTheme(document.documentElement?.getAttribute(THEME_ATTRIBUTE) ?? undefined)[token]);
}

export function setTheme(themeName: string | undefined): Theme {
  const theme = resolveTheme(themeName);

  applyTheme(theme);

  return theme;
}

export function startThemeEnforcement(): void {
  if (enforcementObserver) return;

  enforceTheme();

  enforcementObserver = new MutationObserver(enforceTheme);
  enforcementObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [THEME_ATTRIBUTE]
  });
}

export function stopThemeEnforcement(): void {
  enforcementObserver?.disconnect();
  enforcementObserver = null;
}
