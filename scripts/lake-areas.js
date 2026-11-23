// Current water area of each ICIMOD lake from Sentinel-2 L2A (AWS Open Data, Earth Search STAC).
// Water = NDWI (B03 green vs B08 near-infrared, 10 m) > THRESH, flood-filled from the lake's ICIMOD coordinate.
// Scenes: post-monsoon (Sep–Nov), lake window free of cloud and ice according to the SCL band.
// Writes scripts/data/lake-areas.json. Run: NODE_USE_ENV_PROXY=1 node scripts/lake-areas.js
import fs from 'node:fs';
import { fromUrl } from 'geotiff';
import proj4 from 'proj4';

const THRESH = 0.3, HALF = +(process.env.HALF || 2500); // metres around the coordinate (HALF=6000 for very large lakes)
const lakes = JSON.parse(fs.readFileSync('scripts/data/pdgl-icimod-2020.json')).lakes;
const only = process.argv[2]; // optional: one lake ID
const out = { source: 'Sentinel-2 L2A, Copernicus/ESA, via AWS Earth Search (earth-search.aws.element84.com)', method: `NDWI(B03,B08) > ${THRESH}, connected water around the ICIMOD coordinate; scenes Sep–Nov 2023–2025 with no cloud near the lake (SCL); open water only (a frozen lake has no water signal)`, areas: {}, scenes: {} };
const prev = fs.existsSync('scripts/data/lake-areas.json') ? JSON.parse(fs.readFileSync('scripts/data/lake-areas.json')) : null;
if (prev) Object.assign(out.areas, prev.areas), Object.assign(out.scenes, prev.scenes);

