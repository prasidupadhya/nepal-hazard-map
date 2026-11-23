// River network + glacial-lake flood paths, from the same D8 flow grid the flood model uses.
// Output public/terrain/rivers.json (catchment ≥ 250 km²) and rivers-small.json (25–250 km², loaded when zoomed in):
//   lines: [startCell, "D8 codes", catchment km²]   one polyline per river reach (codes '1'..'8'), plains included
//   lakes: { id: [startCell, "D8 codes"] }          where each ICIMOD lake's water goes, to the Nepal border (rivers.json only)
// Run: node scripts/bake-rivers.js   (needs test/fixtures/route-full.png from bake-terrain.js)
import fs from 'node:fs';
import sharp from 'sharp';
import { ROUTE, D8, BOX, kmPerDegLon, KM_PER_DEG_LAT } from '../src/grid.js';

const cellKm2 = (k) => ROUTE.step * KM_PER_DEG_LAT * ROUTE.step * kmPerDegLon(BOX.n - (Math.floor(k / ROUTE.nx) + 0.5) * ROUTE.step);
const { nx, ny } = ROUTE, N = nx * ny;
const { data } = await sharp('test/fixtures/route-full.png').raw().toBuffer({ resolveWithObject: true });
const dir = new Uint8Array(N), elev = new Int16Array(N);
const nepal = new Uint8Array(N), near = new Uint8Array(N); // NEPAL_BIT in the blue channel (see bake-terrain.js)
for (let k = 0; k < N; k++) { elev[k] = (data[3 * k] << 8) | data[3 * k + 1]; dir[k] = data[3 * k + 2] & 15; nepal[k] = data[3 * k + 2] & 16 ? 1 : 0; near[k] = data[3 * k + 2] & 32 ? 1 : 0; }
const down = new Int32Array(N).fill(-1), indeg = new Int32Array(N);
for (let k = 0; k < N; k++) {
  if (!dir[k]) continue;
  const [dx, dy] = D8[dir[k] - 1], i = (k % nx) + dx, j = ((k / nx) | 0) + dy;
  if (i >= 0 && j >= 0 && i < nx && j < ny) { down[k] = j * nx + i; indeg[down[k]]++; }
}
// catchment (cells draining through each cell), in topological order
const acc = new Float64Array(N), q = []; for (let k = 0; k < N; k++) acc[k] = cellKm2(k); // km² draining through each cell
for (let k = 0; k < N; k++) if (!indeg[k]) q.push(k);
for (let h = 0; h < q.length; h++) { const k = q[h], d = down[k]; if (d >= 0) { acc[d] += acc[k]; if (--indeg[d] === 0) q.push(d); } }
if (q.length !== N) throw new Error('flow grid has a cycle');

const codeTo = (a, b) => { const dx = (b % nx) - (a % nx), dy = ((b / nx) | 0) - ((a / nx) | 0); return D8.findIndex(([x, y]) => x === dx && y === dy) + 1; };
// Reaches of the network with catchment in [lo, hi): walk from each head until joining a reach already walked
// (the junction is kept so lines connect) or leaving the map.
function network(lo, hi, used) {
  const isStream = (k) => acc[k] >= lo && acc[k] < hi, feeds = new Uint8Array(N), lines = [];
  for (let k = 0; k < N; k++) if (isStream(k) && down[k] >= 0 && isStream(down[k])) feeds[down[k]] = 1;
  const heads = []; for (let k = 0; k < N; k++) if (isStream(k) && !feeds[k]) heads.push(k);
  heads.sort((a, b) => acc[b] - acc[a]);
  for (const h of heads) {
    if (used[h]) continue;
    let k = h, codes = ''; used[k] = 1;
    while (down[k] >= 0 && acc[down[k]] >= lo) { const d = down[k]; codes += codeTo(k, d); if (used[d]) break; used[d] = 1; k = d; }
    if (codes.length) lines.push([h, codes, Math.round(acc[k])]);
  }
  return lines;
}
const used = new Uint8Array(N);
const big = network(250, Infinity, used), small = network(25, 250, used);
const lakes = {};
for (const l of JSON.parse(fs.readFileSync('scripts/data/pdgl-icimod-2020.json')).lakes) {
  let k = Math.floor((BOX.n - l.ll[1]) / ROUTE.step) * nx + Math.floor((l.ll[0] - BOX.w) / ROUTE.step), codes = '';
  const start = k;
  // same rule as tracePath: until the water leaves Nepal (more than 6 cells outside after entering), trimmed to the border
  let entered = false, out = 0; const cells = [k];
  while (down[k] >= 0) {
    if (nepal[k]) { entered = true; out = 0; } else if ((entered && ++out > 6) || (!near[k] && elev[k] < 400)) break;
    codes += dir[k]; k = down[k]; cells.push(k);
  }
  if (entered) while (codes.length && !nepal[cells[codes.length]]) codes = codes.slice(0, -1);
  lakes[l.id] = [start, codes];
}
fs.writeFileSync('public/terrain/rivers.json', JSON.stringify({ minKm2: 250, lines: big, lakes }));
fs.writeFileSync('public/terrain/rivers-small.json', JSON.stringify({ minKm2: 25, lines: small }));
const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0);
console.log({ big: big.length, small: small.length, cellsBig: big.reduce((s, l) => s + l[1].length, 0), cellsSmall: small.reduce((s, l) => s + l[1].length, 0), kbBig: kb('public/terrain/rivers.json'), kbSmall: kb('public/terrain/rivers-small.json') });
