// Routing grid loaded as 64×64 tiles: only the tiles a flow path from the start
// tile can reach (precomputed in route/index.json), fetched in parallel.
import { ROUTE, BOX } from './grid.js';
export function makeRouteLoader(fetchTile, fetchIndex) {
  const N = ROUTE.nx * ROUTE.ny, grid = { nx: ROUTE.nx, ny: ROUTE.ny, dir: new Uint8Array(N), elev: new Int16Array(N) };
  const have = new Map(); let index = null;
  async function put(id) {
    const { size, ntx } = index, tx = id % ntx, ty = Math.floor(id / ntx);
    const { w, h, rgb } = await fetchTile(tx, ty); // rgb: R,G = elevation, B = D8 code; stride 3 or 4
    const st = rgb.length / (w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = (ty * size + y) * ROUTE.nx + tx * size + x, p = (y * w + x) * st;
      grid.elev[k] = (rgb[p] << 8) | rgb[p + 1]; grid.dir[k] = rgb[p + 2];
    }
  }
  // Ensures every tile needed for a path from (lon, lat) is in `grid`; returns { grid, added }.
  return async function load(lon, lat) {
    index ??= await fetchIndex();
    const i = Math.floor((lon - BOX.w) / ROUTE.step), j = Math.floor((BOX.n - lat) / ROUTE.step);
    if (i < 0 || j < 0 || i >= ROUTE.nx || j >= ROUTE.ny) return { grid, added: 0 };
    const start = Math.floor(i / index.size) + Math.floor(j / index.size) * index.ntx;
    const need = index.down[start].filter((t) => !have.has(t));
    for (const t of need) have.set(t, put(t));
    await Promise.all(index.down[start].map((t) => have.get(t)));
    return { grid, added: need.length };
  };
}
