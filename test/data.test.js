import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { parseRivers, parseRain, parseQuakes, parseIncidents, mergeById, newest } from '../src/parse.js';
import { ageParts, freshness } from '../src/age.js';
import { PROVINCES } from '../src/districts.js';

const fx = (f) => JSON.parse(fs.readFileSync(new URL('./fixtures/' + f, import.meta.url))).results;

describe('parsers on real BIPAD responses', () => {
  it('rivers: one row per station, newest reading kept', () => {
    const raw = fx('river.json'), out = parseRivers(raw);
    expect(new Set(out.map((r) => r.id)).size).toBe(out.length);
    expect(out.length).toBe(new Set(raw.filter((r) => r.waterLevelOn).map((r) => r.station)).size);
    for (const r of out) {
      const newestRaw = raw.filter((x) => x.station === r.id && x.waterLevelOn).map((x) => Date.parse(x.waterLevelOn));
      expect(Date.parse(r.at)).toBe(Math.max(...newestRaw));
      expect(r.ll[0]).toBeGreaterThan(79); expect(r.ll[0]).toBeLessThan(89);
      expect(r.ll[1]).toBeGreaterThan(26); expect(r.ll[1]).toBeLessThan(31);
    }
  });
  it('rain: 1h and 24h totals taken from the matching interval', () => {
    const raw = fx('rain.json'), out = parseRain(raw);
    const s = out.find((r) => r.name === 'Jamu (Tikuwa Kuna)') || out[0];
    const src = raw.filter((x) => x.station === s.id).sort((a, b) => Date.parse(b.measuredOn) - Date.parse(a.measuredOn))[0];
    expect(s.h24).toBe(src.averages.find((a) => a.interval === 24).value);
    expect(s.h1).toBe(src.averages.find((a) => a.interval === 1).value);
  });
  it('quakes newest first; known event present', () => {
    const q = parseQuakes(fx('earthquake.json'));
    expect(q[0].at >= q[1].at).toBe(true);
    expect(q.some((x) => x.mag === 4.4 && x.place === 'Sankhuwasabha' && x.at.startsWith('2025-08-22'))).toBe(true);
  });
  it('incidents keep Nepali title and sort newest first', () => {
    const i = parseIncidents(fx('incident_flood.json'));
    expect(i.every((x) => x.hazard === 11)).toBe(true);
    for (let k = 1; k < i.length; k++) expect(Date.parse(i[k - 1].at) >= Date.parse(i[k].at)).toBe(true);
    expect(i.some((x) => x.titleNe.length > 0)).toBe(true);
  });
  it('swapped coordinates fixed, impossible ones dropped', () => {
    expect(parseRivers(fx('river.json')).find((r) => r.id === 270).ll).toEqual([85.68924, 27.52327]);
    const q = parseQuakes(fx('earthquake.json'));
    expect(q.some((x) => x.ll[1] > 32)).toBe(false);
    const raw = fx('earthquake.json');
    const ok = raw.filter(({ point: { coordinates: [x, y] } }) => (x >= 78 && x <= 90 && y >= 25 && y <= 32) || (y >= 78 && y <= 90 && x >= 25 && x <= 32));
    expect(q.length).toBe(ok.length);
  });
  it('mergeById replaces and dedupes', () => {
    const a = [{ id: 1, at: '2024-01-01T00:00:00Z', v: 1 }], b = [{ id: 1, at: '2024-01-01T00:00:00Z', v: 2 }, { id: 2, at: '2024-02-01T00:00:00Z' }];
    const m = mergeById(a, b);
    expect(m.map((x) => x.id)).toEqual([2, 1]); expect(m[1].v).toBe(2);
    expect(newest(m)).toBe('2024-02-01T00:00:00Z');
  });
});

describe('age labels', () => {
  const now = Date.parse('2026-11-22T12:00:00Z');
  it.each([
    ['2026-11-22T11:59:30Z', [0, 'min']], ['2026-11-22T11:01:00Z', [59, 'min']], ['2026-11-22T11:00:00Z', [1, 'h']],
    ['2026-11-21T12:00:01Z', [23, 'h']], ['2026-11-21T12:00:00Z', [1, 'd']], ['2025-08-22T17:30:00Z', [15, 'mo']],
    ['2015-04-25T06:11:00Z', [11, 'y']], ['2026-11-22T13:00:00Z', [0, 'min']],
  ])('%s', (iso, want) => expect(ageParts(iso, now)).toEqual(want));
  it('freshness', () => {
    expect(freshness('2026-11-22T10:00:00Z', 3, now)).toBe('fresh');
    expect(freshness('2026-11-22T08:59:00Z', 3, now)).toBe('stale');
    expect(freshness(null, 3, now)).toBe('none');
  });
});

describe('districts (Constitution Schedule 4)', () => {
  const all = PROVINCES.flatMap((p) => p.d);
  it('77 districts in 7 provinces with Schedule 4 counts', () => {
    expect(all.length).toBe(77);
    expect(PROVINCES.map((p) => p.d.length)).toEqual([14, 8, 13, 11, 12, 10, 9]);
    expect(new Set(all.map((d) => d[0])).size).toBe(77);
    expect(new Set(all.map((d) => d[1])).size).toBe(77);
  });
  it('constitutional spellings (not variant spellings)', () => {
    const ne = new Set(all.map((d) => d[1]));
    for (const w of ['काठमाडौं', 'ताप्लेजुङ', 'कञ्चनपुर', 'बाग्लुङ', 'रुकुम (पूर्वी भाग)', 'नवलपरासी (बर्दघाट सुस्ता पश्चिम)']) expect(ne.has(w)).toBe(true);
    for (const w of ['काठमाण्डौ', 'ताप्लेजुङ्ग', 'कन्चनपुर']) expect(ne.has(w)).toBe(false);
    for (const [, n] of all) expect(n).toBe(n.normalize('NFC'));
  });
  it('first and last per province match Schedule 4 order', () => {
    expect(PROVINCES.map((p) => [p.d[0][1], p.d.at(-1)[1]])).toEqual([
      ['ताप्लेजुङ', 'सुनसरी'], ['सप्तरी', 'पर्सा'], ['दोलखा', 'काठमाडौं'], ['गोरखा', 'नवलपरासी (बर्दघाट सुस्ता पूर्व)'],
      ['नवलपरासी (बर्दघाट सुस्ता पश्चिम)', 'बर्दिया'], ['रुकुम (पश्चिम भाग)', 'सुर्खेत'], ['बाजुरा', 'कैलाली']]);
  });
});
