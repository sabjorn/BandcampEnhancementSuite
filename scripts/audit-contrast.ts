/**
 * Audits a live Bandcamp page for dark-mode contrast problems.
 *
 * Hunting these by eye is slow and misses things - a label the same colour as its background is
 * invisible rather than obviously wrong. This walks the rendered page and reports two things:
 *
 *   1. text failing WCAG AA against its effective background (4.5:1, or 3:1 for large text)
 *   2. elements still painting a light background, which flags an unthemed area even where the
 *      text on it happens to be readable
 *
 * Needs the remote-debugging Chrome with the extension loaded - see the project memory on
 * extension debugging. Usage:
 *
 *   pnpm run theme:audit https://bandcamp.com/search?q=techno https://daily.bandcamp.com/
 *
 * A finding is not automatically ours. Bandcamp's newer pages do their own dark mode and have
 * their own contrast bugs; before chasing one, re-run with the theme switched off and compare. If
 * the count is unchanged, it is Bandcamp's.
 */
const BROWSER_URL = process.env.BES_BROWSER_URL ?? 'http://127.0.0.1:9222';

interface Finding {
  where: string;
  text?: string;
  color?: string;
  bg: string;
  ratio?: number;
  need?: number;
  lum?: number;
}

interface PageReport {
  url: string;
  theme: string | null;
  nativeDark: string | null;
  textFails: Finding[];
  brightAreas: Finding[];
  totals: { text: number; bright: number };
}

/** Runs in the page: everything below this line is evaluated in the browser. */
const AUDIT_SCRIPT = String.raw`(() => {
  const parse = c => {
    const m = String(c).match(/[\d.]+/g);
    if (!m) return null;
    let v = m.map(Number);
    if (String(c).startsWith('color(')) v = v.map((x, i) => (i < 3 ? x * 255 : x));
    return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 };
  };
  const over = (f, b) => ({
    r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a),
    b: f.b * f.a + b.b * (1 - f.a), a: 1
  });
  const lum = c => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const visible = el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    // Off-screen label text, e.g. the visually hidden caption on .bes-toggle.
    if (parseFloat(cs.textIndent) < -999) return false;
    if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath === 'inset(50%)') return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  // Walks up for the first opaque background, compositing any translucent layers on the way.
  const effBg = el => {
    let cur = el, acc = null;
    while (cur) {
      const cs = getComputedStyle(cur);
      const c = parse(cs.backgroundColor);
      // Text over an image cannot be judged from colours alone, so it is skipped.
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return { img: true, ...(acc || { r: 128, g: 128, b: 128, a: 1 }) };
      if (c && c.a > 0) { acc = acc ? over(acc, c) : c; if (c.a >= 1) return acc; }
      cur = cur.parentElement;
    }
    return acc || { r: 255, g: 255, b: 255, a: 1 };
  };
  const path = el => {
    const bits = [];
    let c = el;
    for (let i = 0; i < 3 && c && c.tagName; i++) {
      bits.unshift(c.tagName.toLowerCase() + (c.id ? '#' + c.id : '') +
        (typeof c.className === 'string' && c.className ? '.' + c.className.trim().split(/\s+/).slice(0, 2).join('.') : ''));
      c = c.parentElement;
    }
    return bits.join(' > ').slice(0, 90);
  };

  const textFails = [], brightAreas = [], seenText = new Set(), seenBright = new Set();
  document.querySelectorAll('*').forEach(el => {
    // The drawer is BES's own surface and is audited separately.
    if (el.closest('.bes-drawer')) return;
    if (!visible(el)) return;
    const cs = getComputedStyle(el);

    const own = parse(cs.backgroundColor);
    if (own && own.a > 0.5 && lum(own) > 0.5) {
      const k = path(el);
      if (!seenBright.has(k)) { seenBright.add(k); brightAreas.push({ where: k, bg: cs.backgroundColor, lum: +lum(own).toFixed(2) }); }
    }

    const direct = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim())
      .map(n => n.textContent.trim()).join(' ');
    if (!direct) return;
    const bg = effBg(el);
    if (bg.img) return;
    let fg = parse(cs.color);
    if (!fg) return;
    if (fg.a < 1) fg = over(fg, bg);
    const cr = ratio(fg, bg);
    const size = parseFloat(cs.fontSize);
    const need = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700) ? 3 : 4.5;
    if (cr < need) {
      const k = path(el);
      if (!seenText.has(k)) {
        seenText.add(k);
        textFails.push({
          where: k, text: direct.slice(0, 30), color: cs.color,
          bg: 'rgb(' + [bg.r, bg.g, bg.b].map(Math.round).join(',') + ')',
          ratio: +cr.toFixed(2), need
        });
      }
    }
  });

  return JSON.stringify({
    url: location.href,
    theme: document.documentElement.getAttribute('data-bes-theme'),
    nativeDark: document.documentElement.getAttribute('data-bes-native-dark'),
    textFails: textFails.sort((a, b) => a.ratio - b.ratio).slice(0, 25),
    brightAreas: brightAreas.slice(0, 15),
    totals: { text: textFails.length, bright: brightAreas.length }
  });
})()`;

async function cdp(target: { webSocketDebuggerUrl: string }) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map<number, (value: any) => void>();
  let id = 0;

  ws.addEventListener('message', event => {
    const message = JSON.parse((event as MessageEvent).data as string);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)!(message);
      pending.delete(message.id);
    }
  });
  await new Promise(resolve => ws.addEventListener('open', resolve));

  const send = (method: string, params?: unknown) =>
    new Promise<any>(resolve => {
      const messageId = ++id;
      pending.set(messageId, resolve);
      ws.send(JSON.stringify({ id: messageId, method, params }));
    });

  return { send, close: () => ws.close() };
}

async function main(): Promise<void> {
  const urls = process.argv.slice(2);
  if (urls.length === 0) throw new Error('Pass one or more Bandcamp URLs to audit.');

  const targets = await (await fetch(`${BROWSER_URL}/json/list`)).json();
  const page = targets.find((t: any) => t.type === 'page' && t.url.includes('bandcamp.com'));
  if (!page) throw new Error(`No Bandcamp tab open in the browser at ${BROWSER_URL}.`);

  const { send, close } = await cdp(page);
  await send('Page.enable');

  let failing = 0;

  for (const url of urls) {
    await send('Page.navigate', { url });
    // No reliable "settled" signal on these pages; give scripts a moment to render.
    await new Promise(resolve => setTimeout(resolve, 8000));

    const result = await send('Runtime.evaluate', { expression: AUDIT_SCRIPT, returnByValue: true });
    const report: PageReport = JSON.parse(result.result?.result?.value ?? '{}');

    const native = report.nativeDark ? ' (Bandcamp themes this page itself)' : '';
    console.log(`\n=== ${report.url}  [${report.theme}]${native}`);
    console.log(`    text failures: ${report.totals.text}   bright areas: ${report.totals.bright}`);
    report.textFails.forEach(f =>
      console.log(
        `      ${String(f.ratio).padStart(5)} (need ${f.need})  ${JSON.stringify(f.text)}\n` +
          `            ${f.color} on ${f.bg}   ${f.where}`
      )
    );
    report.brightAreas.forEach(b => console.log(`      BRIGHT lum ${b.lum}  ${b.bg}  ${b.where}`));

    failing += report.totals.text + report.totals.bright;
  }

  close();
  console.log(`\n${failing === 0 ? 'No findings.' : `${failing} finding(s) across ${urls.length} page(s).`}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
