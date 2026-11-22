import { describe, it, expect, beforeAll } from 'vitest';
import { loadRoute } from './load-route.js';
import { tracePath, glof, shakingAt, shakingGrid, mmiAW07, ruptureKm, peakEvans, peakHuggel, faultDistKm } from '../src/scenario.js';
import { LAKES } from '../src/lakes.js';
import { VIEW } from '../src/grid.js';

let route; beforeAll(async () => { route = await loadRoute(); });
const passesNear = (path, lon, lat, km) => path.some((p) => Math.hypot((p.ll[0] - lon) * 98, (p.ll[1] - lat) * 111) < km);

describe('flow routing follows real rivers (known answers)', () => {
  it('Imja → Dudh Koshi past Lukla → Koshi out of Nepal', () => {
    const p = tracePath(route, ...LAKES.find((l) => l.en === 'Imja Tsho').ll);
    expect(passesNear(p, 86.71, 27.69, 3)).toBe(true);      // Phakding/Lukla reach
    expect(Math.hypot((p.at(-1).ll[0] - 87.16) * 98, (p.at(-1).ll[1] - 26.82) * 111)).toBeLessThan(5); // stops at Chatara (plains)
  });
  it('Thulagi → Marsyangdi (Besisahar) → Narayani', () => {
    const p = tracePath(route, ...LAKES.find((l) => l.en === 'Thulagi').ll);
    expect(passesNear(p, 84.41, 28.23, 3)).toBe(true);
    expect(passesNear(p, 84.43, 27.69, 3)).toBe(true);      // Narayani at Narayanghat
    expect(Math.hypot((p.at(-1).ll[0] - 83.93) * 98, (p.at(-1).ll[1] - 27.45) * 111)).toBeLessThan(5); // stops at Tribeni
  });
  it('paths only go downhill overall and are monotonic in distance', () => {
    for (const l of LAKES) {
      const p = tracePath(route, ...l.ll);
      expect(p.at(-1).z).toBeLessThan(120); expect(p[0].z).toBeGreaterThan(3500);
      for (let k = 1; k < p.length; k++) expect(p[k].km).toBeGreaterThan(p[k - 1].km);
    }
  });
});

describe('GLOF ranges', () => {
  it('peak formulas match hand calculation (Dig Tsho 1985, 5 Mm³)', () => {
    expect(peakEvans(5e6)).toBeCloseTo(0.72 * Math.exp(0.53 * Math.log(5e6)), 6);
    expect(peakEvans(5e6)).toBeGreaterThan(2000); expect(peakEvans(5e6)).toBeLessThan(3000); // observed ~2000–2350 m³/s
    expect(peakHuggel(5e6)).toBeGreaterThan(peakEvans(5e6));
  });
  it('earliest ≤ latest, arrival grows downstream, ranges well-formed', () => {
    for (const l of LAKES) {
      const g = glof(tracePath(route, ...l.ll), l.vol || [5, 20]);
      for (let k = 0; k < g.length; k++) {
        const x = g[k];
        expect(x.arrivalH[0]).toBeLessThanOrEqual(x.arrivalH[1]);
        expect(x.peak[0]).toBeLessThanOrEqual(x.peak[1]);
        expect(x.depth[0]).toBeLessThanOrEqual(x.depth[1]);
        if (k) { expect(x.arrivalH[0]).toBeGreaterThanOrEqual(g[k - 1].arrivalH[0]); expect(x.arrivalH[1]).toBeGreaterThanOrEqual(g[k - 1].arrivalH[1]); }
      }
      // front never faster than the 15 m/s cap
      const last = g.at(-1); expect(last.arrivalH[0] * 3600 * 15).toBeGreaterThanOrEqual(last.km * 1000 - 1);
    }
  });
  it('bigger lake → earlier arrival and higher peak', () => {
    const p = tracePath(route, ...LAKES.find((l) => l.en === 'Tsho Rolpa').ll), s = glof(p, [10, 20]).at(-1), b = glof(p, [80, 100]).at(-1);
    expect(b.arrivalH[0]).toBeLessThan(s.arrivalH[0]); expect(b.peak[1]).toBeGreaterThan(s.peak[1]);
  });
});

describe('earthquake shaking bands', () => {
  const gorkha = { M: 7.8, ll: [84.731, 28.231], strike: 295 };
  it('Gorkha 2015 known answers: Kathmandu band contains observed VII–VIII', () => {
    const [lo, , hi] = shakingAt(gorkha, 85.32, 27.71);
    expect(lo).toBeLessThanOrEqual(7.5); expect(hi).toBeGreaterThanOrEqual(7.5);
  });
  it('AW07 hand check and rupture length', () => {
    const R = Math.sqrt(80 * 80 + 196);
    const hand = 12.27 + 2.27 * 1.8 + 0.1304 * 3.24 - 1.3 * Math.log10(R) - 0.000707 * R + 1.95 * Math.log10(R / 50) - 0.577 * 7.8 * Math.log10(R);
    expect(mmiAW07(7.8, 80)).toBeCloseTo(hand, 10);
    expect(ruptureKm(7.8)).toBeGreaterThan(130); expect(ruptureKm(7.8)).toBeLessThan(160); // Gorkha rupture ~150 km
  });
  it('shaking weakens with distance; along-strike points closer than across', () => {
    let prev = 99; for (const d of [0, 10, 30, 60, 100, 200, 400]) { const m = mmiAW07(7, d); expect(m).toBeLessThan(prev); prev = m; }
    const q = { M: 7, ll: [85, 28], strike: 90 };
    expect(faultDistKm(q, 85.2, 28)).toBeCloseTo(0, 6);          // on the trace
    expect(faultDistKm(q, 85, 28.2)).toBeCloseTo(22.264, 2);       // 0.2° north
  });
  it('grid matches pointwise oracle', () => {
    const q = { M: 7, ll: [85.3, 27.7], strike: 290 }, g = shakingGrid(q, VIEW);
    for (const [i, j] of [[0, 0], [210, 100], [420, 212], [77, 150]]) {
      const lon = 79.9 + (i + 0.5) * VIEW.step, lat = 30.5 - (j + 0.5) * VIEW.step;
      expect(g[j * VIEW.nx + i]).toBeCloseTo(shakingAt(q, lon, lat)[1], 4);
    }
  });
});
