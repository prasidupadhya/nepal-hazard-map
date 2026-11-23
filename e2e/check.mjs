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
// map: rivers only by default, labels drawn in both languages, tapping a river traces it downstream
for (const [lang, want] of [['en', 'Kathmandu'], ['ne', 'काठमाडौ']]) {
  const d = await browser.newPage({ viewport: { width: 1280, height: 800 } }); await d.addInitScript((l) => localStorage.setItem('lang', l), lang);
  await d.goto(BASE + '#/'); await d.waitForFunction(() => document.querySelector('canvas.labels')?.dataset.drawn, null, { timeout: 40000 });
  const drawn = await d.$eval('canvas.labels', (c) => c.dataset.drawn);
  ok(drawn.includes(want), `[${lang}] map labels include ${want}`);
  if (lang === 'en') {
    const on = await d.$$eval('#chips [aria-pressed="true"]', (b) => b.map((x) => x.dataset.l));
    ok(on.length === 1 && on[0] === 'network', `only the river layer is on by default (${on})`);
    await d.waitForTimeout(1500); let traced = false;
    for (const [x, y] of [[520, 470], [600, 430], [450, 520], [700, 420], [380, 560], [640, 500]]) { await d.mouse.click(x, y); await d.waitForTimeout(800); if (await d.$('#sel .callout h3')) { traced = true; break; } }
    await d.waitForTimeout(1500);
    const txt = traced ? await d.$eval('#sel', (e) => e.innerText) : '';
    ok(traced && /Followed for/.test(txt) && /Dangerous glacial lakes upstream/.test(txt), 'tapping the map opens a downstream trace');
  }
  await d.close();
}
// lake burst: 47 ICIMOD lakes; tapping bare ground does not create a lake; unknown volume asks for one
{ const d = await browser.newPage({ viewport: { width: 1280, height: 800 } }); await d.goto(BASE + '#/glof'); await d.waitForFunction(() => performance.getEntriesByName('map-ready').length); await d.waitForTimeout(2500);
  ok((await d.$$eval('#lake option', (o) => o.length)) === 47, '47 lakes to choose from');
  const before = await d.$eval('#lake', (s) => s.value); await d.mouse.click(300, 450); await d.waitForTimeout(300);
  ok((await d.$eval('#lake', (s) => s.value)) === before && /lake circles/.test(await d.$eval('#hint', (h) => h.textContent)), 'a tap on bare ground keeps the lake and shows a hint');
  await d.selectOption('#lake', 'GL087945E27781N'); // unsurveyed lake: volume estimated from its satellite-measured area
  ok(+(await d.$eval('#v0', (i) => i.value)) > 0 && /satellite/.test(await d.$eval('#volnote', (n) => n.textContent)), 'an unsurveyed lake comes with a volume range from its measured area');
  await d.fill('#v0', ''); await d.fill('#v1', ''); await d.click('#run');
  ok(/Enter how much water/.test(await d.$eval('#volnote', (n) => n.textContent)), 'running with the volume cleared asks for one');
  await d.close(); }
await page.goto(BASE + '#/glof'); await page.waitForSelector('#run'); await page.click('#run');
await page.waitForSelector('#out table tbody tr', { timeout: 30000 });
const rows = await page.$$eval('#out tbody tr', (t) => t.map((r) => r.innerText));
ok(rows.length >= 3 && /Nepal border/.test(rows.at(-1)), `GLOF table has ${rows.length} rows ending at the Nepal border`);
ok(rows.every((r) => /–/.test(r)), 'every GLOF row shows ranges');
await page.evaluate(() => { window.print = () => (window.__printed = 1); }); await page.waitForTimeout(1500);
await page.click('#pr'); await page.waitForFunction(() => window.__printed, null, { timeout: 30000 });
await page.emulateMedia({ media: 'print' });
const pv = await page.evaluate(() => { const d = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).display : 'missing'; }, img = document.querySelector('.report img.shot');
  return { stage: d('#stage'), nav: d('#nav'), report: d('.report'), warn: d('.rp-warn'), warnText: document.querySelector('.rp-warn')?.textContent.includes('Not an official warning'), figs: document.querySelectorAll('.rp-figs > div').length, chart: d('.rp-chart'), map: !!img && img.naturalWidth >= 1800 }; });
