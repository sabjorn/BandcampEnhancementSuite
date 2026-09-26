import { createLogger } from './logger';
import { Theme, resolveTheme, themeToCssVariables, themeTokenToCssVariable, DEFAULT_THEME_NAME } from './types/theme';

const log = createLogger();

export const THEME_ATTRIBUTE = 'data-bes-theme';
const NATIVE_DARK_ATTRIBUTE = 'data-bes-native-dark';
export const CUSTOM_DESIGN_STYLE_ID = 'custom-design-rules-style';

/**
 * Writes the theme's tokens onto the root element and stamps the theme name on it. The
 * stylesheets ship with every rule scoped under `[data-bes-theme='dark']`, so they stay inert
 * until this attribute lands.
 */
function applyTheme(theme: Theme): void {
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

let enforcementObserver: MutationObserver | null = null;

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
 * Whether a non-default theme is currently active, read off the root element.
 *
 * The attribute is the theme state - it is what the stylesheets key off and what `setTheme`
 * writes - so enforcement reads it rather than being handed a flag.
 */
export function isThemeActive(): boolean {
  const themeName = document.documentElement?.getAttribute(THEME_ATTRIBUTE);

  return themeName !== null && themeName !== undefined && themeName !== DEFAULT_THEME_NAME;
}

/**
 * Artist and label pages carry a generated `#custom-design-rules-style` sheet holding the
 * artist's chosen background, text, link and navbar colors. A theme can only be consistent if
 * that sheet is out of the way, so a non-default theme disables it and the default hands it back.
 */
function enforceCustomDesignState(): void {
  const element = findCustomDesignStyle();
  if (!element) return;

  const shouldDisable = isThemeActive();
  if (element.disabled === shouldDisable) return;

  log.debug(`${shouldDisable ? 'Disabling' : 'Restoring'} Bandcamp custom design rules`);
  setCustomDesignDisabled(element, shouldDisable);
}

/**
 * Themes an extension page - the popup, the permission page - from the config.
 *
 * These are not Bandcamp tabs: there is no artist styling to neutralise and no late-hydrating
 * markup, so they need the tokens and nothing else. They read config over the same `bes` port
 * the content script uses, because that is the one way config is read.
 */
export function applyThemeFromConfig(): void {
  const port = chrome.runtime.connect(null, { name: 'bes' });

  port.onMessage.addListener((msg: { config?: { themeName?: string } }) => {
    if (msg.config) setTheme(msg.config.themeName);
  });

  port.postMessage({ requestConfig: {} });
}

/*
 * Components that are already dark in Bandcamp's light theme - the menubar and the page footer -
 * must keep their native palette, or the outer-document remap in css/theme.css flips them into a
 * bright slab on a dark page.
 *
 * The exception has to be scoped *inside* the shadow root, because the footer chrome and the
 * cookie dialog live in the same tree and need opposite treatment. An outer stylesheet cannot
 * select either of them, so the rules are adopted into the shadow root directly.
 */
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

  /*
   * The menubar is the other already-dark component, and unlike the footer the whole shadow tree
   * wants the native palette - there is no lighter region inside it needing opposite treatment.
   * Left remapped it inverts exactly: a white bar with dark text on a dark page.
   */
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

/**
 * Bandcamp's dialog component ships its own designed dark variant behind a `dark-mode` class.
 * Opting into it beats anything we could override from outside, because it carries the palette
 * its designers intended rather than a mechanical inversion of the light one.
 */
const BANDCAMP_DIALOG_SELECTOR = '.g-dialog.dialog';
const BANDCAMP_DARK_MODE_CLASS = 'dark-mode';

/**
 * Bandcamp's newer pages (discover, search, the purchase browser) implement dark mode themselves,
 * keyed off prefers-color-scheme, and mark every participating element `.dark-mode`. Where that
 * has happened our remap of their design-system variables is not merely redundant, it breaks
 * them: those components read `--white` expecting white so they can put a light label on a dark
 * button, and handing them #121212 turns the label black-on-black.
 *
 * Presence of that class is the signal that Bandcamp has it covered, so the whole modern-variable
 * remap stands down for the page. The classic stylesheets still get their overrides - Bandcamp's
 * native dark does not reach those.
 */
function refreshNativeDarkFlag(enable: boolean): void {
  const root = document.documentElement;
  if (!root) return;

  // A dialog we opted in ourselves must not be mistaken for Bandcamp having themed the page.
  const bandcampOwned = Array.from(document.querySelectorAll(`.${BANDCAMP_DARK_MODE_CLASS}`)).some(
    element => !element.matches(BANDCAMP_DIALOG_SELECTOR)
  );

  if (enable && bandcampOwned) {
    root.setAttribute(NATIVE_DARK_ATTRIBUTE, 'true');

    return;
  }

  root.removeAttribute(NATIVE_DARK_ATTRIBUTE);
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

/** Brings the shadow-root exceptions and Bandcamp's own dark-mode opt-in in step with the theme. */
function enforceShadowState(active: boolean): void {
  refreshNativeDarkFlag(active);
  findShadowRoots().forEach(root => applyShadowException(root, active));
  applyBandcampDarkMode(document, active);
}

/** Everything that has to be re-asserted against the DOM when the theme or the page changes. */
function enforceTheme(): void {
  const active = isThemeActive();

  enforceCustomDesignState();
  enforceShadowState(active);
}

/**
 * Resolves a theme by name and writes it to the root element. This is the only way the theme is
 * changed - it sets state and nothing else, so it is safe to call from anywhere: the drawer
 * toggle, a config broadcast, or an extension page with no Bandcamp markup at all.
 */
/**
 * Reads a token off the root element, for the few places that need a colour in JavaScript rather
 * than CSS - the waveform is drawn into a canvas, so it cannot pick one up from a stylesheet.
 */
export function themeToken(token: keyof Theme): string {
  const declared = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(themeTokenToCssVariable(token))
    .trim();
  if (declared) return declared;

  // The stylesheets may not have applied yet, and an empty string is silently ignored as a
  // canvas fillStyle - which would paint with whatever colour was set last. Fall back to the
  // struct so callers always get a usable colour.
  return String(resolveTheme(document.documentElement?.getAttribute(THEME_ATTRIBUTE) ?? undefined)[token]);
}

export function setTheme(themeName: string | undefined): Theme {
  const theme = resolveTheme(themeName);

  applyTheme(theme);

  return theme;
}

/**
 * Starts enforcing the theme against Bandcamp's DOM, and keeps doing so for the life of the page.
 *
 * Called once, from document_start only. The pieces this has to correct - the artist stylesheet,
 * the menubar and footer shadow roots, Bandcamp's dialogs - are all parsed or hydrated after
 * document_start runs, so something has to watch for them; and document_start is the entry point
 * that runs first and lives longest, which makes it the owner.
 *
 * document_end must not call this. It only ever changes the theme, via `setTheme`, and the
 * attribute observer below picks that up. Having both entry points install observers is what
 * previously left them fighting over the artist stylesheet, because each bundle is compiled
 * separately and cannot see - or disconnect - the other's.
 */
export function startThemeEnforcement(): void {
  if (enforcementObserver) return;

  enforceTheme();

  enforcementObserver = new MutationObserver(enforceTheme);
  enforcementObserver.observe(document.documentElement, {
    // childList/subtree catches the markup arriving; the attribute filter catches the theme
    // itself changing, so a toggle in document_end is reacted to immediately rather than on the
    // next incidental mutation.
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [THEME_ATTRIBUTE]
  });
}

/**
 * Stops enforcement and releases the observer.
 *
 * Nothing in the extension calls this - enforcement runs for the life of the page and follows
 * the attribute rather than being torn down on a toggle. It exists so tests can disconnect an
 * observer between cases, which they cannot do any other way once one is running against the
 * shared document.
 */
export function stopThemeEnforcement(): void {
  enforcementObserver?.disconnect();
  enforcementObserver = null;
}
