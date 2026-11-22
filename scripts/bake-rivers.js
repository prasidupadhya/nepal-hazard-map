// River network + glacial-lake flood paths, from the same D8 flow grid the flood model uses.
// Output public/terrain/rivers.json:
//   lines: [startCell, "D8 codes", catchment km²]   one polyline per river reach (codes '1'..'8')
//   lakes: { id: [startCell, "D8 codes"] }          flood path of each ICIMOD lake down to the plains
// Run: node scripts/bake-rivers.js   (needs test/fixtures/route-full.png from bake-terrain.js)
import fs from 'node:fs';
import sharp from 'sharp';
import { ROUTE, D8, BOX } from '../src/grid.js';
import { PLAINS_M } from '../src/scenario.js';

const MIN_KM2 = 250, CELL_KM2 = 0.25; // 0.005° cells ≈ 0.5 × 0.5 km
const { nx, ny } = ROUTE, N = nx * ny;
const { data } = await sharp('test/fixtures/route-full.png').raw().toBuffer({ resolveWithObject: true });
const dir = new Uint8Array(N), elev = new Int16Array(N);
for (let k = 0; k < N; k++) { elev[k] = (data[3 * k] << 8) | data[3 * k + 1]; dir[k] = data[3 * k + 2]; }
const down = new Int32Array(N).fill(-1), indeg = new Int32Array(N);
for (let k = 0; k < N; k++) {
  if (!dir[k]) continue;
  const [dx, dy] = D8[dir[k] - 1], i = (k % nx) + dx, j = ((k / nx) | 0) + dy;
  if (i >= 0 && j >= 0 && i < nx && j < ny) { down[k] = j * nx + i; indeg[down[k]]++; }
}
// catchment (cells draining through each cell), in topological order
const acc = new Float64Array(N).fill(1), q = [];
for (let k = 0; k < N; k++) if (!indeg[k]) q.push(k);
for (let h = 0; h < q.length; h++) { const k = q[h], d = down[k]; if (d >= 0) { acc[d] += acc[k]; if (--indeg[d] === 0) q.push(d); } }
if (q.length !== N) throw new Error('flow grid has a cycle');

const isStream = (k) => acc[k] * CELL_KM2 >= MIN_KM2 && elev[k] >= PLAINS_M;
const feeds = new Uint8Array(N); // a stream cell that some upstream stream cell flows into
for (let k = 0; k < N; k++) if (isStream(k) && down[k] >= 0) feeds[down[k]] = 1;
const used = new Uint8Array(N), lines = [];
// walk from every head; a reach ends where it joins an already-walked reach (junction kept, so lines connect)
const heads = []; for (let k = 0; k < N; k++) if (isStream(k) && !feeds[k]) heads.push(k);
heads.sort((a, b) => acc[b] - acc[a]);
const codeTo = (a, b) => { const dx = (b % nx) - (a % nx), dy = ((b / nx) | 0) - ((a / nx) | 0); return D8.findIndex(([x, y]) => x === dx && y === dy) + 1; };
for (const h of heads) {
  let k = h, codes = ''; used[k] = 1;
  while (down[k] >= 0 && isStream(down[k])) { const d = down[k]; codes += codeTo(k, d); if (used[d]) break; used[d] = 1; k = d; }
  if (codes.length) lines.push([h, codes, Math.round(acc[k] * CELL_KM2)]);
}
const lakes = {};
for (const l of JSON.parse(fs.readFileSync('scripts/data/pdgl-icimod-2020.json')).lakes) {
  let k = Math.floor((BOX.n - l.ll[1]) / ROUTE.step) * nx + Math.floor((l.ll[0] - BOX.w) / ROUTE.step), codes = '';
  const start = k;
  while (down[k] >= 0 && elev[k] >= PLAINS_M) { codes += dir[k]; k = down[k]; }
  lakes[l.id] = [start, codes];
}
fs.writeFileSync('public/terrain/rivers.json', JSON.stringify({ minKm2: MIN_KM2, lines, lakes }));
const cells = lines.reduce((s, l) => s + l[1].length, 0);
console.log({ reaches: lines.length, cells, kb: (fs.statSync('public/terrain/rivers.json').size / 1024).toFixed(0) });
