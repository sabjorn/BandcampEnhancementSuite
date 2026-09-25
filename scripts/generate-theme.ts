/**
 * Generates `css/theme.generated.css` from Bandcamp's own stylesheets.
 *
 * Bandcamp's CSS carries no custom properties worth remapping, but its palette is overwhelmingly
 * a greyscale ramp plus one cyan accent. Inverting a monotonic ramp preserves every contrast
 * relationship the original CSS relies on, so this script finds every declaration whose colors
 * are *entirely* on that ramp and re-emits it against the `--bes-*` tokens. Colors off the ramp
 * (error reds, the orange and purple badges) are deliberately left alone so semantic colors
 * survive theming.
 *
 * Run manually with `pnpm run theme:generate` when Bandcamp rebundles. The output is checked in,
 * so neither the build nor the extension ever touches the network.
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import puppeteer from 'puppeteer';

/** Pages whose stylesheet links are scraped. Add a URL here when a page type renders untheme. */
const SEED_PAGES = [
  'https://bandcamp.com/',
  'https://bandcamp.com/discover',
  'https://bandcamp.com/search?q=ambient',
  'https://daily.bandcamp.com/',
  'https://halfpastvibe.bandcamp.com/',
  'https://halfpastvibe.bandcamp.com/music',
  'https://halfpastvibe.bandcamp.com/album/stonks-market'
];

/** Hosts whose stylesheets are Bandcamp's own and therefore safe to theme. */
const STYLESHEET_HOSTS = ['bandcamp.com', 'bcbits.com'];

/** Bundles loaded only after client-side routing, which link-scraping cannot discover. */
const EXTRA_STYLESHEETS: string[] = [];

const OUTPUT_PATH = resolve(import.meta.dirname, '../css/theme.generated.css');

const THEMED_PROPERTIES = new Set([
  'color',
  'background',
  'background-color',
  'border',
  'border-color',
  'border-top',
  'border-bottom',
  'border-left',
  'border-right',
  'border-top-color',
  'border-bottom-color',
  'border-left-color',
  'border-right-color',
  'outline',
  'outline-color',
  'box-shadow',
  'text-shadow',
  'fill',
  'stroke'
]);

/** Bandcamp's accent cyan, in the spellings it actually appears in. */
const ACCENT_COLORS = new Set(['#1da0c3', '#00a1c6', '#0687f5', 'rgb(0,161,198)', 'rgb(0, 161, 198)']);

const HEX_PATTERN = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g;

/**
 * Bandcamp styles a handful of bare element types (`a`, `button`, `body`, `td`, `th`). Those
 * selectors also match BES's own UI, and because every override carries `!important` they beat
 * the component's own colors - which is how the drawer's FindMusic button ended up painting its
 * label in the same cyan as its background. BES owns everything under a `bes-`/`findmusic-`
 * class, so bare type selectors are told to skip that subtree.
 */
/*
 * Every generated rule targets Bandcamp's own markup, so all of them stand down when Bandcamp
 * has themed the page itself - src/theme.ts flags that with data-bes-native-dark. Double-theming
 * a page that is already dark is what put light text on light backgrounds across /discover.
 */
const THEME_SCOPE_SUFFIX = "[data-bes-theme='dark']:not([data-bes-native-dark])";
const THEME_SCOPE = `html${THEME_SCOPE_SUFFIX}`;

const BES_EXCLUSION = ":not([class*='bes-']):not([class*='findmusic-']):not(.bes-drawer *)";

/**
 * Links that Bandcamp styles as buttons carry their own background and label color. Scoping a
 * bare `a` rule under `html[data-bes-theme='dark']` raises its specificity above `.buttonLink`,
 * so without this it repaints their labels in the page accent - cyan text on Bandcamp's green
 * checkout button. Dropping `!important` would not help; the prefix alone is enough to win.
 */
const BUTTON_LIKE_EXCLUSION = ':not(.buttonLink):not(.g-button):not(.buy-link):not(.compound-button)';

const BARE_TYPE_SELECTOR = /^[a-zA-Z][a-zA-Z0-9]*(::?[a-z-]+(\([^)]*\))?)*$/;

/**
 * Translucent greys - `rgba(255,255,255,.5)` panels, `rgba(0,0,0,.1)` shadows - cannot be
 * expressed as a plain token swap, because the alpha has to survive. `color-mix` does it, but it
 * lands in Chrome 111 and the manifest still supports 93, so every such declaration is emitted
 * twice: the token-swapped legacy value first, then the color-mix version. Old browsers drop the
 * second as unparseable and keep a working (if untranslucent) result.
 */
const RGBA_PATTERN = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g;

