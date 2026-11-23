import { t, tf, num, when, day, age, name, lang, digits, monthYear } from './i18n.js';
import { freshness } from './age.js';
import { map } from './map.js';
import { MMI_COLORS } from './colors.js';
import { state, dataReady, mapReady, showChips, LAYER_COLOR, LAKE_RANK_COLOR, SCENARIO } from './main.js';
import { PROVINCES } from './districts.js';
import { VIEW, ROUTE, D8 } from './grid.js';
import { makeRouteLoader } from './route-tiles.js';
import * as js from './scenario.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ROMAN = js.ROMAN;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- shared bits ----------
// The "edition" block: how old every dataset is, like the edition note on a survey sheet.
function feedCards() {
  const S = state.latest.sources, now = Date.now();
  return `<h2>${t('edition')}</h2><dl class="edition feeds">${['rivers', 'rain', 'quakes', 'incidents'].map((k) => {
    const s = S[k] || {}, f = s.expect_h ? freshness(s.newest, s.expect_h, now) : 'none';
    const state2 = s.ok === false ? `<span class="state err">${t('failed')}</span>` : s.expect_h ? `<span class="state ${f}">${t(f)}</span>` : '';
    return `<div><dt>${t('feeds.' + k)}</dt><dd class="age">${age(s.newest, now)}</dd>
      <div class="meta">${state2}<span>${t('newest')} ${when(s.newest)}</span><span>${esc(t('origin.' + s.origin))}</span></div>
      ${s.expect_h ? '' : `<div class="meta">${t('quakeAgeNote')}</div>`}</div>`;
  }).join('')}</dl><p class="note">${t('edNote')} ${t('copied')}: ${when(S.rivers?.fetched_at)}</p>`;
}
const arrow = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-4-4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const fill = (r) => r.style.setProperty('--fill', ((r.value - r.min) / (r.max - r.min || 1)) * 100 + '%');
const fmtH = (h) => {
  const m = Math.round(h * 60), H = Math.floor(m / 60), M = m % 60;
  return H ? `${num(H)} ${t('hr')} ${digits(String(M).padStart(2, '0'))} ${t('unit.min')}` : `${num(M)} ${t('unit.min')}`;
};
const mmiBand = (lo, hi) => { const a = Math.round(lo), b = Math.round(hi); return `<span class="mmi"><i style="background:${MMI_COLORS[a]}"></i><i style="background:${MMI_COLORS[b]}"></i>${ROMAN[a]}–${ROMAN[b]}</span>`; };
const mmiWord = (m) => { const k = [10, 9, 8, 7, 6, 5, 4, 2].find((x) => Math.round(m) >= x); return t('quake.mmi.' + k); };
function legend() {
  const L = document.getElementById('legend');
  L.innerHTML = `<span>${t('quake.legend')}</span><div class="bar">${[3, 4, 5, 6, 7, 8, 9, 10].map((m) => `<i style="background:${MMI_COLORS[m]}"></i>`).join('')}</div><div class="ticks"><span>III</span><span>V</span><span>VII</span><span>X</span></div>`;
  L.hidden = false;
}
function printBlock(inputsHtml) {
  return `<div class="print-only"><p class="note">${t('title')}. ${t('printed')}: ${when(new Date().toISOString())}. ${location.href.split('#')[0]}</p>${inputsHtml}<img class="shot" alt=""></div>`;
}
function doPrint() {
  const img = document.querySelector('#panel img.shot');
  if (img && map.ready()) img.src = map.snapshot();
  setTimeout(() => window.print(), 50);
}

// Scenario engine: Rust→WASM when available (faster on phones), JS otherwise. Same results (tested).
let engineP = null;
const engine = () => (engineP ??= import('./scenario-wasm.js').then((m) => m.loadWasm('wasm/scenario.wasm')).catch(() => null));
async function tilePixels(url) {
  const bmp = await createImageBitmap(await (await fetch(url)).blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d', { willReadFrequently: true }); c.drawImage(bmp, 0, 0);
  return { w: bmp.width, h: bmp.height, rgb: c.getImageData(0, 0, bmp.width, bmp.height).data };
}
const loadTiles = makeRouteLoader((tx, ty) => tilePixels(`terrain/route/${tx}_${ty}.png`), () => fetch('terrain/route/index.json').then((r) => r.json()));
async function routeFor(ll) {
  const [{ grid, added }, w] = await Promise.all([loadTiles(...ll), engine()]);
  if (w && added) w.setRoute(grid);
  return grid;
}

// ---------- glacial lakes (ICIMOD 2020) ----------
// Own chunk: starts loading at boot but never delays the first text on screen.
export let LAKES = [];
export const lakesReady = import('./lakes.js').then((m) => (LAKES = m.LAKES));
const COUNTRY_ORDER = ['Nepal', 'Tibet, China', 'India'], RANK_ORDER = { I: 0, II: 1, III: 2 };
const lakeLabel = (l) => `${name(l)}, ${l.rank}, ${lang === 'ne' ? l.basin[1] : l.basin[0]}`;
function lakeOptions() {
  return COUNTRY_ORDER.map((c) => {
    const ls = LAKES.filter((l) => l.country[0] === c).sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank] || b.named - a.named || a.no - b.no);
    return `<optgroup label="${esc(lang === 'ne' ? ls[0].country[1] : c)}">${ls.map((l) => `<option value="${l.id}">${esc(lakeLabel(l))}</option>`).join('')}</optgroup>`;
  }).join('');
}
function lakeFacts(l) {
  const vol = l.volSrc === 'survey' ? [t('lake.volSurvey'), `${num(l.survey, 2)} ${lang === 'ne' ? 'दस लाख घन मि.' : 'million m³'}`]
    : l.volSrc === 'area' ? [t('lake.volArea'), `${num(l.vol[0], l.vol[1] < 10 ? 2 : 0)}–${num(l.vol[1], l.vol[1] < 10 ? 2 : 0)} ${lang === 'ne' ? 'दस लाख घन मि.' : 'million m³'}`] : null;
  return fields([[t('lake.rank'), `<span style="color:${LAKE_RANK_COLOR[l.rank]};font-weight:600">${t('lake.rank' + l.rank)}</span>`],
    [t('lake.basin'), lang === 'ne' ? l.basin[1] : l.basin[0]], [t('lake.country'), lang === 'ne' ? l.country[1] : l.country[0]],
    l.area && [t('lake.area'), `${num(l.area, 2)} ${lang === 'ne' ? 'वर्ग कि.मि.' : 'km²'} (Sentinel-2, ${day(l.areaDate)})`], [t('lake.id'), l.id], vol]);
}
export function openLakeScenario(l) { G = { lake: l, vol: l.vol ? l.vol.slice() : null, res: null, t: 0, playing: false, last: 0 }; location.hash = '#/glof'; }

