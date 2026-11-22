// One-off: build public/terrain/* from open Terrarium elevation tiles (AWS Open Data,
// derived from SRTM and other public DEMs). Run: NODE_USE_ENV_PROXY=1 node scripts/bake-terrain.js
import fs from 'node:fs';
import sharp from 'sharp';
import { feature } from 'topojson-client';
import { BOX, ROUTE, VIEW, D8, kmPerDegLon, KM_PER_DEG_LAT } from '../src/grid.js';

const Z = 8, CACHE = '.cache/tiles/', OUT = 'public/terrain/';
fs.mkdirSync(CACHE, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
const tx = (lon) => ((lon + 180) / 360) * 2 ** Z;
const ty = (lat) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** Z; };

// 1. tiles → bilinear sampler in tile-pixel space
const x0 = Math.floor(tx(BOX.w)), x1 = Math.floor(tx(BOX.e)), y0 = Math.floor(ty(BOX.n)), y1 = Math.floor(ty(BOX.s));
const TW = (x1 - x0 + 1) * 256, TH = (y1 - y0 + 1) * 256, dem = new Float32Array(TW * TH);
for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
  const f = `${CACHE}${Z}-${x}-${y}.png`;
  if (!fs.existsSync(f)) {
    const r = await fetch(`https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${Z}/${x}/${y}.png`);
    if (!r.ok) throw new Error(`tile ${x},${y}: ${r.status}`);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let py = 0; py < 256; py++) for (let px = 0; px < 256; px++) {
    const k = (py * 256 + px) * info.channels;
    dem[((y - y0) * 256 + py) * TW + (x - x0) * 256 + px] = data[k] * 256 + data[k + 1] + data[k + 2] / 256 - 32768;
  }
}
const sample = (lon, lat) => {
  const fx = (tx(lon) - x0) * 256 - 0.5, fy = (ty(lat) - y0) * 256 - 0.5;
  const ix = Math.max(0, Math.min(TW - 2, Math.floor(fx))), iy = Math.max(0, Math.min(TH - 2, Math.floor(fy)));
  const ax = fx - ix, ay = fy - iy, k = iy * TW + ix;
  return (dem[k] * (1 - ax) + dem[k + 1] * ax) * (1 - ay) + (dem[k + TW] * (1 - ax) + dem[k + TW + 1] * ax) * ay;
};
const grid = (g) => {
  const a = new Float32Array(g.nx * g.ny);
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) a[j * g.nx + i] = Math.max(0, sample(BOX.w + (i + 0.5) * g.step, BOX.n - (j + 0.5) * g.step));
  return a;
};

