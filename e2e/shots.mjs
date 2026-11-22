// Visual review screenshots. Usage: PW=<playwright> node e2e/shots.mjs <outdir>
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PW);
const OUT = process.argv[2], BASE = process.env.BASE || 'http://localhost:4180/';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function shoot(vp, lang, hash, file, act) {
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: 1 });
  await p.addInitScript((l) => localStorage.setItem('lang', l), lang);
  await p.goto(BASE + hash); await p.waitForFunction(() => document.querySelector('#panel h1') && performance.getEntriesByName('map-ready').length, null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(3200);
  if (act) await act(p);
  await p.screenshot({ path: `${OUT}/${file}.png` }); await p.close();
}
const D = { width: 1440, height: 900 }, P = { width: 390, height: 844 };
await shoot(D, 'en', '#/', 'd-map');
await shoot(D, 'en', '#/', 'd-map-pick', async (p) => { await p.fill('#q', 'pokhara'); await p.keyboard.press('Enter'); await p.waitForTimeout(1800); });
await shoot(D, 'en', '#/glof', 'd-glof', async (p) => { await p.selectOption('#lake', 'imja'); await p.click('#run'); await p.waitForSelector('#out tbody tr'); await p.waitForTimeout(2200); await p.click('#play'); await p.$eval('#tslider', (s) => { s.value = s.max * 0.12; s.dispatchEvent(new Event('input')); }); await p.waitForTimeout(600); });
await shoot(D, 'en', '#/quake', 'd-quake', async (p) => { await p.waitForTimeout(1500); });
await shoot(D, 'en', '#/quake', 'd-quake-wave', async (p) => { await p.click('#go'); await p.waitForTimeout(900); });
await shoot(D, 'ne', '#/data', 'd-data-ne');
await shoot(P, 'en', '#/', 'p-map');
await shoot(P, 'ne', '#/', 'p-map-ne');
await shoot(P, 'en', '#/glof', 'p-glof', async (p) => { await p.click('#run'); await p.waitForSelector('#out tbody tr'); await p.waitForTimeout(3500); });
await shoot(P, 'en', '#/about', 'p-about');
await b.close();
