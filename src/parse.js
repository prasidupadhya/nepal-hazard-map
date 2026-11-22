// Pure parsers for BIPAD API pages. BIPAD republishes DHM river/rain readings
// (dataSource "hydrology.gov.np") and NEMRC earthquake events.
const r5 = (x) => Math.round(x * 1e5) / 1e5;
// Region around Nepal (lon 78–90, lat 25–32). A point whose two values fit only
// when swapped is swapped back; anything else outside is dropped.
const inBox = (x, y) => x >= 78 && x <= 90 && y >= 25 && y <= 32;
export const QC = { swapped: 0, rejected: 0 };
const pt = (p) => {
  const c = p && p.coordinates;
  if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) return null;
  if (inBox(c[0], c[1])) return [r5(c[0]), r5(c[1])];
  if (inBox(c[1], c[0])) { QC.swapped++; return [r5(c[1]), r5(c[0])]; }
  QC.rejected++; return null;
};
const newestBy = (rows, key, at) => {
  const m = new Map();
  for (const r of rows) {
    const k = r[key], t = r[at];
    if (k == null || !t) continue;
    const prev = m.get(k);
    if (!prev || Date.parse(t) > Date.parse(prev[at])) m.set(k, r);
  }
  return [...m.values()];
};

export function parseRivers(rows) {
  return newestBy(rows, 'station', 'waterLevelOn').map((r) => ({ r, ll: pt(r.point) })).filter((x) => x.ll).map(({ r, ll }) => ({
    id: r.station, name: r.title, basin: r.basin || null, ll,
    level: r.waterLevel == null ? null : Math.round(r.waterLevel * 100) / 100,
    warn: r.warningLevel ?? null, danger: r.dangerLevel ?? null,
    status: r.status || null, trend: r.steady || null, at: r.waterLevelOn,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export function parseRain(rows) {
  return newestBy(rows, 'station', 'measuredOn').map((r) => ({ r, ll: pt(r.point) })).filter((x) => x.ll).map(({ r, ll }) => {
    const by = Object.fromEntries((r.averages || []).map((a) => [a.interval, a.value]));
    return { id: r.station, name: r.title, basin: r.basin || null, ll,
      h1: by[1] ?? null, h24: by[24] ?? null, status: r.status || null, at: r.measuredOn };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function parseQuakes(rows) {
  return rows.filter((r) => r.eventOn && r.magnitude != null).map((r) => ({ r, ll: pt(r.point) })).filter((x) => x.ll).map(({ r, ll }) => ({
    id: r.id, mag: r.magnitude, ll, place: r.address || '', district: r.district ?? null, at: r.eventOn,
  })).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export function parseIncidents(rows) {
  return rows.filter((r) => r.incidentOn).map((r) => ({
    id: r.id, hazard: r.hazard, title: r.title || '', titleNe: r.titleNe || '', ll: pt(r.point),
    loss: r.loss ?? null, verified: !!r.verified, at: r.incidentOn,
  })).sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id - a.id);
}

export const newest = (items) => items.reduce((m, x) => (x.at && (!m || Date.parse(x.at) > Date.parse(m)) ? x.at : m), null);

// Merge new records into an archive keyed by id; newest first.
export function mergeById(old, add) {
  const m = new Map(old.map((x) => [x.id, x]));
  for (const x of add) m.set(x.id, x);
  return [...m.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id - a.id);
}