// 2. routing grid: priority-flood pit filling (Barnes et al. 2014, with epsilon) + D8
const { nx, ny } = ROUTE, N = nx * ny, z = grid(ROUTE), filled = Float32Array.from(z), done = new Uint8Array(N);
class Heap { // binary min-heap on filled elevation
  constructor() { this.a = []; }
  push(i) { const a = this.a; a.push(i); let c = a.length - 1; while (c) { const p = (c - 1) >> 1; if (filled[a[p]] <= filled[a[c]]) break; [a[p], a[c]] = [a[c], a[p]]; c = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let p = 0; for (;;) { const l = 2 * p + 1, r = l + 1; let m = p; if (l < a.length && filled[a[l]] < filled[a[m]]) m = l; if (r < a.length && filled[a[r]] < filled[a[m]]) m = r; if (m === p) break; [a[p], a[m]] = [a[m], a[p]]; p = m; } } return top; }
}
const h = new Heap();
for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (!i || !j || i === nx - 1 || j === ny - 1) { done[j * nx + i] = 1; h.push(j * nx + i); }
while (h.a.length) {
  const c = h.pop(), ci = c % nx, cj = (c / nx) | 0;
  for (const [dx, dy] of D8) {
    const i = ci + dx, j = cj + dy; if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
    const n = j * nx + i; if (done[n]) continue;
    done[n] = 1; filled[n] = Math.max(filled[n], filled[c] + 1e-3); h.push(n);
  }
}
const dir = new Uint8Array(N);
for (let j = 1; j < ny - 1; j++) {
  const kx = kmPerDegLon(BOX.n - (j + 0.5) * ROUTE.step) * ROUTE.step, ky = KM_PER_DEG_LAT * ROUTE.step;
  for (let i = 1; i < nx - 1; i++) {
    const c = j * nx + i; let best = 0, bs = 0;
    D8.forEach(([dx, dy], d) => { const s = (filled[c] - filled[c + dy * nx + dx]) / Math.hypot(dx * kx, dy * ky); if (s > bs) { bs = s; best = d + 1; } });
    dir[c] = best;
  }
}
// flow accumulation (cells draining through each cell), processed high → low
const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => filled[b] - filled[a]);
const acc = new Float32Array(N).fill(1);
for (const c of order) if (dir[c]) { const [dx, dy] = D8[dir[c] - 1]; acc[c + dy * nx + dx] += acc[c]; }
// route.png: R,G = raw elevation (m), B = D8 code. Raw (not filled) elevation keeps lake-surface slopes honest.
const rbuf = Buffer.alloc(N * 3);
for (let k = 0; k < N; k++) { const e = Math.round(z[k]); rbuf[3 * k] = e >> 8; rbuf[3 * k + 1] = e & 255; rbuf[3 * k + 2] = dir[k]; }
// full grid = test oracle only (2.7 MB); the site loads 64×64 tiles instead
await sharp(rbuf, { raw: { width: nx, height: ny, channels: 3 } }).png({ compressionLevel: 9 }).toFile('test/fixtures/route-full.png');
const TS = 64, ntx = Math.ceil(nx / TS), nty = Math.ceil(ny / TS);
fs.rmSync(OUT + 'route', { recursive: true, force: true }); fs.mkdirSync(OUT + 'route', { recursive: true });
for (let ty = 0; ty < nty; ty++) for (let tx = 0; tx < ntx; tx++) {
  const w = Math.min(TS, nx - tx * TS), h = Math.min(TS, ny - ty * TS), b = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) rbuf.copy(b, y * w * 3, ((ty * TS + y) * nx + tx * TS) * 3, ((ty * TS + y) * nx + tx * TS + w) * 3);
  await sharp(b, { raw: { width: w, height: h, channels: 3 } }).png({ compressionLevel: 9 }).toFile(`${OUT}route/${tx}_${ty}.png`);
}
// For each tile, every tile that a flow path starting in it can visit (same stop rule as tracePath).
const tileOf = (c) => Math.floor((c % nx) / TS) + Math.floor(Math.floor(c / nx) / TS) * ntx;
const memo = new Map(); // entry cell -> Set of tiles visited from there
function fromCell(c0) {
  const chain = []; let c = c0, set = null;
  while (true) {
    if (memo.has(c)) { set = memo.get(c); break; }
    chain.push(c); const t = tileOf(c);
    let k = c, out = -1;
    while (true) { // walk inside tile t
      if (!dir[k] || z[k] < 120) break;
      const [dx, dy] = D8[dir[k] - 1], n = k + dy * nx + dx;
      if (tileOf(n) !== t) { out = n; break; }
      k = n;
    }
    if (out < 0) { set = new Set(); break; }
    c = out;
  }
  for (let q = chain.length - 1; q >= 0; q--) { set = new Set(set); set.add(tileOf(chain[q])); memo.set(chain[q], set); }
  return set;
}
const down = {};
for (let ty = 0; ty < nty; ty++) for (let tx = 0; tx < ntx; tx++) {
  const all = new Set();
  for (let y = ty * TS; y < Math.min(ny, ty * TS + TS); y++) for (let x = tx * TS; x < Math.min(nx, tx * TS + TS); x++) for (const t of fromCell(y * nx + x)) all.add(t);
  down[tx + ty * ntx] = [...all].sort((a, b) => a - b);
}
fs.writeFileSync(OUT + 'route/index.json', JSON.stringify({ size: TS, ntx, nty, down }));
const lens = Object.values(down).map((d) => d.length);
console.log('route tiles', ntx * nty, 'max downstream tiles', Math.max(...lens), 'mean', (lens.reduce((a, b) => a + b) / lens.length).toFixed(1));

// 3. view grid heights for the 3D mesh (display only): 8-bit, value = round(√h · 2.68),
// so steps are ≤ 8 m below 500 m and ≤ 30 m on the highest peaks. Scenario maths use route tiles.
const v = grid(VIEW), vbuf = Buffer.alloc(VIEW.nx * VIEW.ny);
for (let k = 0; k < v.length; k++) vbuf[k] = Math.min(255, Math.round(Math.sqrt(v[k]) * 2.68));
await sharp(vbuf, { raw: { width: VIEW.nx, height: VIEW.ny, channels: 1 } }).png({ compressionLevel: 9 }).toFile(OUT + 'height.png');