// ---------- river trace (map view) ----------
let RT = null; // { res, t, end, last }
const riverOf = (station) => station.split(/\s+at\s+/i)[0].trim();
let lakeCells = null;
function lakesThrough(cell) {
  if (!state.rivers) return [];
  lakeCells ??= Object.fromEntries(Object.entries(state.rivers.lakes).map(([id, [start, codes]]) => {
    const set = new Set([start]); let i = start % ROUTE.nx, j = Math.floor(start / ROUTE.nx);
    for (const c of codes) { i += D8[c - 1][0]; j += D8[c - 1][1]; set.add(j * ROUTE.nx + i); }
    return [id, set];
  }));
  const near = []; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) near.push(cell + dj * ROUTE.nx + di);
  return LAKES.filter((l) => near.some((c) => lakeCells[l.id]?.has(c))).sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
}
async function traceRiver(el, ll, live) {
  el.innerHTML = `<div class="callout"><p class="note">${t('loading')}</p></div>`;
  const grid = await routeFor(ll); await lakesReady; if (!live()) return;
  const path = js.tracePath(grid, ...ll); // follows the river to where it leaves Nepal
  const cell = Math.floor((30.5 - ll[1]) / ROUTE.step) * ROUTE.nx + Math.floor((ll[0] - 79.9) / ROUTE.step);
  // a gauge counts only if its nearest mapped river cell lies on this path (gauges just up a tributary do not)
  const onPath = new Map(), pathCells = path.map((q) => Math.floor((30.5 - q.ll[1]) / ROUTE.step) * ROUTE.nx + Math.floor((q.ll[0] - 79.9) / ROUTE.step));
  pathCells.forEach((c, k) => onPath.set(c, path[k].km));
  const gauges = [];
  for (const r of state.latest.rivers) {
    const ci = Math.floor((r.ll[0] - 79.9) / ROUTE.step), cj = Math.floor((30.5 - r.ll[1]) / ROUTE.step); let best = null, bd = 9;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const c = (cj + dj) * ROUTE.nx + ci + di, d = di * di + dj * dj; if (d < bd && (onPath.has(c) || state.rivers?.cellReach.has(c))) { bd = d; best = c; } }
    if (best != null && onPath.has(best)) gauges.push({ r, km: onPath.get(best) });
  }
  gauges.sort((a, b) => a.km - b.km);
  const names = [...new Set(gauges.map((g) => riverOf(g.r.name)))];
  const near = placesAlong(path).filter((x) => x.p.t === 'm').slice(0, 8);
  const lakes = lakesThrough(cell), end = path.at(-1);
  el.innerHTML = `<div class="callout scenario" style="--sel:${SCENARIO.ink}">
    <h3>${names.length ? esc(names[0]) : t('river.unnamed')}</h3>
    ${fields([[t('river.length'), `${num(end.km)} ${t('km')}`], [t('river.drop'), `${num(path[0].z)} ${t('m')} ${t('river.to')} ${num(end.z)} ${t('m')}`],
      names.length > 1 && [t('river.becomes'), names.map(esc).join(', ')], near.length && [t('river.near'), near.map((x) => esc(name(x.p))).join(', ')]])}
    <h3>${t('river.gauges')}</h3>
    ${gauges.length ? `<ul class="list">${gauges.map((g) => riverRow(g.r)).join('')}</ul>` : `<p class="note">${t('river.noGauges')}</p>`}
    <h3>${t('river.lakesUp')}</h3>
    ${lakes.length ? `<p class="note">${t('river.lakesNote')}</p><ul class="list lakes">${lakes.map((l) => `<li><button type="button" class="linkish" data-lake="${l.id}">${esc(name(l))}</button><span class="val" style="color:${LAKE_RANK_COLOR[l.rank]}">${l.rank}</span><span class="sub"><span>${esc(lang === 'ne' ? l.basin[1] : l.basin[0])}</span><span>${esc(lang === 'ne' ? l.country[1] : l.country[0])}</span></span></li>`).join('')}</ul>` : `<p class="note">${t('river.noLakes')}</p>`}
    <p class="note">${t('river.ends')}</p></div>`;
  el.querySelectorAll('[data-lake]').forEach((b) => (b.onclick = () => openLakeScenario(LAKES.find((l) => l.id === b.dataset.lake))));
  RT = { t: 0, last: 0 };
  map.clearPath(); map.setTrace(path.map((q) => q.ll)); map.setMarker(ll, SCENARIO.ink);
  map.flyTo(...path[Math.floor(path.length / 2)].ll, Math.min(520, 80 + end.km * 0.9));
}

