// Shared grid geometry (equirectangular lon/lat). Used by the bake script and the app.
export const BOX = { w: 79.9, e: 88.3, s: 26.25, n: 30.5 };
// Routing grid: 0.005° (~500 m). Display grid: 0.02° (~2 km).
export const ROUTE = { step: 0.005, nx: 1680, ny: 850 };
export const VIEW = { step: 0.02, nx: 421, ny: 213 };
export const KM_PER_DEG_LAT = 111.32;
export const kmPerDegLon = (lat) => 111.32 * Math.cos((lat * Math.PI) / 180);
// cell centre of row-major grid; row 0 is the north edge
export const cellLL = (g, i, j) => [BOX.w + (i + 0.5) * g.step, BOX.n - (j + 0.5) * g.step];
export const llCell = (g, lon, lat) => [Math.floor((lon - BOX.w) / g.step), Math.floor((BOX.n - lat) / g.step)];
// D8 neighbour order shared by flowdir encoding (code 1..8; 0 = edge/outlet)
export const D8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
