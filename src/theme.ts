import { createLogger } from './logger';
import { Theme, resolveTheme, themeToCssVariables, DEFAULT_THEME_NAME } from './types/theme';
import { readMirroredThemeName } from './themeStorage';

export { readMirroredThemeName, writeMirroredThemeName, THEME_STORAGE_KEY } from './themeStorage';

const log = createLogger();

export const THEME_ATTRIBUTE = 'data-bes-theme';
export const CUSTOM_DESIGN_STYLE_ID = 'custom-design-rules-style';

/**
 * Writes the theme's tokens onto the root element and stamps the theme name on it. The
 * stylesheets ship with every rule scoped under `[data-bes-theme='dark']`, so they stay inert
 * until this attribute lands.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (!root) return;

  root.setAttribute('style', mergeThemeIntoStyleAttribute(root.getAttribute('style'), theme));
  root.setAttribute(THEME_ATTRIBUTE, theme.name);
}

/**
 * Replaces any previously written `--bes-*` declarations rather than appending, so repeated
 * toggling does not grow the attribute without bound. Other inline styles are preserved.
 */
function mergeThemeIntoStyleAttribute(existing: string | null, theme: Theme): string {
  const preserved = (existing ?? '')
    .split(';')
    .map(declaration => declaration.trim())
    .filter(declaration => declaration.length > 0 && !declaration.startsWith('--bes-'))
    .join('; ');

  const tokens = themeToCssVariables(theme);

  return preserved ? `${preserved}; ${tokens}` : tokens;
}

let customDesignObserver: MutationObserver | null = null;

function findCustomDesignStyle(): HTMLStyleElement | null {
  return document.getElementById(CUSTOM_DESIGN_STYLE_ID) as HTMLStyleElement | null;
}

function setCustomDesignDisabled(element: HTMLStyleElement, disabled: boolean): void {
  element.disabled = disabled;

  // `HTMLStyleElement.disabled` is a no-op until the sheet is attached, which for a
  // parser-inserted <style> can lag the mutation record that told us about it.
  if (element.sheet) element.sheet.disabled = disabled;
}

/**
 * Whether a non-default theme is currently active, read back off the root element.
 *
 * This is deliberately read from the DOM rather than from module state. document_start.js and
 * document_end.js are separate bundles, so each carries its own copy of this module and its own
 * observers; a observer that trusted its captured argument would keep re-disabling the artist
 * stylesheet that the other bundle had just restored. The root attribute is the one piece of
 * state both bundles genuinely share.
 */
function isThemeActive(): boolean {
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

/**
 * Artist and label pages carry a generated `#custom-design-rules-style` sheet holding the
 * artist's chosen background, text, link and navbar colors. A theme can only be consistent if
 * that sheet is out of the way, so dark mode disables it and light mode hands it back.
 */
export function watchCustomDesignRules(disable: boolean): void {
  customDesignObserver?.disconnect();
  customDesignObserver = null;

  const existing = findCustomDesignStyle();
  if (existing) {
    log.debug(`${disable ? 'Disabling' : 'Restoring'} Bandcamp custom design rules`);
    setCustomDesignDisabled(existing, disable);
  }

  // The sheet lives inside #pgBd, so at document_start it has not been parsed yet. Watch for it,
  // and keep watching in both themes: Bandcamp rewrites the sheet when the design changes, and
  // the observer has to survive a toggle so it can re-assert in whichever direction is current.
  customDesignObserver = new MutationObserver(enforceCustomDesignState);

  customDesignObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

/**
 * Applies the stored theme's tokens to an extension page. Unlike a Bandcamp tab there is no
 * artist styling to neutralise here, so only the custom properties are needed - and because
 * `applyTheme` writes them inline onto <html>, these pages need no stylesheet of their own.
 */
export async function applyStoredTheme(): Promise<Theme> {
  const theme = resolveTheme(await readMirroredThemeName());

  applyTheme(theme);

  return theme;
}

/*
 * Components that are already dark in Bandcamp's light theme - the page footer above all - must
 * keep their native palette, or the outer-document remap in css/theme.css flips them into a
 * bright slab at the bottom of a dark page.
 *
 * The exception has to be scoped *inside* the shadow root, because the footer chrome and the
 * cookie dialog live in the same tree and need opposite treatment. An outer stylesheet cannot
 * select either of them, so the rules are adopted into the shadow root directly.
 */
const SHADOW_EXCEPTION_CSS = `
  #page-footer,
  #page-footer * {
    --white: #ffffff;
    --gray100: #f8f8f8;
    --gray200: #e6e6e6;
    --gray300: #aaaaaa;
    --gray400: #767676;
    --gray500: #5a5a5a;
    --gray600: #333333;
    --gray700: #222222;
    --default-background-color: #333333;
    --default-foreground-color: #f8f8f8;
    --page-background-color: #333333;
    --page-text-color: #f8f8f8;
  }
`;

let shadowObserver: MutationObserver | null = null;
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

/**
 * Bandcamp's dialog component ships its own designed dark variant behind a `dark-mode` class.
 * Opting into it beats anything we could override from outside, because it carries the palette
 * its designers intended rather than a mechanical inversion of the light one.
 */
const BANDCAMP_DIALOG_SELECTOR = '.g-dialog.dialog';
const BANDCAMP_DARK_MODE_CLASS = 'dark-mode';

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

/**
 * Keeps the shadow-root exceptions in step with the active theme. Bandcamp hydrates these
 * components after first paint, so new hosts are picked up as they appear.
 */
export function watchShadowRoots(enable: boolean): void {
  shadowObserver?.disconnect();
  shadowObserver = null;

  findShadowRoots().forEach(root => applyShadowException(root, enable));
  applyBandcampDarkMode(document, enable);

  // Same cross-bundle reasoning as watchCustomDesignRules: the observer keeps running in both
  // themes and reads the current one off the root element rather than trusting its argument.
  shadowObserver = new MutationObserver(() => {
    const active = isThemeActive();
    findShadowRoots().forEach(root => applyShadowException(root, active));
    applyBandcampDarkMode(document, active);
  });

  shadowObserver.observe(document.documentElement, { childList: true, subtree: true });
}

/** Applies a theme by name and brings the artist custom-design sheet in line with it. */
export function activateTheme(themeName: string | undefined): Theme {
  const theme = resolveTheme(themeName);

  const isThemed = theme.name !== DEFAULT_THEME_NAME;

  applyTheme(theme);
  watchCustomDesignRules(isThemed);
  watchShadowRoots(isThemed);

  return theme;
}