// 4. texture: plaster-relief style. Pale hypsometric tint × cool hillshade, meltwater rivers.
// Outside Nepal the relief is kept but turned to mist grey so the country reads as the model.
const TXW = 2048, TXH = Math.round((TXW * (BOX.n - BOX.s)) / (BOX.e - BOX.w)), tex = Buffer.alloc(TXW * TXH * 3), shadeBuf = new Float32Array(TXW * TXH);
const ramp = [[0, [200, 216, 178]], [300, [214, 222, 186]], [1000, [228, 222, 196]], [2000, [222, 211, 190]], [3500, [214, 208, 202]], [4800, [236, 238, 240]], [6000, [252, 253, 255]]];
const tint = (e) => { for (let k = 1; k < ramp.length; k++) if (e <= ramp[k][0]) { const [a, ca] = ramp[k - 1], [b, cb] = ramp[k], t = (e - a) / (b - a); return ca.map((c, i) => c + (cb[i] - c) * t); } return ramp.at(-1)[1]; };
const sx = (BOX.e - BOX.w) / TXW, sy = (BOX.n - BOX.s) / TXH;
for (let j = 0; j < TXH; j++) for (let i = 0; i < TXW; i++) {
  const lon = BOX.w + (i + 0.5) * sx, lat = BOX.n - (j + 0.5) * sy, e = sample(lon, lat);
  const dx = (sample(lon + sx, lat) - sample(lon - sx, lat)) / (2 * sx * kmPerDegLon(lat) * 1000), dy = (sample(lon, lat + sy) - sample(lon, lat - sy)) / (2 * sy * KM_PER_DEG_LAT * 1000);
  const nz = 1 / Math.hypot(dx * 2, dy * 2, 1), shade = Math.max(0, (dx * 2 * 0.5 - dy * 2 * 0.6 + 0.62) * nz); // light from NW, 2× exaggeration
  shadeBuf[j * TXW + i] = shade;
  const c = tint(e), k = (j * TXW + i) * 3;
  // shadows go cool blue-grey, lit faces stay warm-white
  const lit = Math.min(1.15, 0.55 + 0.7 * shade), shadowTint = [0.86, 0.92, 1.04];
  for (let q = 0; q < 3; q++) tex[k + q] = Math.min(255, c[q] * lit * (shade < 0.62 ? 1 + (shadowTint[q] - 1) * (0.62 - shade) * 1.6 : 1));
  const ri = Math.floor((lon - BOX.w) / ROUTE.step), rj = Math.floor((BOX.n - lat) / ROUTE.step), a = acc[rj * nx + ri];
  if (a > 300) { const w = Math.min(0.95, 0.42 + Math.log10(a / 300) * 0.42); tex[k] = tex[k] * (1 - w) + 10 * w; tex[k + 1] = tex[k + 1] * (1 - w) + 103 * w; tex[k + 2] = tex[k + 2] * (1 - w) + 135 * w; }
}
const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-10m.json'));
const nepal = feature(topo, topo.objects.countries).features.find((f) => f.properties.name === 'Nepal');
const ring = nepal.geometry.type === 'Polygon' ? nepal.geometry.coordinates[0] : nepal.geometry.coordinates.flat()[0];
const d = 'M' + ring.map(([lo, la]) => `${((lo - BOX.w) / sx).toFixed(1)},${((BOX.n - la) / sy).toFixed(1)}`).join('L') + 'Z';
const mask = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${TXW}" height="${TXH}"><rect width="100%" height="100%" fill="#000"/><path d="${d}" fill="#fff"/></svg>`)).greyscale().raw().toBuffer();
// outside Nepal: mist relief (#E7ECEA lit, cooler in shadow), rivers faint
for (let k = 0; k < TXW * TXH; k++) if (mask[k] < 128) { const s2 = Math.min(1.1, 0.72 + 0.4 * shadeBuf[k]); const m = [231, 236, 234]; for (let q = 0; q < 3; q++) tex[3 * k + q] = Math.min(255, m[q] * s2 * (q === 2 ? 1.01 : 1)); }
const border = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${TXW}" height="${TXH}"><path d="${d}" fill="none" stroke="#1B2A32" stroke-opacity=".7" stroke-width="2"/></svg>`);
const full = await sharp(tex, { raw: { width: TXW, height: TXH, channels: 3 } }).composite([{ input: border }]).png().toBuffer();
await sharp(full).jpeg({ quality: 82, mozjpeg: true }).toFile(OUT + 'texture.jpg');              // sharp, loaded when idle
await sharp(full).resize(1024).jpeg({ quality: 74, mozjpeg: true }).toFile(OUT + 'texture-1024.jpg'); // first paint
console.log('ok', { tilesPx: [TW, TH], route: [nx, ny], view: [VIEW.nx, VIEW.ny], tex: [TXW, TXH], maxAcc: acc.reduce((m, x) => Math.max(m, x), 0) });