/**
 * Bandcamp writes a fair number of colours as CSS keywords rather than hex - `#sidecart .item
 * .price { color: black }` is why the cart price was rendering black-on-black. Only the
 * greyscale keywords are listed: anything with a hue is left alone, exactly as for hex.
 */
const NAMED_GREYS: Record<string, string> = {
  white: '#ffffff',
  whitesmoke: '#f5f5f5',
  gainsboro: '#dcdcdc',
  lightgray: '#d3d3d3',
  lightgrey: '#d3d3d3',
  silver: '#c0c0c0',
  darkgray: '#a9a9a9',
  darkgrey: '#a9a9a9',
  gray: '#808080',
  grey: '#808080',
  dimgray: '#696969',
  dimgrey: '#696969',
  black: '#000000'
};

// Longest first so `lightgray` is not consumed as `gray`, and word-bounded so `white-space`
// and similar keywords are never touched.
const NAMED_PATTERN = new RegExp(
  `(?<![\\w-])(${Object.keys(NAMED_GREYS)
    .sort((a, b) => b.length - a.length)
    .join('|')})(?![\\w-])`,
  'gi'
);

/**
 * jQuery UI paints its surfaces with flat single-color PNG tiles layered over the background
 * color. Left in place they sit on top of the themed color and undo it, and because they carry
 * no detail they can simply be dropped.
 */
