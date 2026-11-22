import sharp from 'sharp';
import { ROUTE } from '../src/grid.js';
export async function loadRoute() {
  const { data } = await sharp(new URL('../public/terrain/route.png', import.meta.url).pathname).raw().toBuffer({ resolveWithObject: true });
  const N = ROUTE.nx * ROUTE.ny, dir = new Uint8Array(N), elev = new Int16Array(N);
  for (let k = 0; k < N; k++) { elev[k] = (data[3 * k] << 8) | data[3 * k + 1]; dir[k] = data[3 * k + 2]; }
  return { nx: ROUTE.nx, ny: ROUTE.ny, dir, elev };
}
