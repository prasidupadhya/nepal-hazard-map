// Daily copy of official data into public/data. Run: node scripts/fetch-data.js
// A failed source keeps its previous copy and records the error, so the site
// shows growing age instead of going blank.
import fs from 'node:fs';
import { QC, parseRivers, parseRain, parseQuakes, parseIncidents, newest, mergeById } from '../src/parse.js';
import { PROVINCES } from '../src/districts.js';
import { LAKES } from '../src/lakes.js';

const OUT = new URL('../public/data/', import.meta.url).pathname;
const B = 'https://bipadportal.gov.np/api/v1/';
const HAZ = { flood: 11, glof: 26, inundation: 28, earthquake: 8 };
const BIPAD_ALIAS = { Dhanusha: 'Dhanusa', Tanahun: 'Tanahu', Kapilvastu: 'Kapilbastu',
  'Nawalparasi (East of Bardaghat Susta)': 'Nawalparasi East', 'Nawalparasi (West of Bardaghat Susta)': 'Nawalparasi West',
  'Rukum (East)': 'Rukum East', 'Rukum (West)': 'Rukum West' };

async function get(path, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(B + path, { signal: AbortSignal.timeout(60000), headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      if (!Array.isArray(j.results)) throw new Error('unexpected response shape');
      return j.results;
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
}
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(OUT + f, 'utf8')); } catch { return d; } };
const write = (f, v) => { fs.mkdirSync(OUT + f.replace(/[^/]*$/, ''), { recursive: true }); fs.writeFileSync(OUT + f, JSON.stringify(v)); };

const now = new Date().toISOString();
const prev = read('latest.json', { sources: {} });
const latest = { generated_at: now, sources: {} };

async function source(key, origin, expectH, fn) {
  try {
    const q0 = { ...QC };
    const items = await fn();
    const qc = { swapped: QC.swapped - q0.swapped, rejected: QC.rejected - q0.rejected };
    latest[key] = items;
    latest.sources[key] = { ok: true, origin, fetched_at: now, newest: newest(items), count: items.length, expect_h: expectH, qc };
  } catch (e) {
    latest[key] = prev[key] || [];
    const p = prev.sources[key] || {};
    latest.sources[key] = { ...p, origin, ok: false, error: String(e.message || e), tried_at: now, expect_h: expectH };
    console.error('FAILED', key, e.message);
  }
}

await source('rivers', 'DHM via BIPAD', 3, async () => parseRivers(await get('river/?format=json&limit=500&ordering=-id')));
await source('rain', 'DHM via BIPAD', 3, async () => parseRain(await get('rain/?format=json&limit=800&ordering=-measured_on')));
await source('quakes', 'NEMRC via BIPAD', null, async () => parseQuakes(await get('earthquake/?format=json&limit=300&ordering=-event_on')));
await source('incidents', 'BIPAD', 48, async () => {
  const lists = [];
  for (const id of Object.values(HAZ)) lists.push(parseIncidents(await get(`incident/?format=json&limit=300&ordering=-incident_on&hazard=${id}`)));
  return mergeById([], lists.flat());
});

// NEMRC's own site: record whether it is reachable with normal TLS checks.
try {
  const r = await fetch('https://www.seismonepal.gov.np/earthquakes', { signal: AbortSignal.timeout(30000) });
  latest.sources.nemrc_site = { ok: r.ok, checked_at: now, status: r.status };
} catch (e) {
  latest.sources.nemrc_site = { ok: false, checked_at: now, error: String(e.cause?.code || e.message) };
}

// Archive: everything ever copied, one file per month, so old content stays
// available without making the daily file bigger.
const byMonth = {};
for (const kind of ['quakes', 'incidents']) for (const x of latest[kind]) ((byMonth[x.at.slice(0, 7)] ??= {})[kind] ??= []).push(x);
const index = read('archive/index.json', { months: {} });
for (const [m, v] of Object.entries(byMonth)) {
  const old = read(`archive/${m}.json`, { quakes: [], incidents: [] });
  const merged = { quakes: mergeById(old.quakes, v.quakes || []), incidents: mergeById(old.incidents, v.incidents || []) };
  write(`archive/${m}.json`, merged);
  index.months[m] = { quakes: merged.quakes.length, incidents: merged.incidents.length };
}
write('archive/index.json', index);
latest.incidents = latest.incidents.slice(0, 200); // the daily file carries only the newest
write('latest.json', latest);

// Search index: constitution districts (+ BIPAD centroid), local levels, stations, lakes.
try {
  const d = await get('district/?format=json&limit=200');
  const m = await get('municipality/?format=json&limit=2000');
  const byEn = new Map(d.map((x) => [x.title_en, x]));
  const places = [];
  const dId = {};
  for (const p of PROVINCES) for (const [en, ne] of p.d) {
    const b = byEn.get(BIPAD_ALIAS[en] || en);
    if (!b) throw new Error('district not in BIPAD: ' + en);
    dId[b.id] = en;
    places.push({ t: 'd', en, ne, ll: b.centroid.coordinates.map((v) => +v.toFixed(4)), p: p.no });
  }
  // The 753 local levels (k: 1 metropolitan, 2 sub-metropolitan, 3 municipality, 4 rural municipality, used to rank
  // map labels). BIPAD's list also holds parts of national parks and reserves (split per district, some
  // missing): they are not local levels and are left out.
  const KIND = { 'Metropolitan City': 1, 'Submetropolitan City': 2, 'Sub-Metropolitan City': 2, Municipality: 3, 'Rural Municipality': 4 };
  for (const x of m) if (x.centroid) {
    const ll = x.centroid.coordinates.map((v) => +v.toFixed(4)), dn = dId[x.district] || '';
    if (KIND[x.type]) places.push({ t: 'm', en: x.title_en, ne: x.title_ne, ll, dn, k: KIND[x.type] });
  }
  for (const l of LAKES) places.push({ t: 'l', en: l.en, ne: l.ne, ll: l.ll, id: l.id });
  for (const r of latest.rivers) places.push({ t: 's', en: r.name, ne: r.name, ll: r.ll, id: r.id });
  write('places.json', places);
} catch (e) { console.error('FAILED places', e.message); }

console.log(JSON.stringify(latest.sources, null, 1));