const FLAT_TILE_PATTERN = /\s*url\((['"]?)[^)]*\/ui-bg_[^)]*\1\)\s*/g;

interface Rule {
  selector: string;
  declarations: string;
  conditions: string[];
}

function expandHex(hex: string): [number, number, number] {
  const body = hex.slice(1);
  const full =
    body.length === 3
      ? body
          .split('')
          .map(c => c + c)
          .join('')
      : body;

  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

/** Near-greys count: Bandcamp has values like #3e3d44 that read as grey but are not exactly so. */
function isGrey(rgb: [number, number, number]): boolean {
  return Math.max(...rgb) - Math.min(...rgb) <= 16;
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Buckets a grey onto a theme token. Thresholds were chosen against Bandcamp's actual histogram
 * so that #fff/#f5f5f5/#eee/#ccc/#aaa/#666/#333/#000 each land on their intended token.
 */
function greyToToken(value: number): string {
  if (value >= 250) return 'surface-0';
  if (value >= 238) return 'surface-1';
  if (value >= 215) return 'surface-2';
  if (value >= 190) return 'border';
  if (value >= 140) return 'text-muted';
  if (value >= 95) return 'text-body';
  if (value >= 45) return 'text-strong';

  return 'text-max';
}

/**
 * Bandcamp is not uniformly light. Its footer, parts of Bandcamp Daily and various buttons are
 * dark slabs with light labels *in the light theme*, and a straight ramp inversion flips those
 * the wrong way - the slab goes bright and its label goes black-on-black.
 *
 * So the mapping is asymmetric: only change what would actually be wrong on a dark page.
 *   - text that is already light needs no help, so leave it
 *   - a background that is already dark needs no help, so leave it
 * Everything else - dark text, light backgrounds - still inverts as before.
 */
const ALREADY_LIGHT = 200;
const ALREADY_DARK = 80;

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

function needsMapping(property: string, hex: string): boolean {
  const rgb = expandHex(hex);
  if (!isGrey(rgb)) return true;

  const value = luminance(rgb);
  if (property === 'color' || property === 'fill' || property === 'stroke') return value < ALREADY_LIGHT;
  if (property === 'background' || property === 'background-color') return value > ALREADY_DARK;

  return true;
}

function mapColor(color: string): string | null {
  const normalized = color.toLowerCase();

  if (ACCENT_COLORS.has(normalized)) return 'var(--bes-accent)';

  if (!normalized.startsWith('#')) return null;

  const rgb = expandHex(normalized);
  if (!isGrey(rgb)) return null;

  return `var(--bes-${greyToToken(luminance(rgb))})`;
}

/**
 * Splits a stylesheet into flat rules, carrying the enclosing at-rule preludes along so a rule
 * inside `@media (max-width: 767px)` is re-emitted inside the same query.
 */
function parseRules(css: string): Rule[] {
  const rules: Rule[] = [];
  const conditions: string[] = [];
  let buffer = '';

  for (let i = 0; i < css.length; i += 1) {
    const char = css[i];

    if (char === '{') {
      const prelude = buffer.trim();
      buffer = '';

      if (prelude.startsWith('@')) {
        // Only conditional groups wrap rules; @font-face and friends are skipped wholesale.
        conditions.push(/^@(media|supports|layer|container)\b/.test(prelude) ? prelude : '');

        if (conditions[conditions.length - 1] === '') {
          i = skipBlock(css, i);
          conditions.pop();
        }

        continue;
      }

      const end = findBlockEnd(css, i);
      const body = css.slice(i + 1, end);

      // A nested block means this prelude was an unrecognised group; treat it as a container.
      if (body.includes('{')) {
        conditions.push('');
        continue;
      }

      rules.push({ selector: prelude, declarations: body, conditions: conditions.filter(Boolean).slice() });
      i = end;
      continue;
    }

    if (char === '}') {
      conditions.pop();
      buffer = '';
      continue;
    }

    buffer += char;
  }

  return rules;
}

function findBlockEnd(css: string, openIndex: number): number {
  let depth = 0;

  for (let i = openIndex; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return css.length;
}

function skipBlock(css: string, openIndex: number): number {
  return findBlockEnd(css, openIndex);
}

/**
 * Rewrites a declaration block, keeping only declarations where every color maps onto the ramp.
 * A mixed declaration (a gradient blending grey into a brand color) is dropped rather than
 * half-translated.
 */
/** Whether a translucent grey needs remapping, by the same asymmetric rule as opaque colours. */
function translucentNeedsMapping(property: string, r: string, g: string, b: string): boolean {
  const rgb: [number, number, number] = [Number(r), Number(g), Number(b)];
  if (!isGrey(rgb)) return false;

  return needsMapping(property, toHex(rgb));
}

/** Rewrites translucent greys as a color-mix of the matching token, preserving the alpha. */
function mapTranslucentGreys(property: string, value: string): string {
  return value.replace(RGBA_PATTERN, (whole, r, g, b, a) => {
    if (!translucentNeedsMapping(property, r, g, b)) return whole;

    const rgb: [number, number, number] = [Number(r), Number(g), Number(b)];
    const percent = Math.round(Number(a) * 1000) / 10;

    return `color-mix(in srgb, var(--bes-${greyToToken(luminance(rgb))}) ${percent}%, transparent)`;
  });
}

function hasTranslucentGrey(property: string, value: string): boolean {
  RGBA_PATTERN.lastIndex = 0;

  return [...value.matchAll(RGBA_PATTERN)].some(m => translucentNeedsMapping(property, m[1], m[2], m[3]));
}

/**
 * Classes Bandcamp paints with a solid brand colour (the green checkout buttons and friends).
 * Their labels sit on a background we deliberately leave unthemed, so inverting the label alone
 * would put dark text on green. Their `color` is left exactly as Bandcamp set it.
 */
const SOLID_BUTTON_CLASSES = ['buttonLink', 'g-button', 'buy-link', 'compound-button'];

function targetsSolidButton(selector: string): boolean {
  return SOLID_BUTTON_CLASSES.some(name => selector.includes(`.${name}`));
}

function themeDeclarations(declarations: string, selector: string): string[] {
  const themed: string[] = [];

  for (const declaration of declarations.split(';')) {
    const separator = declaration.indexOf(':');
    if (separator === -1) continue;

    const property = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim();

    if (!THEMED_PROPERTIES.has(property)) continue;
    if (value.includes('!important')) continue;
    if (property === 'color' && targetsSolidButton(selector)) continue;

    const colors = value.match(HEX_PATTERN);
    const translucent = hasTranslucentGrey(property, value);
    NAMED_PATTERN.lastIndex = 0;
    const named = NAMED_PATTERN.test(value);

    // A declaration earns an override if it carries any colour form we know how to map.
    if (!colors && !translucent && !named) continue;

    const mapped = (colors ?? []).map(mapColor);
    if (mapped.some(entry => entry === null)) continue;

    let index = 0;
    const base = value
      .replace(HEX_PATTERN, match => (needsMapping(property, match) ? (mapped[index++] as string) : (index++, match)))
      .replace(NAMED_PATTERN, keyword => {
        const hex = NAMED_GREYS[keyword.toLowerCase()];

        return needsMapping(property, hex) ? (mapColor(hex) as string) : keyword;
      })
      .replace(FLAT_TILE_PATTERN, ' ')
      .trim();

    // Nothing actually changed - every colour in this declaration was already fine for dark.
    if (base === value.replace(FLAT_TILE_PATTERN, ' ').trim() && !translucent) continue;

    themed.push(`${property}: ${base} !important`);

    if (translucent) themed.push(`${property}: ${mapTranslucentGreys(property, base)} !important`);
  }

  return themed;
}

/**
 * Scopes a selector to the dark theme. `html`-rooted selectors take the attribute directly so
 * specificity rises without inserting a descendant combinator that would never match.
 */
function scopeSelector(selector: string): string {
  return selector
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      if (part.startsWith('html')) return part.replace(/^html/, THEME_SCOPE);
      if (part.startsWith(':root')) return part.replace(/^:root/, `:root${THEME_SCOPE_SUFFIX}`);

      const scoped = BARE_TYPE_SELECTOR.test(part) ? `${part}${BES_EXCLUSION}${BUTTON_LIKE_EXCLUSION}` : part;

      return `${THEME_SCOPE} ${scoped}`;
    })
    .join(',\n');
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Re-nests a rule inside the at-rule preludes it was found under, indenting one level each. */
function wrapInConditions(selector: string, declarations: string[], conditions: string[]): string {
  const indent = (depth: number) => '  '.repeat(depth);
  const depth = conditions.length;

  const lines = [
    `${indent(depth)}${selector.split('\n').join(`\n${indent(depth)}`)} {`,
    ...declarations.map(declaration => `${indent(depth + 1)}${declaration};`),
    `${indent(depth)}}`
  ];

  return conditions.reduceRight(
    (inner, condition, index) => `${indent(index)}${condition} {\n${inner}\n${indent(index)}}`,
    lines.join('\n')
  );
}

/**
 * Collects stylesheet URLs from a real browser rather than by scraping markup.
 *
 * Fetching the HTML directly is not good enough: some Bandcamp URLs answer a bot check rather
 * than the page, so plain requests miss `search_desktop`, the Bandcamp Daily bundles and others
 * entirely, and can return a stale `global-*` hash. Reading `document.styleSheets` after the
 * page has actually rendered gets the same files a visitor loads, including any added by script.
 */
async function collectStylesheetUrls(): Promise<string[]> {
  const urls = new Set(EXTRA_STYLESHEETS);
  /*
   * A fresh headless browser gets served a bot check on some Bandcamp URLs, which silently costs
   * whole bundles - search_desktop, bandmember and the Bandcamp Daily files among them.
   * Presenting a normal desktop user agent gets most of them served. The search page is the
   * known exception - its check wants a real session, so search_desktop and bandmember are not
   * covered here and /search keeps a few unthemed greys. Attaching to an already-running Chrome
   * does get them, but puppeteer will not finish attaching to a browser that has an extension
   * service worker in it, so that route is not offered.
   */
  const browser = await puppeteer.launch({ headless: true });
  const USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/131.0.0.0 Safari/537.36';

  try {
    for (const url of SEED_PAGES) {
      const page = await browser.newPage();

      try {
        await page.setUserAgent(USER_AGENT);
        // Some of these are long-polling single-page apps that never go network-idle, so wait
        // for the document and then give late-added stylesheets a fixed moment to land.
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await new Promise(settle => setTimeout(settle, 4000));
        const found: string[] = await page.evaluate(`[...document.styleSheets].map(s => s.href).filter(Boolean)`);
        const kept = found.filter(href => STYLESHEET_HOSTS.some(host => new URL(href).hostname.endsWith(host)));
        kept.forEach(href => urls.add(href));
        console.log(`  ${url} -> ${kept.length} stylesheet(s)`);
      } catch (error: unknown) {
        console.warn(`  ! ${url} failed (${error}), skipping`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  return [...urls];
}

async function main(): Promise<void> {
  console.log('Collecting Bandcamp stylesheets...');
  const stylesheetUrls = await collectStylesheetUrls();

  if (stylesheetUrls.length === 0) throw new Error('No Bandcamp stylesheets found; check SEED_PAGES.');

  const blocks: string[] = [];
  const seen = new Set<string>();
  let ruleCount = 0;

  for (const url of stylesheetUrls) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);

    const css = stripComments(await response.text());

    for (const rule of parseRules(css)) {
      const themed = themeDeclarations(rule.declarations, rule.selector);
      if (themed.length === 0) continue;

      const scoped = scopeSelector(rule.selector);
      if (!scoped) continue;

      const wrapped = wrapInConditions(scoped, themed, rule.conditions);

      // Identical rules recur across bundles that share a base; emit each only once.
      if (seen.has(wrapped)) continue;
      seen.add(wrapped);

      blocks.push(wrapped);
      ruleCount += 1;
    }
  }

  const header = [
    '/*',
    ' * GENERATED FILE - DO NOT EDIT.',
    ' *',
    " * Produced by `pnpm run theme:generate` (scripts/generate-theme.ts) from Bandcamp's own",
    ' * stylesheets. Every rule below is a Bandcamp rule whose colors sat entirely on its',
    ' * greyscale ramp, re-expressed against the --bes-* theme tokens defined in css/theme.css.',
    ' *',
    ' * Hand-authored overrides belong in css/theme.css, which loads alongside this file.',
    ' */',
    ''
  ].join('\n');

  writeFileSync(OUTPUT_PATH, `${header}\n${blocks.join('\n\n')}\n`);
  console.log(`Wrote ${ruleCount} rules from ${stylesheetUrls.length} stylesheet(s) to ${OUTPUT_PATH}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
