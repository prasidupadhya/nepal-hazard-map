// First open of each scenario screen straight from a freshly loaded map (shader compile, wasm, tiles).
// Usage: PW=<playwright> node bench/first-open.mjs <label> [runs]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const LABEL = process.argv[2] || 'run', RUNS = +(process.argv[3] || 5), BASE = process.env.BASE || 'http://localhost:4180/';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = { quake: [], glof: [], 'map return (from data)': [] };
for (let i = 0; i < RUNS; i++) for (const v of ['quake', 'glof', 'map return (from data)']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p);
  await p.goto(BASE + '#/'); await p.waitForFunction(() => performance.getEntriesByName('map-ready').length); await p.waitForTimeout(2500);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  if (v.startsWith('map')) { await p.evaluate(() => (location.hash = '#/data')); await p.waitForTimeout(800); }
  const key = v.startsWith('map') ? 'map' : v;
  out[v].push(await p.evaluate(async (key) => {
    const t0 = performance.now(); location.hash = key === 'map' ? '#/' : '#/' + key;
    await new Promise((r) => { const c = () => (performance.getEntriesByName('view:' + key).some((e) => e.startTime > t0) ? r() : setTimeout(c, 2)); c(); });
    if (key === 'quake') await new Promise((r) => { const c = () => (performance.getEntriesByName('quake-shaking').some((e) => e.startTime > t0) ? r() : setTimeout(c, 2)); c(); });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))); // first rendered frame presented
    return performance.now() - t0;
  }, key));
  await ctx.close();
}
await b.close();
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)];
const res = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.round(med(v))]));
fs.writeFileSync(`bench/results/first-open-${LABEL}.json`, JSON.stringify(res));
console.log(LABEL, res);
