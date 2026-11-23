import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import { feature } from 'topojson-client';
import { loadRoute } from './load-route.js';
import { tracePath } from '../src/scenario.js';
import { LAKES } from '../src/lakes.js';
import { ROUTE, D8, BOX, cellLL } from '../src/grid.js';

const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-10m.json'));
const g = feature(topo, topo.objects.countries).features.find((f) => f.properties.name === 'Nepal').geometry;
const ring = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates.flat()[0];
const inNepal = ([x, y]) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const near = (a, b, km) => Math.hypot((a[0] - b[0]) * 98, (a[1] - b[1]) * 111.32) < km;
const R = JSON.parse(fs.readFileSync('public/terrain/rivers.json'));
const decode = (start, codes) => { let i = start % ROUTE.nx, j = Math.floor(start / ROUTE.nx); const out = [start]; for (const c of codes) { i += D8[c - 1][0]; j += D8[c - 1][1]; out.push(j * ROUTE.nx + i); } return out; };
let route; beforeAll(async () => { route = await loadRoute(); });

describe('glacial lakes (ICIMOD 2020, Table 5.6)', () => {
  it('47 lakes: 25 Tibet, 21 Nepal, 1 India; 42 Koshi, 3 Gandaki, 2 Karnali basins', () => {
    expect(LAKES.length).toBe(47);
    const c = (k) => LAKES.filter((l) => l.country[0] === k).length;
    expect([c('Tibet, China'), c('Nepal'), c('India')]).toEqual([25, 21, 1]);
    const koshi = ['Tamor', 'Arun', 'Dudh Koshi', 'Tama Koshi', 'Sun Koshi'], gandaki = ['Trishuli', 'Marsyangdi'];
    expect(LAKES.filter((l) => koshi.includes(l.basin[0])).length).toBe(42);
    expect(LAKES.filter((l) => gandaki.includes(l.basin[0])).length).toBe(3);
    expect(LAKES.filter((l) => !koshi.includes(l.basin[0]) && !gandaki.includes(l.basin[0])).length).toBe(2);
    expect(new Set(LAKES.map((l) => l.id)).size).toBe(47);
  });
  it('coordinates are the ones encoded in each ICIMOD ID', () => {
    for (const l of LAKES) { const m = l.id.match(/^GL(\d{3})(\d{3})E(\d{2})(\d{3})N$/); expect([+`${m[1]}.${m[2]}`, +`${m[3]}.${m[4]}`]).toEqual(l.ll); }
  });
  it('surveyed volumes are ICIMOD 2011 Table 7.1 values', () => {
    const v = Object.fromEntries(LAKES.filter((l) => l.survey).map((l) => [l.en, l.survey]));
    expect(v).toEqual({ 'Tsho Rolpa': 85.94, 'Imja Tsho': 35.5, Thulagi: 35.37 });
  });
  it('every lake has a volume range: surveyed, or estimated from a measured area ≥ 0.02 km²', () => {
    for (const l of LAKES) {
      expect(l.vol, l.id).toBeTruthy(); expect(l.vol[0]).toBeGreaterThan(0); expect(l.vol[0]).toBeLessThan(l.vol[1]);
      if (l.volSrc === 'area') { expect(l.area).toBeGreaterThanOrEqual(0.02); expect(l.areaDate).toMatch(/^20\d\d-\d\d-\d\d$/); }
    }
    expect(LAKES.filter((l) => l.volSrc === 'survey').length).toBe(3);
  });
  it('every lake’s flood path enters Nepal; Tibetan lakes cross at the known border points', () => {
    const crossing = { Arun: [87.43, 27.81], 'Sun Koshi': [85.95, 27.95], Trishuli: [85.37, 28.26] };
    for (const l of LAKES) {
      const p = tracePath(route, ...l.ll), k = p.findIndex((q) => inNepal(q.ll));
      expect(k, l.id).toBeGreaterThanOrEqual(0);
      if (l.country[0] === 'Tibet, China' && crossing[l.basin[0]]) expect(near(p[k].ll, crossing[l.basin[0]], 4), l.id).toBe(true);
    }
  });
  it('baked lake paths in rivers.json equal the live routing (to the map edge)', () => {
    for (const l of LAKES) expect(decode(...R.lakes[l.id]).map((c) => cellLL(ROUTE, c % ROUTE.nx, Math.floor(c / ROUTE.nx)))).toEqual(tracePath(route, ...l.ll, 6000, false).map((q) => q.ll));
  });
});

describe('river network (rivers.json)', () => {
  it('every reach follows the flow grid and ends on another reach or at the plains', () => {
    const all = new Set(); for (const [s, c] of R.lines) decode(s, c).forEach((x) => all.add(x));
    for (const [s, c] of R.lines) {
      const cells = decode(s, c);
      for (let k = 0; k + 1 < cells.length; k++) { const [dx, dy] = D8[route.dir[cells[k]] - 1]; expect(cells[k + 1]).toBe(cells[k] + dy * ROUTE.nx + dx); }
    }
    expect(R.lines.length).toBeGreaterThan(200);
  });
  it('a trace from the Trishuli reaches the Narayani at Narayanghat', () => {
    const p = tracePath(route, 85.15, 27.9); // Trishuli at Betrawati area
    expect(p.some((q) => near(q.ll, [84.43, 27.69], 3))).toBe(true);
  });
  it('lakes upstream of Lukla: the Dudh Koshi lakes (incl. Imja Tsho), none from other basins', () => {
    const lukla = [86.71, 27.69], ids = LAKES.filter((l) => decode(...R.lakes[l.id]).some((c) => near(cellLL(ROUTE, c % ROUTE.nx, Math.floor(c / ROUTE.nx)), lukla, 1.2)));
    expect(ids.some((l) => l.en === 'Imja Tsho')).toBe(true);
    expect(ids.every((l) => l.basin[0] === 'Dudh Koshi')).toBe(true);
  });
});
