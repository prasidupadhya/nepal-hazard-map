// End-to-end checks: every route × language at phone width; search; scenarios; print.
// Usage: node e2e/check.mjs [baseURL]  (serve dist first: npx vite preview --port 4173)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const BASE = process.argv[2] || 'http://localhost:4173/';
const SHOTS = process.env.SHOTS || '';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const fails = []; const ok = (c, m) => { if (!c) fails.push(m); console.log(c ? 'PASS' : 'FAIL', m); };
for (const lang of ['en', 'ne']) for (const width of [360, 1280]) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 740 : 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.addInitScript((l) => localStorage.setItem('lang', l), lang);
  for (const r of ['', 'data', 'data/quakes', 'glof', 'quake', 'about']) {
    await page.goto(BASE + '#/' + r); await page.waitForFunction(() => !document.querySelector('#panel').textContent.includes('Loading') && !document.querySelector('#panel').textContent.includes('लोड हुँदैछ') && document.querySelector('#panel h1'), null, { timeout: 30000 });
    await page.waitForTimeout(r === 'quake' ? 1500 : 400);
    const tag = `[${lang} ${width}px #/${r}]`;
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, disc: getComputedStyle(document.querySelector('.disclaimer')).display !== 'none' && document.querySelector('.disclaimer').getBoundingClientRect().height > 10, lang: document.documentElement.lang, text: document.body.innerText }));
    ok(m.sw <= m.cw, `${tag} no horizontal scroll (${m.sw} ≤ ${m.cw})`);
    ok(m.disc, `${tag} disclaimer visible`);
    ok(m.lang === lang, `${tag} html lang=${lang}`);
    if (lang === 'ne') ok(/[ऀ-ॿ]{3}/.test(m.text) && !/\b(Loading|Result|Assumptions|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec|AM|PM)\b/.test(m.text), `${tag} Nepali text present, no untranslated UI labels`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${lang}-${width}-${r.replace('/', '_') || 'map'}.png` });
  }
  ok(errs.length === 0, `[${lang} ${width}px] no console errors ${errs.slice(0, 3).join(' | ')}`);
  await ctx.close();
}
// functional: search + GLOF + quake + print
const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } }); const page = await ctx.newPage();
await page.goto(BASE + '#/'); await page.waitForSelector('#panel .feeds', { timeout: 30000 });
await page.fill('#q', 'pokh'); const first = await page.textContent('#results li'); ok(/Pokhara/.test(first), `search "pokh" → ${first}`);
await page.fill('#q', 'काठमाडौं'); const ne = await page.textContent('#results li'); ok(/Kathmandu/.test(ne), `Nepali search → ${ne}`);
// tapping the map picks real ground (projection is offset beside the sheet on desktop)
{ const d = await browser.newPage({ viewport: { width: 1280, height: 800 } }); await d.goto(BASE + '#/glof'); await d.waitForFunction(() => performance.getEntriesByName('map-ready').length); await d.waitForTimeout(2500);
  await d.mouse.click(300, 450); await d.waitForTimeout(300);
  const v = await d.$eval('#lake', (s) => s.value); ok(v === 'custom', `desktop map tap sets a custom start point (${v})`); await d.close(); }
await page.goto(BASE + '#/glof'); await page.waitForSelector('#run'); await page.click('#run');
await page.waitForSelector('#out table tbody tr', { timeout: 30000 });
const rows = await page.$$eval('#out tbody tr', (t) => t.map((r) => r.innerText));
ok(rows.length >= 3 && rows.some((r) => /Plains|plains/.test(r)), `GLOF table has ${rows.length} rows ending at plains`);
ok(rows.every((r) => /–/.test(r)), 'every GLOF row shows ranges');
await page.emulateMedia({ media: 'print' });
const pv = await page.evaluate(() => ({ stage: getComputedStyle(document.querySelector('#stage')).display, nav: getComputedStyle(document.querySelector('#nav')).display, po: getComputedStyle(document.querySelector('.print-only')).display, disc: getComputedStyle(document.querySelector('.disclaimer')).display }));
ok(pv.stage === 'none' && pv.nav === 'none' && pv.po === 'block' && pv.disc !== 'none', `print view hides map/nav, shows report + disclaimer ${JSON.stringify(pv)}`);
await page.pdf({ path: (SHOTS || '/tmp') + '/glof-print.pdf', format: 'A4' }); await page.emulateMedia({ media: 'screen' });
await page.goto(BASE + '#/quake'); await page.waitForSelector('#out tbody tr', { timeout: 30000 });
const q = await page.$$eval('#out tbody tr', (t) => t.map((r) => r.innerText));
ok(q.length === 77, `quake table lists all 77 districts (${q.length})`);
ok(q.every((r) => /[IVX]+\s*–\s*[IVX]+/.test(r)), 'every district shows a shaking band');
const ktm = q.find((r) => r.startsWith('Kathmandu')); ok(!!ktm, `Kathmandu row: ${ktm?.replace(/\s+/g, ' ')}`);
// every archived record must be reachable through "Load older", newest first
for (const tab of ['incidents', 'quakes']) {
  await page.goto(BASE + '#/data/' + tab); await page.waitForSelector('#rows li');
  while (await page.$('#more button')) { await page.click('#more button'); await page.waitForFunction(() => document.querySelector('#more button') || /No older/.test(document.querySelector('#more').textContent)); }
  const want = await page.evaluate(async (tab) => { const ix = await (await fetch('data/archive/index.json')).json(); const ids = new Set(); for (const m of Object.keys(ix.months)) for (const x of (await (await fetch('data/archive/' + m + '.json')).json())[tab]) ids.add(x.id); return ids.size; }, tab);
  const got = await page.$$eval('#rows li', (l) => l.length);
  ok(got === want, `all archived ${tab} reachable via Load older (${got}/${want})`);
}
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS'); process.exit(fails.length ? 1 : 0);
