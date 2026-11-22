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
await sharp(rbuf, { raw: { width: nx, height: ny, channels: 3 } }).png({ compressionLevel: 9 }).toFile(OUT + 'route.png');

// 3. view grid heights (R,G) for the 3D mesh
const v = grid(VIEW), vbuf = Buffer.alloc(VIEW.nx * VIEW.ny * 3);
for (let k = 0; k < v.length; k++) { const e = Math.round(v[k]); vbuf[3 * k] = e >> 8; vbuf[3 * k + 1] = e & 255; }
await sharp(vbuf, { raw: { width: VIEW.nx, height: VIEW.ny, channels: 3 } }).png({ compressionLevel: 9 }).toFile(OUT + 'height.png');

// 4. texture: hypsometric tint × hillshade, rivers from accumulation, outside Nepal dimmed
const TXW = 2048, TXH = Math.round((TXW * (BOX.n - BOX.s)) / (BOX.e - BOX.w)), tex = Buffer.alloc(TXW * TXH * 3);
const ramp = [[0, [86, 128, 76]], [300, [120, 150, 88]], [1000, [168, 160, 110]], [2000, [150, 120, 92]], [3500, [130, 112, 104]], [4800, [205, 205, 210]], [6000, [250, 251, 255]]];
const tint = (e) => { for (let k = 1; k < ramp.length; k++) if (e <= ramp[k][0]) { const [a, ca] = ramp[k - 1], [b, cb] = ramp[k], t = (e - a) / (b - a); return ca.map((c, i) => c + (cb[i] - c) * t); } return ramp.at(-1)[1]; };
const sx = (BOX.e - BOX.w) / TXW, sy = (BOX.n - BOX.s) / TXH;
for (let j = 0; j < TXH; j++) for (let i = 0; i < TXW; i++) {
  const lon = BOX.w + (i + 0.5) * sx, lat = BOX.n - (j + 0.5) * sy, e = sample(lon, lat);
  const dx = (sample(lon + sx, lat) - sample(lon - sx, lat)) / (2 * sx * kmPerDegLon(lat) * 1000), dy = (sample(lon, lat + sy) - sample(lon, lat - sy)) / (2 * sy * KM_PER_DEG_LAT * 1000);
  const nz = 1 / Math.hypot(dx * 2, dy * 2, 1), shade = Math.max(0, (-dx * 2 * -0.5 + -dy * 2 * 0.6 + 0.62) * nz); // light from NW, 2× exaggeration
  const c = tint(e), s = 0.45 + 0.75 * shade, k = (j * TXW + i) * 3;
  for (let q = 0; q < 3; q++) tex[k + q] = Math.min(255, c[q] * s);
  const ri = Math.floor((lon - BOX.w) / ROUTE.step), rj = Math.floor((BOX.n - lat) / ROUTE.step), a = acc[rj * nx + ri];
  if (a > 400) { const w = Math.min(1, 0.35 + Math.log10(a / 400) * 0.45); tex[k] = tex[k] * (1 - w) + 60 * w; tex[k + 1] = tex[k + 1] * (1 - w) + 130 * w; tex[k + 2] = tex[k + 2] * (1 - w) + 200 * w; }
}
const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-10m.json'));
const nepal = feature(topo, topo.objects.countries).features.find((f) => f.properties.name === 'Nepal');
const ring = nepal.geometry.type === 'Polygon' ? nepal.geometry.coordinates[0] : nepal.geometry.coordinates.flat()[0];
const d = 'M' + ring.map(([lo, la]) => `${((lo - BOX.w) / sx).toFixed(1)},${((BOX.n - la) / sy).toFixed(1)}`).join('L') + 'Z';
const mask = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${TXW}" height="${TXH}"><rect width="100%" height="100%" fill="#000"/><path d="${d}" fill="#fff"/></svg>`)).greyscale().raw().toBuffer();
for (let k = 0; k < TXW * TXH; k++) if (mask[k] < 128) { const g = (tex[3 * k] + tex[3 * k + 1] + tex[3 * k + 2]) / 3; for (let q = 0; q < 3; q++) tex[3 * k + q] = (g * 0.7 + tex[3 * k + q] * 0.3) * 0.55; }
const border = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${TXW}" height="${TXH}"><path d="${d}" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2.2"/></svg>`);
await sharp(tex, { raw: { width: TXW, height: TXH, channels: 3 } }).composite([{ input: border }]).jpeg({ quality: 82, mozjpeg: true }).toFile(OUT + 'texture.jpg');
fs.writeFileSync(OUT + 'border.json', JSON.stringify(ring.map(([a, b]) => [+a.toFixed(4), +b.toFixed(4)])));
console.log('ok', { tilesPx: [TW, TH], route: [nx, ny], view: [VIEW.nx, VIEW.ny], tex: [TXW, TXH], maxAcc: acc.reduce((m, x) => Math.max(m, x), 0) });