async function search(lon, lat) {
  const body = { collections: ['sentinel-2-l2a'], intersects: { type: 'Point', coordinates: [lon, lat] }, limit: 40,
    query: { 'eo:cloud_cover': { lt: 30 } }, sortby: [{ field: 'properties.datetime', direction: 'desc' }] };
  const items = [];
  // SUMMER=1: July to mid-October, for lakes still frozen in late autumn
  const windows = process.env.SUMMER ? ['2025-07-01T00:00:00Z/2025-10-15T23:59:59Z', '2024-07-01T00:00:00Z/2024-10-15T23:59:59Z', '2023-07-01T00:00:00Z/2023-10-15T23:59:59Z']
    : ['2025-09-01T00:00:00Z/2025-11-30T23:59:59Z', '2024-09-01T00:00:00Z/2024-11-30T23:59:59Z', '2023-09-01T00:00:00Z/2023-11-30T23:59:59Z'];
  for (const dt of windows) {
    const r = await fetch('https://earth-search.aws.element84.com/v1/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, datetime: dt }) });
    if (!r.ok) throw new Error('STAC ' + r.status);
    items.push(...(await r.json()).features);
  }
  return items.sort((a, b) => a.properties['eo:cloud_cover'] - b.properties['eo:cloud_cover']);
}
async function windowOf(href, epsg, x, y, res) {
  const tif = await fromUrl(href), img = await tif.getImage(), [ox, oy] = img.getOrigin(), [rx] = img.getResolution();
  const px = Math.round((x - HALF - ox) / rx), py = Math.round((oy - (y + HALF)) / rx), n = Math.round((2 * HALF) / rx);
  const [band] = await img.readRasters({ window: [px, py, px + n, py + n] });
  return { band, n, rx };
}
for (const l of lakes) {
  if (only && l.id !== only) continue;
  if (!only && out.areas[l.id] >= 0.02) continue; // resume: already measured
  const [lon, lat] = l.ll; let done = false;
  for (const it of await search(lon, lat)) try {
    const epsg = it.properties['proj:epsg'], [x, y] = proj4('EPSG:4326', `+proj=utm +zone=${epsg % 100} +datum=WGS84 +units=m +no_defs`, [lon, lat]);
    // 1. SCL (20 m): skip scenes with cloud or cloud shadow (3, 8, 9, 10) near the lake. Snow on the slopes around is
    //    normal; a frozen lake has no water signal and fails the NDWI seed below.
    const scl = await windowOf(it.assets.scl.href, epsg, x, y), c = (scl.n / 2) | 0; let bad = 0, tot = 0, nod = 0;
    for (let j = c - 25; j <= c + 25; j++) for (let i = c - 25; i <= c + 25; i++) { const v = scl.band[j * scl.n + i]; tot++; if ([3, 8, 9, 10].includes(v)) bad++; if (v === 0) nod++; }
    if (bad / tot > +(process.env.CLOUD || 0.03) || nod > 0) continue; // CLOUD=0.1 relaxes it for lakes with no fully clear scene
    // 2. NDWI (10 m) and flood fill from the strongest water pixel within 150 m of the coordinate
    const [g, nir] = await Promise.all([windowOf(it.assets.green.href, epsg, x, y), windowOf(it.assets.nir.href, epsg, x, y)]), n = g.n;
    const nd = new Float32Array(n * n); for (let k = 0; k < n * n; k++) { const a = g.band[k], b = nir.band[k]; nd[k] = a + b > 0 ? (a - b) / (a + b) : -1; }
    const m = (n / 2) | 0; let seed = -1, best = THRESH;
    for (let j = m - 15; j <= m + 15; j++) for (let i = m - 15; i <= m + 15; i++) { const k = j * n + i; if (nd[k] > best) { best = nd[k]; seed = k; } }
    if (seed < 0) continue;
    const seen = new Uint8Array(n * n), st = [seed]; seen[seed] = 1; let cnt = 0, edge = false;
    while (st.length) { const k = st.pop(); cnt++; const i = k % n, j = (k / n) | 0; if (!i || !j || i === n - 1 || j === n - 1) edge = true;
      for (const d of [1, -1, n, -n]) { const q = k + d; if (q >= 0 && q < n * n && !seen[q] && nd[q] > THRESH) { seen[q] = 1; st.push(q); } } }
    if (edge) continue; // touches the window edge: a river or a mis-seeded patch, not a lake
    if ((cnt * g.rx * g.rx) / 1e6 < 0.02) continue; // ICIMOD assessed lakes ≥ 0.02 km²: smaller means ice, shadow or a puddle
    out.areas[l.id] = +((cnt * g.rx * g.rx) / 1e6).toFixed(3);
    out.scenes[l.id] = { id: it.id, date: it.properties.datetime.slice(0, 10) };
    console.log(l.no, l.id, l.name || '', out.areas[l.id], 'km²', out.scenes[l.id].date); done = true; break;
  } catch (e) { console.log(l.no, l.id, 'scene read failed, trying the next:', e.message); } // network hiccup: next scene
  // Frozen all season (no water signal in any scene): ICE=<scene id> traces the ice surface instead — reflectance
  // within 10% of the coordinate's in green, red and near-infrared. Shaded parts drop out, so this is a minimum area.
  if (!done && process.env.ICE) {
    const it = await (await fetch(`https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/${process.env.ICE}`)).json();
    const epsg = it.properties['proj:epsg'], [x, y] = proj4('EPSG:4326', `+proj=utm +zone=${epsg % 100} +datum=WGS84 +units=m +no_defs`, [lon, lat]);
    const B = await Promise.all(['green', 'red', 'nir'].map((b) => windowOf(it.assets[b].href, epsg, x, y))), n = B[0].n, m = n >> 1;
    const mean = B.map(({ band }) => { let s = 0; for (let j = m - 3; j <= m + 3; j++) for (let i = m - 3; i <= m + 3; i++) s += band[j * n + i]; return s / 49; });
    const like = (k) => B.every(({ band }, q) => Math.abs(band[k] - mean[q]) < 0.1 * mean[q]);
    const seen = new Uint8Array(n * n), st = [m * n + m]; seen[st[0]] = 1; let cnt = 0;
    while (st.length) { const k = st.pop(); cnt++; for (const d of [1, -1, n, -n]) { const q = k + d; if (q >= 0 && q < n * n && !seen[q] && like(q)) { seen[q] = 1; st.push(q); } } }
    out.areas[l.id] = +((cnt * B[0].rx * B[0].rx) / 1e6).toFixed(3);
    out.scenes[l.id] = { id: it.id, date: it.properties.datetime.slice(0, 10), frozen: true };
    console.log(l.no, l.id, 'frozen, minimum', out.areas[l.id], 'km²'); done = true;
  }
  if (!done) { delete out.areas[l.id]; delete out.scenes[l.id]; console.log(l.no, l.id, 'NO CLEAR SCENE'); }
  fs.writeFileSync('scripts/data/lake-areas.json', JSON.stringify(out, null, 1));
}
