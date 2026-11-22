// Mid-range phone benchmark (Lighthouse "mobile" profile: 4× CPU slowdown, slow 4G 150 ms RTT 1.6 Mbps).
// Usage: node bench/serve.mjs 4180 & ; PW=<playwright> node bench/perf.mjs <label> [runs]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const LABEL = process.argv[2] || 'run', RUNS = +(process.argv[3] || 5), BASE = process.env.BASE || 'http://localhost:4180/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(), cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1638.4 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const bytes = { total: 0, js: 0, byUrl: {} };
  cdp.on('Network.responseReceived', (e) => (bytes.byUrl[e.requestId] = e.response.url));
  cdp.on('Network.loadingFinished', (e) => { bytes.total += e.encodedDataLength; if (/\.js($|\?)/.test(bytes.byUrl[e.requestId] || '')) bytes.js += e.encodedDataLength; });
  await page.addInitScript(() => {
    window.__lt = []; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch {}
    window.__frames = (ms) => new Promise((res) => { const d = []; let last = performance.now(); const end = last + ms; const f = (t) => { d.push(t - last); last = t; t < end ? requestAnimationFrame(f) : res(d); }; requestAnimationFrame(f); });
    window.__mark = (name, after, timeout = 60000) => new Promise((res) => { const t0 = performance.now(); const c = () => { const m = performance.getEntriesByName(name).filter((e) => e.startTime >= after).pop(); if (m) return requestAnimationFrame(() => requestAnimationFrame(() => res(m.startTime - after))); if (performance.now() - t0 > timeout) return res(null); setTimeout(c, 10); }; c(); });
  });
  return { ctx, page, cdp, bytes };
}

const R = { startup: [], screens: {}, content: {}, scroll: {}, frames: {} };
const push = (o, k, v) => ((o[k] ??= []).push(v));
for (let run = 0; run < RUNS; run++) {
  const { ctx, page, bytes } = await newPage();
  // A. cold startup
  await page.goto(BASE + '#/', { waitUntil: 'commit' });
  const s = await page.evaluate(async () => {
    const view = await window.__mark('view:map', 0), map = await window.__mark('map-ready', 0);
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null;
    const tbt = window.__lt.filter(([st]) => st < map).reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
    return { fcp, content: view, map, tbt };
  });
  await page.waitForTimeout(500);
  R.startup.push({ ...s, kb: bytes.total / 1024, jsKb: bytes.js / 1024 });
  // E1. 3D map: drag-orbit frame times
  const fr = page.evaluate(() => window.__frames(2000));
  for (let i = 0; i < 20; i++) { await page.mouse.move(150 + i * 6, 300 + (i % 5) * 4); if (!i) await page.mouse.down(); }
  await page.mouse.up(); push(R.frames, 'map drag', await fr);
  // B. screen open (warm) + C. content
  for (const v of ['data', 'glof', 'quake', 'about', 'map']) {
    const ms = await page.evaluate(async (v) => { const t0 = performance.now(); location.hash = '#/' + (v === 'map' ? '' : v); return window.__mark('view:' + v, t0); }, v);
    push(R.screens, v, ms);
    if (v === 'glof') {
      const g = await page.evaluate(async () => { const t0 = performance.now(); document.getElementById('run').click(); return window.__mark('glof-result', t0); });
      push(R.content, 'GLOF result (cold route grid)', g);
      push(R.frames, 'GLOF animation', await page.evaluate(() => window.__frames(2500)));
    }
    if (v === 'quake') {
      push(R.content, 'quake first shaking', await page.evaluate(() => window.__mark('quake-shaking', performance.getEntriesByName('view:quake').pop().startTime)));
      push(R.frames, 'quake animation', await page.evaluate(() => { document.getElementById('go').click(); return window.__frames(2500); }));
      // slider drag: recompute 421×213 grid each step
      const sl = await page.evaluate(async () => { const M = document.getElementById('M'), d = []; for (let i = 0; i < 10; i++) { const t0 = performance.now(); M.value = 6 + i * 0.2; M.dispatchEvent(new Event('input')); await window.__mark('quake-shaking', t0); d.push(performance.now() - t0); } return d; });
      push(R.content, 'quake slider step', med(sl));
    }
  }
  // C/D. data lists, older content, scrolling
  for (const tab of ['rain', 'incidents']) {
    const ms = await page.evaluate(async (tab) => { const t0 = performance.now(); location.hash = '#/data/' + tab; return window.__mark('view:data', t0); }, tab);
    push(R.content, `data list open (${tab})`, ms);
    if (tab === 'incidents') {
      for (let i = 0; i < 3; i++) {
        const o = await page.evaluate(async () => { const n0 = document.querySelectorAll('#rows li').length, t0 = performance.now(); document.querySelector('#more button')?.click();
          while (document.querySelectorAll('#rows li').length === n0 && performance.now() - t0 < 30000) await new Promise((r) => setTimeout(r, 5));
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return [performance.now() - t0, document.querySelectorAll('#rows li').length]; });
        push(R.content, `load older #${i + 1}`, o[0]); push(R.content, `rows after older #${i + 1}`, o[1]);
      }
    }
    await page.mouse.move(195, 500);
    const f = page.evaluate(() => window.__frames(3000));
    for (let i = 0; i < 30; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(60); }
    push(R.scroll, tab, await f);
  }
  await ctx.close();
}
await browser.close();

const fs1 = (a) => { const all = a.flat(); return { p50: +pct(all, 0.5).toFixed(1), p95: +pct(all, 0.95).toFixed(1), jank: +(100 * all.filter((x) => x > 33.4).length / all.length).toFixed(1) }; };
const out = {
  label: LABEL, runs: RUNS,
  startup: Object.fromEntries(['fcp', 'content', 'map', 'tbt', 'kb', 'jsKb'].map((k) => [k, +med(R.startup.map((x) => x[k])).toFixed(0)])),
  screens: Object.fromEntries(Object.entries(R.screens).map(([k, v]) => [k, +med(v).toFixed(0)])),
  content: Object.fromEntries(Object.entries(R.content).map(([k, v]) => [k, +med(v).toFixed(0)])),
  scroll: Object.fromEntries(Object.entries(R.scroll).map(([k, v]) => [k, fs1(v)])),
  frames: Object.fromEntries(Object.entries(R.frames).map(([k, v]) => [k, fs1(v)])),
};
fs.mkdirSync('bench/results', { recursive: true });
fs.writeFileSync(`bench/results/${LABEL}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
