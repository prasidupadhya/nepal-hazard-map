import sharp from 'sharp';
import fs from 'node:fs';
import { ROUTE } from '../src/grid.js';
import { makeRouteLoader } from '../src/route-tiles.js';
// Full grid: the oracle.
export async function loadRoute() {
  const { data } = await sharp(new URL('./fixtures/route-full.png', import.meta.url).pathname).raw().toBuffer({ resolveWithObject: true });
  const N = ROUTE.nx * ROUTE.ny, dir = new Uint8Array(N), elev = new Int16Array(N);
  for (let k = 0; k < N; k++) { elev[k] = (data[3 * k] << 8) | data[3 * k + 1]; dir[k] = data[3 * k + 2]; }
  return { nx: ROUTE.nx, ny: ROUTE.ny, dir, elev };
}
// Tiled loader, as the site uses it.
export const tileLoader = () => makeRouteLoader(
  async (tx, ty) => { const { data, info } = await sharp(`public/terrain/route/${tx}_${ty}.png`).raw().toBuffer({ resolveWithObject: true }); return { w: info.width, h: info.height, rgb: data }; },
  async () => JSON.parse(fs.readFileSync('public/terrain/route/index.json')));
