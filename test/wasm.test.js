import { it, expect } from 'vitest';
import fs from 'node:fs';
import { loadRoute } from './load-route.js';
import { loadWasm } from '../src/scenario-wasm.js';
import { tracePath, glof, shakingGrid } from '../src/scenario.js';
import { LAKES } from '../src/lakes.js';
import { VIEW } from '../src/grid.js';

it('WASM matches the JS oracle', async () => {
  const w = await loadWasm(fs.readFileSync('public/wasm/scenario.wasm')), route = await loadRoute();
  w.setRoute(route);
  for (const l of [...LAKES.map((x) => ({ ...x, vol: x.vol || [5, 20] })), { ll: [85.5, 28.3], vol: [5, 20] }]) {
    const a = glof(tracePath(route, ...l.ll), l.vol), b = w.glof(...l.ll, l.vol);
    expect(b.length).toBe(a.length);
    for (let k = 0; k < a.length; k += 7) for (const f of ['arrivalH', 'peak', 'depth', 'll']) for (const q of [0, 1]) expect(b[k][f][q]).toBeCloseTo(a[k][f][q], 6);
  }
  for (const q of [{ M: 7.8, ll: [84.73, 28.23], strike: 295 }, { M: 6, ll: [87, 27], strike: 10 }]) {
    const a = shakingGrid(q, VIEW), b = w.shakingGrid(q, VIEW);
    let md = 0; for (let k = 0; k < a.length; k++) md = Math.max(md, Math.abs(a[k] - b[k]));
    expect(md).toBeLessThan(1e-4);
  }
});
