// Screening-level "what if" maths. Every output is a range; assumptions are listed
// in ASSUMPTIONS and shown on the page. Not a forecast or an official warning.
import { BOX, ROUTE, D8, kmPerDegLon, KM_PER_DEG_LAT, cellLL } from './grid.js';

export const ASSUMPTIONS = {
  glof: {
    peakLow: 'Evans (1986): Qp = 0.72·V^0.53',
    peakHigh: 'Huggel et al. (2002): Qp = 0.00077·V^1.017 (upper envelope)',
    manningN: [0.04, 0.08], widthCoef: [2.5, 5], attenuationKm: [40, 150], maxCelerity: 15, minSlope: 0.0005,
  },
  quake: {
    model: 'Atkinson & Wald (2007) intensity equation, California coefficients',
    rupture: 'Wells & Coppersmith (1994) surface rupture length, all slip types; centred on the epicentre along strike',
    spread: 1,
  },
};

// ---------- glacial lake outburst ----------
export const peakEvans = (vM3) => 0.72 * vM3 ** 0.53;
export const peakHuggel = (vM3) => 0.00077 * vM3 ** 1.017;

// Follow D8 flow directions from the lake cell down to the plains. Below PLAINS_M
// the ground is too flat for a ~500 m grid to say where water goes, so we stop.
export const PLAINS_M = 120;
export function tracePath(route, lon, lat, maxSteps = 4000) {
  const { nx, ny, dir, elev } = route;
  let i = Math.floor((lon - BOX.w) / ROUTE.step), j = Math.floor((BOX.n - lat) / ROUTE.step);
  const pts = []; let km = 0;
  for (let s = 0; s < maxSteps && i >= 0 && j >= 0 && i < nx && j < ny; s++) {
    const k = j * nx + i, [lo, la] = cellLL(ROUTE, i, j);
    if (pts.length) { const p = pts.at(-1); km += Math.hypot((lo - p.ll[0]) * kmPerDegLon(la), (la - p.ll[1]) * KM_PER_DEG_LAT); }
    pts.push({ ll: [lo, la], km, z: elev[k] });
    const d = dir[k]; if (!d || elev[k] < PLAINS_M) break;
    i += D8[d - 1][0]; j += D8[d - 1][1];
  }
  return pts;
}

// Kinematic wave on a wide channel: Q = B·h·v, v = h^(2/3)·S^(1/2)/n, B = a·Q^0.5, c = 5/3·v.
const hydraulics = (Q, n, a, S) => {
  const B = a * Math.sqrt(Q), h = ((Q * n) / (B * Math.sqrt(S))) ** 0.6, v = Q / (B * h);
  return { h, c: Math.min(ASSUMPTIONS.glof.maxCelerity, (5 / 3) * v) };
};

export function glof(path, volMm3, opt = ASSUMPTIONS.glof) {
  const [nLo, nHi] = opt.manningN, [aLo, aHi] = opt.widthCoef, [LLo, LHi] = opt.attenuationKm;
  const QpLo = peakEvans(volMm3[0] * 1e6), QpHi = peakHuggel(volMm3[1] * 1e6);
  const out = []; let tFast = 0, tSlow = 0;
  for (let k = 0; k < path.length; k++) {
    const p = path[k];
    // slope over a ±1 km window (DEM noise); floor keeps flat Terai reaches finite
    let a = k, b = k; while (a > 0 && p.km - path[a].km < 1) a--; while (b < path.length - 1 && path[b].km - p.km < 1) b++;
    const S = Math.max(opt.minSlope, (path[a].z - path[b].z) / Math.max(0.25, (path[b].km - path[a].km) * 1000));
    const qLo = QpLo * Math.exp(-p.km / LLo), qHi = QpHi * Math.exp(-p.km / LHi);
    const fast = hydraulics(qHi, nLo, aLo, S), slow = hydraulics(qLo, nHi, aHi, S);
    if (k) { const dx = (p.km - path[k - 1].km) * 1000; tFast += dx / fast.c; tSlow += dx / slow.c; }
    out.push({ km: p.km, ll: p.ll, z: p.z, arrivalH: [tFast / 3600, tSlow / 3600], peak: [qLo, qHi],
      depth: [hydraulics(qLo, nLo, aHi, S).h, hydraulics(qHi, nHi, aLo, S).h] });
  }
  return out;
}

// ---------- earthquake shaking ----------
export const ruptureKm = (M) => 10 ** (-2.44 + 0.59 * M);
// Atkinson & Wald (2007), California: R = sqrt(D² + 14²), B = max(0, log10(R/50)).
export function mmiAW07(M, Dkm) {
  const R = Math.sqrt(Dkm * Dkm + 196), lR = Math.log10(R), B = Math.max(0, Math.log10(R / 50));
  return 12.27 + 2.27 * (M - 6) + 0.1304 * (M - 6) ** 2 - 1.3 * lR - 0.000707 * R + 1.95 * B - 0.577 * M * lR;
}
// distance (km) from a point to the surface trace of the rupture (local flat projection)
export function faultDistKm(q, lon, lat) {
  const kx = kmPerDegLon(q.ll[1]), x = (lon - q.ll[0]) * kx, y = (lat - q.ll[1]) * KM_PER_DEG_LAT;
  const th = (q.strike * Math.PI) / 180, ux = Math.sin(th), uy = Math.cos(th), half = ruptureKm(q.M) / 2;
  const t = Math.max(-half, Math.min(half, x * ux + y * uy));
  return Math.hypot(x - t * ux, y - t * uy);
}
const clampMMI = (m) => Math.max(1, Math.min(10, m));
export function shakingAt(q, lon, lat) {
  const m = mmiAW07(q.M, faultDistKm(q, lon, lat)), s = ASSUMPTIONS.quake.spread;
  return [clampMMI(m - s), clampMMI(m), clampMMI(m + s)];
}
// Mean MMI for every node of a lon/lat grid (Float32Array, row 0 = north).
export function shakingGrid(q, g) {
  const out = new Float32Array(g.nx * g.ny);
  for (let j = 0; j < g.ny; j++) { const lat = BOX.n - (j + 0.5) * g.step; for (let i = 0; i < g.nx; i++) out[j * g.nx + i] = clampMMI(mmiAW07(q.M, faultDistKm(q, BOX.w + (i + 0.5) * g.step, lat))); }
  return out;
}
export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