// ---------- MAP ----------
const mapView = {
  async enter(el, live) {
    el.innerHTML = `<h1>${t('title')}</h1><p class="lead">${t('loading')}</p>`;
    await dataReady; if (!live()) return;
    showChips(true); map.clearPath(); map.clearShaking();
    const L = state.latest, high = L.rivers.filter((r) => r.status && r.status !== 'BELOW WARNING LEVEL');
    el.innerHTML = `<h1>${t('title')}</h1><p class="lead">${t('mapLead')} ${t('river.tap')}</p>
      <div id="sel"></div>
      ${feedCards()}
      <h2>${t('aboveWarn')}</h2>
      ${high.length ? `<ul class="list">${high.map(riverRow).join('')}</ul>` : `<p class="note">${t('noneAbove')}</p>`}
      <nav class="actions noprint"><a href="#/glof">${t('tryGlof')}${arrow}</a><a href="#/quake">${t('tryQuake')}${arrow}</a><a href="#/data">${t('allData')}${arrow}</a></nav>`;
  },
  onPick({ layer, item, ground }, live = () => true) {
    const el = document.getElementById('sel'); if (!el) return;
    // a river, or any spot on the ground: follow the water downstream from there
    if (layer === 'network' || ground) return traceRiver(el, ground || item.ll, () => live() && state.view === mapView);
    RT = null; map.clearTrace();
    if (layer === 'lakes') {
      map.setMarker(item.ll, LAKE_RANK_COLOR[item.rank]);
      el.innerHTML = `<div class="callout" style="--sel:${LAKE_RANK_COLOR[item.rank]}"><h3>${esc(name(item))}</h3>${lakeFacts(item)}<p><button class="btn" type="button" id="lakego">${t('lake.scenario')}</button></p></div>`;
      el.querySelector('#lakego').onclick = () => openLakeScenario(item);
      return;
    }
    map.setMarker(item.ll, LAYER_COLOR[layer]);
    el.innerHTML = `<div class="callout" style="--sel:${LAYER_COLOR[layer]}">${layer === 'rivers' ? riverCard(item) : layer === 'rain' ? rainCard(item) : layer === 'quakes' ? quakeCard(item) : incidentCard(item)}${layer === 'rivers' ? `<p><button class="btn ghost" type="button" id="tracego">${t('river.traceBtn')}</button></p>` : ''}</div>`;
    el.querySelector('#tracego')?.addEventListener('click', () => traceRiver(el, item.ll, () => live() && state.view === mapView));
  },
  onFrame(now) {
    if (!RT || RT.t >= 1) return false;
    RT.t = REDUCED ? 1 : Math.min(1, RT.t + (now - (RT.last || now)) / 1800); RT.last = now; // draw the whole course in 1.8 s
    map.setTraceProgress(1 - (1 - RT.t) ** 2);
    return true;
  },
  leave() { RT = null; map.clearTrace(); map.hideMarker(); },
};
const lvlClass = (r) => (r.status === 'DANGER LEVEL' ? 'lvl-danger' : r.status === 'WARNING LEVEL' ? 'lvl-warn' : '');
const riverRow = (r) => `<li><span>${esc(r.name)}</span><span class="val ${lvlClass(r)}">${num(r.level, 2)} ${t('m')}</span><span class="sub"><span class="${lvlClass(r)}">${esc(t('status.' + r.status))}</span><span>${t('warn')} ${num(r.warn, 1)} ${t('m')}</span>${r.danger != null ? `<span>${t('danger')} ${num(r.danger, 1)} ${t('m')}</span>` : ''}<span>${age(r.at)}</span></span></li>`;
const fields = (rows) => `<dl>${rows.filter(Boolean).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
const riverCard = (r) => `<h3>${esc(r.name)}</h3>${fields([[t('level'), `<b class="${lvlClass(r)}">${num(r.level, 2)} ${t('m')}</b>`], [t('status2'), `<span class="${lvlClass(r)}">${esc(t('status.' + r.status))}</span>`], r.trend && [t('trendL'), esc(t('trend.' + r.trend))], r.warn != null && [t('warn'), `${num(r.warn, 1)} ${t('m')}`], r.danger != null && [t('danger'), `${num(r.danger, 1)} ${t('m')}`], [t('newest'), `${when(r.at)}, ${age(r.at)}`], [t('source'), t('origin.DHM via BIPAD')]])}`;
const rainCard = (r) => `<h3>${esc(r.name)}</h3>${fields([[t('rain1'), `<b>${num(r.h1, 1)} ${t('mm')}</b>`], [t('rain24'), `<b>${num(r.h24, 1)} ${t('mm')}</b>`], [t('newest'), `${when(r.at)}, ${age(r.at)}`], [t('source'), t('origin.DHM via BIPAD')]])}`;
const quakeCard = (q) => `<h3>${esc(q.place)}</h3>${fields([[t('mag'), `<b>${num(q.mag, 1)}</b>`], [t('newest'), `${when(q.at)}, ${age(q.at)}`], [t('source'), t('origin.NEMRC via BIPAD')]])}`;
const incidentCard = (i) => `<h3>${esc(lang === 'ne' && i.titleNe ? i.titleNe : i.title)}</h3>${fields([[t('status2'), t('hazard.' + i.hazard) + (i.verified ? `, ${t('verified')}` : '')], [t('newest'), `${when(i.at)}, ${age(i.at)}`], [t('source'), 'BIPAD']])}`;

// ---------- DATA ----------
let archiveMonths = null;
// River basins as DHM names them (the source spells some differently: "Babai Basin", "mahakali", none).
const BASIN_NE = { Koshi: 'कोशी', Narayani: 'नारायणी', Karnali: 'कर्णाली', Bagmati: 'बागमती', Mahakali: 'महाकाली', 'West Rapti': 'पश्चिम राप्ती', Babai: 'बबई', Kamala: 'कमला', Kankai: 'कन्काई', Mechi: 'मेची', Bheri: 'भेरी', Tinau: 'तिनाउ', Mohana: 'मोहना', Banganga: 'बाणगंगा', Keshaliya: 'केशलिया', Lalbakaiya: 'लालबकैया', Ratu: 'रातु', 'Balan-Khado': 'बलान-खाँडो' };
const basinOf = (r) => { const b = (r.basin || '').replace(/\s+basin$/i, '').trim(), k = Object.keys(BASIN_NE).find((x) => x.toLowerCase() === b.toLowerCase()); return k || null; };
// a gauge bar: level against the warning (and danger) marks
function gauge(r) {
  if (r.warn == null && r.danger == null) return ''; // nothing to compare against: no bar
  const top = (r.danger ?? (r.warn ?? 1) * 1.25) * 1.15, pc = (v) => Math.max(0, Math.min(100, (v / top) * 100)).toFixed(1);
  return `<span class="gauge ${lvlClass(r)}" aria-hidden="true"><i style="width:${pc(r.level ?? 0)}%"></i>${r.warn != null ? `<b class="w" style="left:${pc(r.warn)}%"></b>` : ''}${r.danger != null ? `<b class="d" style="left:${pc(r.danger)}%"></b>` : ''}</span>`;
}
const gaugeRow = (r) => `<li class="g"><span>${esc(r.name)}</span><span class="val ${lvlClass(r)}">${num(r.level, 2)} ${t('m')}</span>${gauge(r)}<span class="sub">${r.status !== 'BELOW WARNING LEVEL' ? `<span class="${lvlClass(r)}">${esc(t('status.' + r.status))}</span>` : ''}${r.warn != null ? `<span>${t('glance.ofWarn')} ${num(r.warn, 1)} ${t('m')}</span>` : ''}${r.danger != null ? `<span>${t('glance.ofDanger')} ${num(r.danger, 1)} ${t('m')}</span>` : ''}${r.warn == null && r.danger == null ? `<span>${t('glance.noLevels')}</span>` : ''}</span></li>`;
// fixed scale so a drizzle never looks like a downpour: 100 mm in 24 h fills the bar (or the day's maximum, if higher)
const rainRow = (max) => (r) => `<li class="g"><span>${esc(r.name)}</span><span class="val">${num(r.h24, 1)} ${t('mm')}</span><span class="gauge rain" aria-hidden="true"><i style="width:${((r.h24 / Math.max(100, max)) * 100).toFixed(1)}%"></i></span>${r.h1 > 0 ? `<span class="sub"><span>${t('rain1')} ${num(r.h1, 1)} ${t('mm')}</span></span>` : ''}</li>`;
const quakeRow = (q) => `<li><span>${esc(q.place)}</span><span class="tag">M ${num(q.mag, 1)}</span><span class="sub"><span>${when(q.at)}</span></span></li>`;
// BIPAD sometimes files the same place and date twice: show one row with the number of reports
const incidentRow = (i) => `<li data-n="${i.n || 1}"><span>${esc(lang === 'ne' && i.titleNe ? i.titleNe : i.title)}</span><span class="tag">${t('hazard.' + i.hazard)}</span><span class="sub"><span>${/T00:00:00/.test(i.at) ? day(i.at) : when(i.at)}</span>${i.n > 1 ? `<span>${tf('glance.reports', num(i.n))}</span>` : ''}</span></li>`;
function mergeSame(rows) { const out = [], seen = new Map(); for (const x of rows) { const k = `${x.hazard}|${x.title}|${x.at}`; if (seen.has(k)) seen.get(k).n++; else { const y = { ...x, n: 1 }; seen.set(k, y); out.push(y); } } return out; }
const byMonth = (rows, fmt) => { let out = '', cur = null; for (const x of rows) { const m = x.at.slice(0, 7); if (m !== cur) { out += `${cur ? '</ul>' : ''}<h3 class="month">${monthYear(x.at)}</h3><ul class="list">`; cur = m; } out += fmt(x); } return out + (cur ? '</ul>' : ''); };

function glance() {
  const L = state.latest, now = Date.now(), alerts = L.rivers.filter((r) => r.status && r.status !== 'BELOW WARNING LEVEL');
  const wet = L.rain.filter((r) => r.h24 > 0).sort((a, b) => b.h24 - a.h24), dry = L.rain.length - wet.length, q = L.quakes[0];
  const recent = L.incidents.filter((i) => now - Date.parse(i.at) < 30 * 864e5).length;
  const row = (cls, k, text) => `<li class="${cls}"><span class="k">${t('glance.' + k)}</span><span>${text}</span></li>`;
  return `<section class="glance" aria-labelledby="gl-h"><h2 id="gl-h">${t('glance.h')}</h2><ul>
    ${row(alerts.some((r) => r.status === 'DANGER LEVEL') ? 'danger' : alerts.length ? 'warn' : 'ok', 'rivers', alerts.length ? `${tf('glance.someAbove', num(alerts.length))} ${alerts.map((r) => esc(r.name)).join(', ')}` : tf('glance.allBelow', num(L.rivers.length)))}
    ${row('', 'rain', wet.length ? `${tf('glance.wettest', num(wet[0].h24, 1), esc(wet[0].name))} ${tf('glance.dry', num(dry), num(L.rain.length))}` : t('glance.noRain'))}
    ${q ? row('', 'quakes', tf('glance.lastQuake', num(q.mag, 1), esc(q.place), age(q.at, now))) : ''}
    ${L.incidents[0] ? row('', 'incidents', tf('glance.lastReport', age(L.incidents[0].at, now), num(recent))) : ''}
  </ul></section>`;
}

const dataView = {
  full: true,
  async enter(el, live) {
    el.innerHTML = `<h1>${t('nav.data')}</h1><p class="lead">${t('loading')}</p>`;
    await dataReady; if (!live()) return;
    const tab = location.hash.split('/')[2] || 'rivers', L = state.latest, S = L.sources[tab] || {};
    const counts = { rivers: L.rivers.length, rain: L.rain.length, quakes: L.quakes.length, incidents: L.incidents.length };
    el.innerHTML = `<h1>${t('nav.data')}</h1>${printBlock('')}${glance()}
      <div class="tabs" role="tablist">${['rivers', 'rain', 'quakes', 'incidents'].map((k) => `<button role="tab" aria-selected="${k === tab}" data-k="${k}">${t('feeds.' + k)} <span class="count">${num(counts[k])}</span></button>`).join('')}</div>
      <p class="feedline">${S.ok === false ? `<span class="state err">${t('failed')}</span> ` : ''}${tf('glance.updated', age(S.newest), esc(t('origin.' + S.origin)))}${S.expect_h ? '' : ` ${t('quakeAgeNote')}`}</p>
      <input class="filter" type="search" placeholder="${t('filter')}" aria-label="${t('filter')}">
      <div id="rows"></div><p class="row noprint" id="more"></p>
      <p class="noprint"><button class="btn ghost" type="button" id="pr">${t('print')}</button></p>`;
    el.querySelector('.tabs').onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) location.hash = '#/data/' + b.dataset.k; };
    el.querySelector('#pr').onclick = doPrint;
    let all = { rivers: L.rivers, rain: L.rain, quakes: L.quakes, incidents: L.incidents }[tab].slice();
    const box = el.querySelector('#rows'), filter = el.querySelector('.filter');
    const match = (x, q) => !q || (x.name || x.place || x.title || '').toLowerCase().includes(q) || (x.titleNe || '').includes(q);
    const draw = () => {
      const q = filter.value.trim().toLowerCase(), rows = all.filter((x) => match(x, q));
      if (tab === 'rivers') {
        const alerts = rows.filter((r) => r.status && r.status !== 'BELOW WARNING LEVEL'), rest = rows.filter((r) => !alerts.includes(r));
        if (q) { box.innerHTML = `<ul class="list">${rows.map(gaugeRow).join('')}</ul>`; return; } // searching: one flat list
        const groups = {}; for (const r of rest) (groups[basinOf(r) || ''] ??= []).push(r);
        const names = Object.keys(groups).sort((a, b) => (!a) - (!b) || groups[b].length - groups[a].length);
        box.innerHTML = `${alerts.length ? `<h3 class="month">${t('glance.alerts')}</h3><ul class="list">${alerts.map(gaugeRow).join('')}</ul>` : ''}
          <p class="note">${t('glance.basinsNote')}</p>
          ${names.map((b) => `<details class="group"><summary><span>${b ? esc(lang === 'ne' ? BASIN_NE[b] : b) : t('glance.other')}</span><span class="count">${tf('glance.gauges', num(groups[b].length))}</span></summary><ul class="list">${groups[b].map(gaugeRow).join('')}</ul></details>`).join('')}`;
      } else if (tab === 'rain') {
        const wet = rows.filter((r) => r.h24 > 0).sort((a, b) => b.h24 - a.h24), dry = rows.filter((r) => !(r.h24 > 0)), row = rainRow(wet[0]?.h24 || 0);
        box.innerHTML = `<ul class="list">${wet.map(row).join('')}</ul>${dry.length ? `<details class="group"${q ? ' open' : ''}><summary><span>${tf('glance.noRainList', num(dry.length))}</span></summary><ul class="list">${dry.map(row).join('')}</ul></details>` : ''}`;
      } else box.innerHTML = tab === 'quakes' ? byMonth(rows, quakeRow) : byMonth(mergeSame(rows), incidentRow);
    };
    filter.oninput = draw; draw();
    if (tab === 'quakes' || tab === 'incidents') {
      const more = el.querySelector('#more');
      archiveMonths ??= fetch('data/archive/index.json').then((r) => r.json()).then((j) => Object.entries(j.months).sort((a, b) => (a[0] < b[0] ? 1 : -1)));
      const months = await archiveMonths; if (!live()) return;
      const oldest = all.length ? all.at(-1).at.slice(0, 7) : '9999';
      let mi = months.findIndex(([m]) => m <= oldest); // include the boundary month: it can hold older rows too (dedupe by id below)
      const btn = () => { more.innerHTML = mi >= 0 && mi < months.length ? `<button class="btn ghost" type="button">${t('loadOlder')}</button>` : `<span class="note">${t('noOlder')}</span>`; };
      more.onclick = async (e) => {
        if (!e.target.closest('button')) return;
        more.innerHTML = `<span class="note">${t('loading')}</span>`;
        // the index knows each month's row count: pick enough months for 20+ rows, fetch them in parallel
        const pick = []; let n = 0;
        while (mi >= 0 && mi < months.length && n < 20) { if (months[mi][1][tab] > 0) { pick.push(months[mi][0]); n += months[mi][1][tab]; } mi++; }
        const got = await Promise.all(pick.map((m) => fetch(`data/archive/${m}.json`).then((r) => r.json())));
        const have = new Set(all.map((x) => x.id));
        for (const g of got) for (const x of g[tab]) if (!have.has(x.id)) { have.add(x.id); all.push(x); }
        all.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id - a.id);
        draw(); btn();
      };
      btn();
    }
  },
};

// ---------- GLOF ----------
let G = null; // scenario state
const glofView = {
  hideLayers: true, layers: ['lakes', 'network'],
  async enter(el, live) {
    showChips(false, this.layers); map.clearShaking();
    await lakesReady; if (!live()) return;
    const first = LAKES.find((l) => l.en === 'Tsho Rolpa');
    G ??= { lake: first, vol: first.vol.slice(), res: null, t: 0, playing: false, last: 0 };
    el.innerHTML = `<h1>${t('glof.h')}</h1><p class="lead">${t('glof.lead')}</p>
      <div class="noprint">
        <div class="row"><label class="f">${t('glof.lake')}<select id="lake">${lakeOptions()}</select></label></div>
        <p class="note">${t('glof.tap')} <span id="hint" class="hint"></span></p>
        <div id="lakefacts" class="lakefacts"></div>
        <p class="field-label" style="margin:16px 0 0"><label for="v0">${t('glof.volume')}</label></p>
        <div class="row" style="margin-top:2px"><label class="f">${t('glof.from')}<input id="v0" type="number" min="0.1" max="500" step="0.1" inputmode="decimal"></label>
        <label class="f">${t('glof.to')}<input id="v1" type="number" min="0.1" max="500" step="0.1" inputmode="decimal"></label></div>
        <p class="note" id="volnote"></p>
        <div class="row"><button class="btn" id="run" type="button">${t('glof.run')}</button></div>
        <p class="note">${t('lake.source')}</p>
      </div>
      <div id="out"></div>`;
    const sel = el.querySelector('#lake'), v0 = el.querySelector('#v0'), v1 = el.querySelector('#v1');
    const showLake = () => {
      sel.value = G.lake.id; v0.value = G.vol ? G.vol[0] : ''; v1.value = G.vol ? G.vol[1] : '';
      el.querySelector('#lakefacts').innerHTML = lakeFacts(G.lake);
      el.querySelector('#volnote').textContent = G.lake.volSrc === 'survey' ? (lang === 'ne' ? 'पूर्वनिर्धारित दायरा: सर्वेक्षण गरिएको आयतनको आधादेखि पूरै।' : 'Default range: half to all of the surveyed volume.')
        : G.lake.frozen ? t('lake.frozenNote')
        : G.lake.volSrc === 'area' ? (lang === 'ne' ? 'पूर्वनिर्धारित दायरा: स्याटेलाइटबाट नापिएको क्षेत्रफलबाट अनुमान (Huggel र अन्य २००२) को ०.७ देखि १.५ गुणा। आफू चाहे बदल्न सक्नुहुन्छ।' : 'Default range: 0.7 to 1.5 times the estimate from the satellite-measured area (Huggel et al. 2002). You can change it.') + (G.lake.area > 2 ? ' ' + t('lake.bigNote') : '') : t('lake.volNone');
    };
    G.select = (l) => { G.lake = l; G.vol = l.vol ? l.vol.slice() : null; showLake(); map.setMarker(l.ll, LAKE_RANK_COLOR[l.rank]); map.flyTo(...l.ll, 200); routeFor(l.ll); };
    sel.onchange = () => G.select(LAKES.find((x) => x.id === sel.value));
    el.querySelector('#run').onclick = () => {
      if (!(+v0.value > 0) || !(+v1.value > 0)) { el.querySelector('#volnote').textContent = t('lake.needVol'); v0.focus(); return; }
      const a = Math.max(0.1, +v0.value), b = Math.max(a, +v1.value); G.vol = [a, b]; v0.value = a; v1.value = b; run(el, live);
    };
    showLake();
    routeFor(G.lake.ll);
    await dataReady; if (!live()) return;
    if (G.res) showResult(el);
    await mapReady; if (!live()) return;
    map.setMarker(G.lake.ll, LAKE_RANK_COLOR[G.lake.rank]);
    if (G.res) { map.setPath(G.res); map.setPathTime(G.t); syncFronts(); } else map.flyTo(...G.lake.ll, 200); // start loading this lake's tiles while the user reads
  },
  // only the ICIMOD lakes can be chosen: a tap elsewhere just points to the circles
  onPick({ layer, item }) {
    if (layer === 'lakes') return G.select(item);
    const h = document.getElementById('hint'); if (!h) return;
    h.textContent = t('lake.pickLake'); h.classList.remove('flash'); void h.offsetWidth; h.classList.add('flash');
  },
  onPlace(p) { if (p.t === 'l') { const l = LAKES.find((x) => x.id === p.id); if (l) G.select(l); } },
  onFrame(now) {
    if (!G?.playing || !G.res) return false;
    const dt = Math.min(0.1, (now - (G.last || now)) / 1000); G.last = now;
    const end = G.res.at(-1).arrivalH[1];
    G.t = Math.min(end, G.t + dt * Math.max(end, 0.5) / 12); // whole run in ~12 s
    map.setPathTime(G.t); syncTime(); syncFronts();
    if (G.t >= end) { G.playing = false; syncPlay(); }
    return true;
  },
  leave() { if (G) G.playing = false; map.hideMarker(); map.hideFronts(); },
};
// where each front is at time G.t: last path point the earliest / latest arrival has reached
function frontAt(k) {
  const res = G.res; if (!res || G.t <= 0) return null;
  let i = 0; while (i + 1 < res.length && res[i + 1].arrivalH[k] <= G.t) i++;
  if (i + 1 >= res.length) return res.at(-1).ll;
  const a = res[i], b = res[i + 1], f = Math.min(1, Math.max(0, (G.t - a.arrivalH[k]) / Math.max(1e-6, b.arrivalH[k] - a.arrivalH[k])));
  return [a.ll[0] + (b.ll[0] - a.ll[0]) * f, a.ll[1] + (b.ll[1] - a.ll[1]) * f];
}
const syncFronts = () => map.setFronts(frontAt(0), frontAt(1));
async function run(el, live) {
  const out = el.querySelector('#out'); out.innerHTML = `<p class="note">${t('loading')}</p>`;
  const r = await routeFor(G.lake.ll), w = await engine(); await dataReady; if (!live()) return;
  G.res = w ? w.glof(...G.lake.ll, G.vol) : js.glof(js.tracePath(r, ...G.lake.ll), G.vol);
  G.t = 0; G.playing = true; G.last = 0;
  showResult(el);
  mapReady.then(() => { if (!live()) return; map.setPath(G.res); map.setPathTime(0); syncFronts(); const mid = G.res[Math.floor(G.res.length / 2)]; map.flyTo(...mid.ll, Math.min(420, 60 + G.res.at(-1).km * 0.9)); });
  performance.mark('glof-result');
}
function placesAlong(res) {
  const out = [], seen = new Set();
  for (const p of state.places) {
    if (p.t !== 'm' && p.t !== 's') continue;
    const lim = p.t === 'm' ? 5 : 1.5; let best = null, bd = lim;
    for (const q of res) { const d = Math.hypot((q.ll[0] - p.ll[0]) * 98, (q.ll[1] - p.ll[1]) * 111.32); if (d < bd) { bd = d; best = q; } }
    if (best && !seen.has(p.en)) { seen.add(p.en); out.push({ p, q: best }); }
  }
  out.push({ p: { en: 'Nepal border', ne: 'नेपालको सिमाना', t: 'end' }, q: res.at(-1) });
  return out.sort((a, b) => a.q.km - b.q.km);
}
function syncTime() { const o = document.getElementById('tout'), s = document.getElementById('tslider'); if (o) o.textContent = fmtH(G.t); if (s) { s.value = G.t; fill(s); } }
function syncPlay() { const b = document.getElementById('play'); if (b) b.textContent = G.playing ? t('glof.pause') : t('glof.play'); }
function showResult(el) {
  const res = G.res, out = el.querySelector('#out'), end = res.at(-1).arrivalH[1], A = js.ASSUMPTIONS.glof;
  const rows = placesAlong(res);
  out.innerHTML = `${printBlock(`<p><b>${t('glof.lake')}:</b> ${esc(name(G.lake))}. <b>${t('glof.volume')}:</b> ${num(G.vol[0], 1)}–${num(G.vol[1], 1)}</p>`)}
    <h2>${t('glof.result')}</h2>
    <div class="timeline noprint"><button class="btn ghost" id="play" type="button"></button>
      <input id="tslider" type="range" min="0" max="${end}" step="any" aria-label="${t('glof.time')}"><output id="tout"></output></div>
    <p class="fronts noprint"><span style="--c:${SCENARIO.ink}">${lang === 'ne' ? 'छिटो आइपुग्ने अग्रभाग' : 'Earliest front'}</span><span style="--c:${SCENARIO.late};--o:${SCENARIO.ink}">${lang === 'ne' ? 'ढिलो आइपुग्ने अग्रभाग' : 'Latest front'}</span></p>
    <div class="tw"><table><thead><tr><th>${t('glof.place')}</th><th>${t('glof.dist')}</th><th>${t('glof.arrival')}</th><th>${t('glof.peak')}</th><th>${t('glof.depth')}</th></tr></thead>
    <tbody>${rows.map(({ p, q }) => `<tr><td>${esc(name(p))}${q.z < js.PLAINS_M ? ' *' : ''}</td><td class="n">${num(q.km)} ${t('km')}</td><td>${fmtH(q.arrivalH[0])} – ${fmtH(q.arrivalH[1])}</td><td class="n">${num(Math.round(q.peak[0] / 10) * 10)} – ${num(Math.round(q.peak[1] / 10) * 10)}</td><td class="n">${num(q.depth[0], 1)} – ${num(q.depth[1], 1)}</td></tr>`).join('')}</tbody></table></div>
    <p class="note">${t('glof.ends')}</p>
    <h3>${t('assumptions')}</h3>
    <ul class="note"><li>${A.peakLow}; ${A.peakHigh}</li><li>Manning n ${A.manningN.join('–')}; width = (${A.widthCoef.join('–')})·√Q; peak decay length ${A.attenuationKm.join('–')} km; flood front ≤ ${A.maxCelerity} m/s</li>
    <li>${lang === 'ne' ? 'स्थानीय तहको केन्द्रबिन्दु बाटोबाट ५ कि.मि. भित्र भए मात्र तालिकामा देखिन्छ।' : 'A local level is listed when its centre is within 5 km of the path.'}</li></ul>
    <p class="noprint"><button class="btn ghost" type="button" id="pr">${t('print')}</button></p>`;
  out.querySelector('#pr').onclick = doPrint;
  out.querySelector('#play').onclick = () => { if (G.t >= end) G.t = 0; G.playing = !G.playing; G.last = 0; syncPlay(); };
  out.querySelector('#tslider').oninput = (e) => { G.t = +e.target.value; G.playing = false; syncPlay(); map.setPathTime(G.t); syncTime(); syncFronts(); };
  syncPlay(); syncTime();
}

// ---------- EARTHQUAKE ----------
let Q = null;
const quakeView = {
  hideLayers: true,
  async enter(el, live) {
    showChips(false, []); map.clearPath();
    Q ??= { M: 7.8, strike: 290, ll: [84.731, 28.231], label: { en: '2015 Gorkha epicentre (Barpak)', ne: '२०७२ गोरखा भूकम्पको केन्द्र (बारपाक)' }, r: 0, animating: false };
    el.innerHTML = `<h1>${t('quake.h')}</h1><p class="lead">${t('quake.lead')}</p>
      <div class="noprint">
        <dl class="callout scenario" style="--sel:${SCENARIO.ink};animation:none"><dt>${t('quake.epi')}</dt><dd id="epi"></dd></dl><p class="note">${t('quake.tap')}</p>
        <label for="M" class="field-label">${t('quake.mag')} <output id="mo"></output></label><input id="M" type="range" min="5" max="8.6" step="0.1">
        <div class="row"><label class="f">${t('quake.strike')}<input id="S" type="number" min="0" max="359" step="5" inputmode="numeric"></label>
        <button class="btn" id="go" type="button">${t('quake.replay')}</button></div>
      </div>
      <div id="out"></div>`;
    const M = el.querySelector('#M'), S = el.querySelector('#S');
    M.value = Q.M; S.value = Q.strike; fill(M);
    M.oninput = () => { Q.M = +M.value; fill(M); update(false); };
    S.onchange = () => { Q.strike = ((+S.value % 360) + 360) % 360; update(false); };
    el.querySelector('#go').onclick = () => update(true);
    legend();
    mapReady.then(() => live() && map.flyTo(...Q.ll, 420));
    await Promise.all([engine(), dataReady]); if (!live()) return;
    update(true);
  },
  onPick({ ground, item }) { const ll = ground || item?.ll; if (!ll) return; Q.ll = ll; Q.label = null; update(true); },
  onPlace(p) { Q.ll = p.ll; Q.label = p; update(true); },
  onFrame(now) {
    if (!Q?.animating) return false;
    Q.r = Math.min(800, Q.r + (now - (Q.last || now)) * 0.2); Q.last = now; // 200 km/s on screen (real S-waves ≈ 3.5 km/s)
    map.setShakeRadius(Q.r); if (Q.r >= 800) Q.animating = false;
    return true;
  },
  leave() { if (Q) Q.animating = false; map.clearShaking(); map.hideMarker(); },
};
let pending = false;
async function update(animate) {
  const w = await engine();
  if (pending) return; pending = true;
  requestAnimationFrame(() => {
    pending = false;
    const q = { M: Q.M, ll: Q.ll, strike: Q.strike }, grid = w ? w.shakingGrid(q, VIEW) : js.shakingGrid(q, VIEW);
    const half = js.ruptureKm(Q.M) / 2, th = (Q.strike * Math.PI) / 180, kx = 111.32 * Math.cos((Q.ll[1] * Math.PI) / 180);
    const a = [Q.ll[0] - (Math.sin(th) * half) / kx, Q.ll[1] - (Math.cos(th) * half) / 111.32], b = [Q.ll[0] + (Math.sin(th) * half) / kx, Q.ll[1] + (Math.cos(th) * half) / 111.32];
    renderQuakeTable();
    mapReady.then(() => {
      map.setShaking(grid, a, b); map.setMarker(Q.ll, SCENARIO.ink);
      if (animate) { Q.r = 0; Q.last = 0; Q.animating = true; } else map.setShakeRadius((Q.r = 800));
    });
    performance.mark('quake-shaking');
  });
}
function renderQuakeTable() {
  const el = document.getElementById('out'); if (!el) return;
  document.getElementById('mo').textContent = num(Q.M, 1);
  document.getElementById('epi').textContent = Q.label ? name(Q.label) : `${num(Q.ll[1], 3)}°N, ${num(Q.ll[0], 3)}°E`;
  const dist = state.places.filter((p) => p.t === 'd').map((d) => ({ d, b: js.shakingAt(Q, ...d.ll) })).sort((x, y) => y.b[1] - x.b[1]);
  const A = js.ASSUMPTIONS.quake;
  el.innerHTML = `${printBlock(`<p><b>${t('quake.epi')}:</b> ${Q.label ? esc(name(Q.label)) : ''} ${Q.ll[1].toFixed(3)}°N ${Q.ll[0].toFixed(3)}°E. <b>${t('quake.mag')}:</b> ${num(Q.M, 1)}. <b>${t('quake.strike')}:</b> ${num(Q.strike)}</p>`)}
    <h2>${t('quake.result')}</h2>
    <table><thead><tr><th>${t('quake.district')}</th><th>${t('quake.band')}</th><th></th></tr></thead><tbody>
    ${dist.map(({ d, b }) => `<tr><td>${esc(name(d))}</td><td class="n">${mmiBand(b[0], b[2])}</td><td>${mmiWord(b[1])}</td></tr>`).join('')}</tbody></table>
    <h3>${t('assumptions')}</h3><ul class="note"><li>${A.model}</li><li>${A.rupture}: ${num(js.ruptureKm(Q.M))} ${t('km')}</li><li>±${A.spread} ${lang === 'ne' ? 'तीव्रता तह अनिश्चितता (अनुमानित)' : 'intensity level model spread (assumed)'}; ${lang === 'ne' ? 'माटो र उपत्यकाको प्रभाव समावेश छैन' : 'soil and basin effects not included'}</li></ul>
    <p class="noprint"><button class="btn ghost" type="button" id="pr">${t('print')}</button></p>`;
  el.querySelector('#pr').onclick = doPrint;
}

// ---------- ABOUT ----------
const aboutView = {
  full: true,
  async enter(el, live) {
    await dataReady; if (!live()) return;
    const S = state.latest.sources, ne = lang === 'ne';
    el.innerHTML = `<div class="prose"><h1>${t('about')}</h1>
    <p class="lead">${t('disclaimer')}</p>
    ${feedCards()}
    <h2>${t('sources')}</h2>
    <ul>
      <li>${ne ? 'नदी र वर्षा: जल तथा मौसम विज्ञान विभाग' : 'Rivers and rain: Department of Hydrology and Meteorology (DHM)'}: <a href="https://www.hydrology.gov.np" rel="noopener">hydrology.gov.np</a>, ${ne ? 'बिपद पोर्टलको सार्वजनिक API मार्फत' : 'copied through the public BIPAD API'}.</li>
      <li>${ne ? 'भूकम्प: राष्ट्रिय भूकम्प मापन तथा अनुसन्धान केन्द्र' : 'Earthquakes: National Earthquake Monitoring and Research Center (NEMRC)'}: <a href="https://www.seismonepal.gov.np" rel="noopener">seismonepal.gov.np</a>, ${ne ? 'बिपद पोर्टल मार्फत' : 'via BIPAD'}. ${S.nemrc_site && !S.nemrc_site.ok ? (ne ? 'NEMRC को आफ्नै साइट पछिल्लो जाँचमा पहुँचयोग्य थिएन' : "NEMRC's own site was not reachable at the last check") + ` (${esc(S.nemrc_site.error || S.nemrc_site.status)}, ${when(S.nemrc_site.checked_at)}).` : ''}</li>
      <li>${ne ? 'घटना: बिपद पोर्टल' : 'Incidents: BIPAD portal'}: <a href="https://bipadportal.gov.np" rel="noopener">bipadportal.gov.np</a></li>
      <li>${ne ? 'जिल्लाहरू: नेपालको संविधान, अनुसूची ४ (धारा ५६(३))' : 'Districts: Constitution of Nepal, Schedule 4 (Article 56(3)), as published by the Nepal Law Commission'}. ${PROVINCES.flatMap((p) => p.d).length} ${ne ? 'जिल्ला' : 'districts'}.</li>
      <li>${ne ? 'भू-उचाइ: AWS Terrain Tiles (SRTM र अन्य सार्वजनिक DEM); सीमाना: Natural Earth' : 'Terrain: AWS Terrain Tiles (SRTM and other public elevation data); border: Natural Earth'}.</li>
      <li>${ne ? 'नदीको बहाव दिशा: HydroSHEDS १५″ (Lehner, Verdin र Jarvis, २००८), नक्सांकित नदी रेखासँग मिलाइएको' : 'River flow directions: HydroSHEDS 15″ (Lehner, Verdin & Jarvis 2008), conditioned with mapped river lines'}: <a href="https://www.hydrosheds.org" rel="noopener">hydrosheds.org</a>.</li>
      <li>${ne ? 'हिमताल: ICIMOD (२०२०) का ४७ सम्भावित खतरनाक हिमताल; Tsho Rolpa, Imja र Thulagi को आयतन ICIMOD (२०११) को २००९ सर्वेक्षणबाट; अरूको आयतन Sentinel-2 (ESA Copernicus) बाट नापिएको हालको क्षेत्रफल र Huggel र अन्य (२००२) को सूत्रबाट अनुमान' : 'Glacial lakes: the 47 potentially dangerous lakes in ICIMOD (2020). Volumes: ICIMOD (2011) 2009 bathymetric surveys for Tsho Rolpa, Imja Tsho and Thulagi; for the others, estimated from today’s water area measured on Sentinel-2 imagery (ESA Copernicus) with Huggel et al. (2002), V = 0.104·A^1.42, shown as 0.7–1.5 times the estimate (on the surveyed lakes the formula comes out 0–27% low)'}.</li>
    </ul>
    <h2>${ne ? 'तथ्यांक गुणस्तर जाँच' : 'Data checks'}</h2>
    <p class="note">${ne ? 'स्रोतमा उल्टिएका अक्षांश/देशान्तर सच्याइन्छ, असम्भव स्थान हटाइन्छ:' : 'Swapped latitude/longitude in the source is corrected; impossible locations are dropped:'}
    </p><table><thead><tr><th></th><th>${ne ? 'सच्याइएको' : 'Corrected'}</th><th>${ne ? 'हटाइएको' : 'Dropped'}</th></tr></thead><tbody>
    ${['rivers', 'rain', 'quakes', 'incidents'].map((k) => `<tr><td>${t('feeds.' + k)}</td><td class="n">${num(S[k]?.qc?.swapped || 0)}</td><td class="n">${num(S[k]?.qc?.rejected || 0)}</td></tr>`).join('')}</tbody></table>
    <h2>${t('method')}</h2>
    <p>${ne ? 'हिमताल: डिजिटल उचाइ नक्सा (~५०० मि.) मा पानी बग्ने बाटो पत्ता लगाइन्छ, अनि अनुभवजन्य सूत्र र म्यानिङ समीकरणले छिटो र ढिलो आइपुग्ने समय निकालिन्छ।' : 'Lake burst: the water path follows the steepest descent on a ~500 m elevation grid (pits filled). Peak flow comes from two published empirical formulas (low and high). Travel time uses a kinematic wave with Manning’s equation, run at the fast and slow ends of every uncertain input.'}</p>
    <p>${ne ? 'भूकम्प: Atkinson र Wald (२००७) को तीव्रता समीकरण, फल्टको लम्बाइ Wells र Coppersmith (१९९४) अनुसार।' : 'Earthquake: Atkinson & Wald (2007) intensity equation with distance to a straight rupture whose length follows Wells & Coppersmith (1994).'}</p>
    <p class="note">${ne ? 'यी परिदृश्य जाँचका लागि मात्र हुन्, पूर्वानुमान होइनन्।' : 'These are screening scenarios for learning and planning, not forecasts.'} ${t('disclaimer')}</p></div>`;
  },
};

export const VIEWS = { map: mapView, data: dataView, glof: glofView, quake: quakeView, about: aboutView };