ok(pv.stage === 'none' && pv.nav === 'none' && pv.report === 'block' && pv.warn !== 'none' && pv.warnText && pv.figs === 4 && pv.chart !== 'none' && pv.map, `print report: no screen map/nav; warning, 4 key figures, chart and a drawn print map ${JSON.stringify(pv)}`);
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
  const got = await page.$$eval('#rows li', (l) => l.reduce((n, x) => n + (+x.dataset.n || 1), 0)); // merged duplicate reports count each record
  ok(got === want, `all archived ${tab} reachable via Load older (${got}/${want})`);
}
// iPhone-like: touch only, and canvas read-backs carry noise as with Safari's fingerprinting protection
// (on by default since Safari 26). Routing must not depend on canvas pixels; taps must reach the map.
{ const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { const wrap = (P) => { if (!P) return; const g = P.prototype.getImageData; P.prototype.getImageData = function (...a) { const d = g.apply(this, a); for (let i = 0; i < d.data.length; i += 4) if (Math.random() < 0.1) d.data[i + ((Math.random() * 3) | 0)] ^= 1; return d; }; }; wrap(window.CanvasRenderingContext2D); wrap(window.OffscreenCanvasRenderingContext2D); });
  const p = await ctx.newPage();
  await p.goto(BASE + '#/glof'); await p.waitForFunction(() => performance.getEntriesByName('map-ready').length, null, { timeout: 90000 });
  await p.waitForSelector('#run'); await p.tap('#run'); await p.waitForSelector('#out tbody tr', { timeout: 30000 });
  const last = await p.$eval('#out tbody tr:last-child', (r) => r.innerText.replace(/\s+/g, ' '));
  ok(/Nepal border \* 348 km/.test(last), `phone + canvas noise: lake burst reaches the border at the right distance (${last.slice(0, 40)})`);
  await p.tap('#nav a[data-v="map"]'); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => scrollY === 0), 'switching tab from a scrolled page brings the map back into view');
  const box = await p.locator('#gl').boundingBox(); let txt = '';
  for (const [fx, fy] of [[0.55, 0.45], [0.4, 0.6], [0.6, 0.35]]) { await p.touchscreen.tap(box.x + box.width * fx, box.y + box.height * fy); await p.waitForTimeout(1500); txt = await p.$eval('#sel', (e) => e.innerText).catch(() => ''); if (/Followed for/.test(txt)) break; }
  const km = +((txt.replace(/\n+/g, ' ').match(/Followed for ([\d,]+) km/) || [])[1] || '0').replace(/,/g, '');
  ok(km > 5 && km < 900, `phone + canvas noise: a finger tap traces the river to the border (${km} km)`);
  ok(await p.$eval('#sel', (e) => e.getBoundingClientRect().top < innerHeight - 120), 'the trace details open in view, right under the map');
  await ctx.close(); }
// offline: after one visit the site opens with no connection, shows the saved data and says it is offline;
// a lake looked at before still runs (its river tiles were saved)
{ const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '#/glof'); await p.waitForFunction(() => performance.getEntriesByName('map-ready').length, null, { timeout: 90000 });
  await p.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready.then(() => location.reload()), null, { timeout: 30000 }).catch(() => {});
  await p.reload(); await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
  await p.waitForSelector('#run'); await p.tap('#run'); await p.waitForSelector('#out tbody tr', { timeout: 30000 });
  await ctx.setOffline(true);
  await p.goto(BASE + '#/'); await p.reload();
  const opened = await p.waitForFunction(() => performance.getEntriesByName('map-ready').length, null, { timeout: 60000 }).then(() => true, () => false);
  ok(opened, 'offline: the site opens from the saved copy and draws the 3D map');
  ok(await p.$eval('#offline', (e) => !e.hidden && /offline/i.test(e.textContent)), 'offline: a notice says it is offline');
  ok(/River levels/.test(await p.$eval('#panel', (e) => e.innerText)), 'offline: the saved data and its age are shown');
  await p.goto(BASE + '#/glof'); await p.waitForSelector('#run'); await p.tap('#run');
  const ran = await p.waitForSelector('#out tbody tr', { timeout: 30000 }).then(() => true, () => false);
  ok(ran && /Nepal border/.test(await p.$eval('#out tbody tr:last-child', (r) => r.innerText)), 'offline: a lake run before still runs');
  ok(!errs.length, 'offline: no script errors ' + JSON.stringify(errs.slice(0, 2)));
  await ctx.close(); }
// failure cases: no WebGL (old phones, locked-down browsers) and data that fails to load
{ const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); }; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '#/glof'); await p.waitForSelector('#run'); await p.tap('#run');
  const rows = await p.waitForSelector('#out tbody tr', { timeout: 30000 }).then(() => p.$$eval('#out tbody tr', (r) => r.length), () => 0);
  ok(rows > 3 && /WebGL/.test(await p.$eval('#stage', (e) => e.innerText)) && !errs.length, `no WebGL: the map says why, the lake burst still runs (${rows} rows), no errors ${JSON.stringify(errs.slice(0, 1))}`);
  await ctx.close(); }
{ const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('**/data/latest.json', (r) => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '#/'); const shown = await p.waitForSelector('#retry', { timeout: 20000 }).then(() => true, () => false);
  ok(shown && !errs.length, 'data fails to load: a clear message and a "Try again" button, no errors');
  await ctx.close(); }
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS'); process.exit(fails.length ? 1 : 0);
