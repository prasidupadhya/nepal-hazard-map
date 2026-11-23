// Zoom smoothness on a mid-range phone profile (4× CPU, slow 4G, 390×844 @2×, touch):
// zoom in from the overview to a close-up, wait, zoom back out; record frame gaps and main-thread long tasks.
// Usage: PW=<playwright> node bench/zoom.mjs <label> [runs]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const LABEL = process.argv[2] || 'run', RUNS = +(process.argv[3] || 3), BASE = process.env.BASE || 'http://localhost:4181/';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const all = { gaps: [], long: [], longMax: [] };
for (let r = 0; r < RUNS; r++) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p);
  await p.addInitScript(() => { window.__lt = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))).observe({ type: 'longtask', buffered: true }); });
  await p.goto(BASE + '#/'); await p.waitForFunction(() => document.querySelector('canvas.labels')?.dataset.drawn, null, { timeout: 60000 }); await p.waitForTimeout(3000);
  await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1638.4 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.evaluate(() => { window.__lt.length = 0; window.__gaps = []; let last = performance.now(); const f = (t) => { window.__gaps.push(t - last); last = t; if (!window.__stop) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await p.mouse.move(195, 300);
  for (let i = 0; i < 14; i++) { await p.mouse.wheel(0, -250); await p.waitForTimeout(120); }  // zoom in
  await p.waitForTimeout(6000);                                                                // tiles arrive
  for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, -200); await p.waitForTimeout(120); }   // closer: next tile level
  await p.waitForTimeout(6000);
  for (let i = 0; i < 20; i++) { await p.mouse.wheel(0, 300); await p.waitForTimeout(120); }   // zoom back out
  await p.waitForTimeout(3000);
  const m = await p.evaluate(() => { window.__stop = true; return { gaps: window.__gaps, long: window.__lt.slice() }; });
  all.gaps.push(...m.gaps); all.long.push(m.long.reduce((a, x) => a + x, 0)); all.longMax.push(Math.max(0, ...m.long));
  await ctx.close();
}
await b.close();
const s = [...all.gaps].sort((a, c) => a - c), pc = (q) => s[Math.min(s.length - 1, Math.floor(s.length * q))].toFixed(0);
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)];
const out = { label: LABEL, frameP50: +pc(0.5), frameP95: +pc(0.95), frameMax: +s.at(-1).toFixed(0), longTaskTotalMs: Math.round(med(all.long)), longestTaskMs: Math.round(med(all.longMax)) };
fs.mkdirSync('bench/results', { recursive: true }); fs.writeFileSync(`bench/results/zoom-${LABEL}.json`, JSON.stringify(out));
console.log(out);
