// Builds close-up terrain tiles off the main thread, so zooming never freezes:
// fetch a Terrarium elevation tile, decode it, and compute mesh positions, normals, elevations and texture coords.
// Inputs mirror map3d.js (scene centre, km per degree, exaggeration, map box); outputs are transferred, not copied.
const lonOf = (x, z) => (x / 2 ** z) * 360 - 180, latOf = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;
self.onmessage = async ({ data: { id, z, x, y, n, C, KX, KY, EXAG, BOX } }) => {
  try {
    const r = await fetch(`https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${z}/${x}/${y}.png`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const bmp = await createImageBitmap(await r.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const cv = new OffscreenCanvas(256, 256).getContext('2d', { willReadFrequently: true }); cv.drawImage(bmp, 0, 0);
    const px = cv.getImageData(0, 0, 256, 256).data;
    const h = (i, j) => { const k = (Math.min(255, j) * 256 + Math.min(255, i)) * 4; return Math.max(0, px[k] * 256 + px[k + 1] + px[k + 2] / 256 - 32768); };
    const pos = new Float32Array(n * n * 3), el = new Float32Array(n * n), buv = new Float32Array(n * n * 2), nor = new Float32Array(n * n * 3);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const fx = (i / (n - 1)) * 255, fy = (j / (n - 1)) * 255, i0 = Math.floor(fx), j0 = Math.floor(fy), a = fx - i0, c = fy - j0;
      const e = (h(i0, j0) * (1 - a) + h(i0 + 1, j0) * a) * (1 - c) + (h(i0, j0 + 1) * (1 - a) + h(i0 + 1, j0 + 1) * a) * c;
      const lon = lonOf(x + i / (n - 1), z), lat = latOf(y + j / (n - 1), z), k = j * n + i;
      pos[3 * k] = (lon - C.lon) * KX; pos[3 * k + 1] = (e / 1000) * EXAG; pos[3 * k + 2] = (C.lat - lat) * KY; el[k] = e;
      buv[2 * k] = (lon - BOX.w) / (BOX.e - BOX.w); buv[2 * k + 1] = (lat - BOX.s) / (BOX.n - BOX.s);
    }
    const q = (i, j) => 3 * (Math.max(0, Math.min(n - 1, j)) * n + Math.max(0, Math.min(n - 1, i)));
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const l = q(i - 1, j), rr = q(i + 1, j), u = q(i, j - 1), d = q(i, j + 1);
      const ax = pos[rr] - pos[l], ay = pos[rr + 1] - pos[l + 1], az = pos[rr + 2] - pos[l + 2], bx = pos[d] - pos[u], by = pos[d + 1] - pos[u + 1], bz = pos[d + 2] - pos[u + 2];
      let vx = by * az - bz * ay, vy = bz * ax - bx * az, vz = bx * ay - by * ax; const L = Math.hypot(vx, vy, vz) || 1, s = vy < 0 ? -1 : 1;
      const k = 3 * (j * n + i); nor[k] = (s * vx) / L; nor[k + 1] = (s * vy) / L; nor[k + 2] = (s * vz) / L;
    }
    self.postMessage({ id, pos, el, buv, nor }, [pos.buffer, el.buffer, buv.buffer, nor.buffer]);
  } catch (e) { self.postMessage({ id, error: String(e.message || e) }); }
};
