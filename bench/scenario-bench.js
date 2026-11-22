// JS vs WASM for the scenario maths (Node/V8). Usage: node bench/scenario-bench.js
import fs from 'node:fs';
import { loadRoute } from '../test/load-route.js';
import { loadWasm } from '../src/scenario-wasm.js';
import { tracePath, glof, shakingGrid } from '../src/scenario.js';
import { VIEW } from '../src/grid.js';
const route = await loadRoute();
const t0 = performance.now(); const w = await loadWasm(fs.readFileSync('public/wasm/scenario.wasm')); w.setRoute(route); const tLoad = performance.now() - t0;
const q = { M: 7.8, ll: [84.73, 28.23], strike: 295 }, lake = [86.477, 27.866], vol = [75, 100];
function med(f, n = 30) { for (let i = 0; i < 5; i++) f(); const t = []; for (let i = 0; i < n; i++) { const a = performance.now(); f(); t.push(performance.now() - a); } t.sort((a, b) => a - b); return t[n >> 1]; }
const r = {
  'quake grid 421×213 — JS': med(() => shakingGrid(q, VIEW)),
  'quake grid 421×213 — WASM': med(() => w.shakingGrid(q, VIEW)),
  'GLOF trace+hydraulics — JS': med(() => glof(tracePath(route, ...lake), vol)),
  'GLOF trace+hydraulics — WASM': med(() => w.glof(...lake, vol)),
  'WASM instantiate + copy route (once)': tLoad,
};
for (const [k, v] of Object.entries(r)) console.log(k.padEnd(40), v.toFixed(2), 'ms');
