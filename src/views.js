import { t, num, when, age, name, lang, digits } from './i18n.js';
import { freshness } from './age.js';
import { map } from './map.js';
import { MMI_COLORS } from './colors.js';
import { state, dataReady, mapReady, mapMsg, showChips, riverColor, searchPlaces } from './main.js';
import { LAKES } from './lakes.js';
import { PROVINCES } from './districts.js';
import { VIEW } from './grid.js';
import { makeRouteLoader } from './route-tiles.js';
import * as js from './scenario.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ROMAN = js.ROMAN;

// ---------- shared bits ----------
function feedCards() {
  const S = state.latest.sources, now = Date.now();
  return `<div class="feeds">${['rivers', 'rain', 'quakes', 'incidents'].map((k) => {
    const s = S[k] || {}, f = s.expect_h ? freshness(s.newest, s.expect_h, now) : 'none';
    return `<div class="feed"><b>${t('feeds.' + k)}</b>
      <span class="age">${age(s.newest, now)}</span>
      <small>${t('newest')}: ${when(s.newest)}</small>
      <small>${t('copied')}: ${when(s.fetched_at)} · ${esc(t('origin.' + s.origin))}</small>
      ${s.ok === false ? `<span class="badge err">${t('failed')}</span>` : s.expect_h ? `<span class="badge ${f}">${t(f)}</span>` : `<small>${t('quakeAgeNote')}</small>`}
    </div>`;
  }).join('')}</div>`;
}
const fmtH = (h) => {
  const m = Math.round(h * 60), H = Math.floor(m / 60), M = m % 60;
  return H ? `${num(H)} ${t('hr')} ${digits(String(M).padStart(2, '0'))} ${t('unit.min')}` : `${num(M)} ${t('unit.min')}`;
};
const mmiChip = (m) => `<span class="mmi" style="background:${MMI_COLORS[Math.round(m)]}">${ROMAN[Math.round(m)]}</span>`;
const mmiWord = (m) => { const k = [10, 9, 8, 7, 6, 5, 4, 2].find((x) => Math.round(m) >= x); return t('quake.mmi.' + k); };
function legend() {
  const L = document.getElementById('legend');
  L.innerHTML = `<b>${t('quake.legend')}</b><div class="bar">${[3, 4, 5, 6, 7, 8, 9, 10].map((m) => `<i style="background:${MMI_COLORS[m]}"></i>`).join('')}</div><div class="ticks"><span>III</span><span>V</span><span>VII</span><span>X</span></div>`;
  L.hidden = false;
}
function printBlock(inputsHtml) {
  return `<div class="print-only"><h1>${t('title')}</h1><p>${t('printed')}: ${when(new Date().toISOString())} · ${location.href.split('#')[0]}</p>${inputsHtml}<img class="shot" alt=""></div>`;
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

// ---------- MAP ----------
const mapView = {
  async enter(el, live) {
    el.innerHTML = `<h1>${t('title')}</h1><p class="lead">${t('loading')}</p>`;
    await dataReady; if (!live()) return;
    showChips(true); map.clearPath(); map.clearShaking();
    const L = state.latest, high = L.rivers.filter((r) => r.status && r.status !== 'BELOW WARNING LEVEL');
    el.innerHTML = `<h1>${t('title')}</h1>
      <div id="sel"></div>
      <h2>${t('sources')}</h2>${feedCards()}
      <h2>${t('layers.rivers')}: ${t('status.WARNING LEVEL')} / ${t('status.DANGER LEVEL')}</h2>
      ${high.length ? `<ul class="list">${high.map(riverRow).join('')}</ul>` : `<p class="note">${num(0)} — ${t('status.BELOW WARNING LEVEL')} (${num(L.rivers.length)})</p>`}
      <p class="row noprint"><a class="btn" href="#/glof">${t('nav.glof')}</a> <a class="btn" href="#/quake">${t('nav.quake')}</a> <a class="btn ghost" href="#/data">${t('nav.data')}</a></p>`;
  },
  onPick({ layer, item, ground }) {
    const el = document.getElementById('sel'); if (!el) return;
    if (ground) return;
    map.setMarker(item.ll, '#60a5fa');
    el.innerHTML = `<div class="card">${layer === 'rivers' ? riverCard(item) : layer === 'rain' ? rainCard(item) : layer === 'quakes' ? quakeCard(item) : incidentCard(item)}</div>`;
  },
  leave() {},
};
const lvlClass = (r) => (r.status === 'DANGER LEVEL' ? 'lvl-danger' : r.status === 'WARNING LEVEL' ? 'lvl-warn' : '');
const riverRow = (r) => `<li><span>${esc(r.name)}</span><span class="val ${lvlClass(r)}">${num(r.level, 2)} ${t('m')}</span><span class="sub">${esc(t('status.' + r.status))} · ${t('warn')} ${num(r.warn, 1)} / ${t('danger')} ${num(r.danger, 1)} ${t('m')} · ${age(r.at)}</span></li>`;
const riverCard = (r) => `<h3>${esc(r.name)}</h3><p><span class="${lvlClass(r)}">${esc(t('status.' + r.status))}</span> · ${esc(t('trend.' + r.trend) || '')}</p><p>${t('level')}: <b>${num(r.level, 2)} ${t('m')}</b> · ${t('warn')} ${num(r.warn, 1)} · ${t('danger')} ${num(r.danger, 1)} ${t('m')}</p><p class="note">${when(r.at)} (${age(r.at)}) · ${t('origin.DHM via BIPAD')}</p>`;
const rainCard = (r) => `<h3>${esc(r.name)}</h3><p>${t('rain1')}: <b>${num(r.h1, 1)} ${t('mm')}</b> · ${t('rain24')}: <b>${num(r.h24, 1)} ${t('mm')}</b></p><p class="note">${when(r.at)} (${age(r.at)}) · ${t('origin.DHM via BIPAD')}</p>`;
const quakeCard = (q) => `<h3>${t('mag')} ${num(q.mag, 1)} — ${esc(q.place)}</h3><p class="note">${when(q.at)} (${age(q.at)}) · ${t('origin.NEMRC via BIPAD')}</p>`;
const incidentCard = (i) => `<h3>${esc(lang === 'ne' && i.titleNe ? i.titleNe : i.title)}</h3><p>${t('hazard.' + i.hazard)}${i.verified ? ' · ' + t('verified') : ''}</p><p class="note">${when(i.at)} (${age(i.at)}) · BIPAD</p>`;

// ---------- DATA ----------
let archiveMonths = null;
const dataView = {
  full: true,
  async enter(el, live) {
    el.innerHTML = `<h1>${t('nav.data')}</h1><p class="lead">${t('loading')}</p>`;
    await dataReady; if (!live()) return;
    const tab = location.hash.split('/')[2] || 'rivers';
    el.innerHTML = `<h1>${t('nav.data')}</h1>${printBlock('')}<h2>${t('sources')}</h2>${feedCards()}
      <div class="tabs" role="tablist">${['rivers', 'rain', 'quakes', 'incidents'].map((k) => `<button role="tab" aria-selected="${k === tab}" data-k="${k}">${t('feeds.' + k)}</button>`).join('')}</div>
      <input class="filter" type="search" placeholder="${t('filter')}" aria-label="${t('filter')}">
      <ul class="list" id="rows"></ul><p class="row noprint" id="more"></p>
      <p class="noprint"><button class="btn ghost" type="button" id="pr">${t('print')}</button></p>`;
    el.querySelector('.tabs').onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) location.hash = '#/data/' + b.dataset.k; };
    el.querySelector('#pr').onclick = doPrint;
    const L = state.latest, rows = { rivers: L.rivers, rain: L.rain, quakes: L.quakes, incidents: L.incidents }[tab];
    const fmt = { rivers: riverRow,
      rain: (r) => `<li><span>${esc(r.name)}</span><span class="val">${num(r.h24, 1)} ${t('mm')}</span><span class="sub">${t('rain24')} · ${t('rain1')} ${num(r.h1, 1)} ${t('mm')} · ${age(r.at)}</span></li>`,
      quakes: (q) => `<li><span>${esc(q.place)}</span><span class="val">${t('mag')} ${num(q.mag, 1)}</span><span class="sub">${when(q.at)} · ${age(q.at)}</span></li>`,
      incidents: (i) => `<li><span>${esc(lang === 'ne' && i.titleNe ? i.titleNe : i.title)}</span><span class="val">${t('hazard.' + i.hazard)}</span><span class="sub">${when(i.at)} · ${age(i.at)}</span></li>` }[tab];
    let all = rows.slice();
    const ul = el.querySelector('#rows'), filter = el.querySelector('.filter');
    const draw = () => { const q = filter.value.trim().toLowerCase(); ul.innerHTML = all.filter((x) => !q || (x.name || x.place || x.title || '').toLowerCase().includes(q) || (x.titleNe || '').includes(q)).map(fmt).join(''); };
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
  hideLayers: true,
  async enter(el, live) {
    showChips(false); map.clearShaking();
    G ??= { lake: LAKES[0], vol: LAKES[0].vol.slice(), res: null, t: 0, playing: false, last: 0 };
    el.innerHTML = `<h1>${t('glof.h')}</h1><p class="lead">${t('glof.lead')}</p>
      <div class="noprint">
        <div class="row"><label class="f">${t('glof.lake')}<select id="lake">${LAKES.map((l) => `<option value="${l.id}">${esc(name(l))}</option>`).join('')}<option value="custom">${t('glof.custom')}</option></select></label></div>
        <div class="row"><label class="f">${t('glof.volume')} — ${t('glof.from')}<input id="v0" type="number" min="0.1" max="500" step="0.1" inputmode="decimal"></label>
        <label class="f">${t('glof.to')}<input id="v1" type="number" min="0.1" max="500" step="0.1" inputmode="decimal"></label></div>
        <p class="note">${t('glof.tap')}</p>
        <div class="row"><button class="btn" id="run" type="button">${t('glof.run')}</button></div>
      </div>
      <div id="out"></div>`;
    const sel = el.querySelector('#lake'), v0 = el.querySelector('#v0'), v1 = el.querySelector('#v1');
    sel.value = G.lake.id || 'custom'; v0.value = G.vol[0]; v1.value = G.vol[1];
    sel.onchange = () => { const l = LAKES.find((x) => x.id === sel.value); if (l) { G.lake = l; G.vol = l.vol.slice(); v0.value = l.vol[0]; v1.value = l.vol[1]; map.setMarker(l.ll, '#e879f9'); map.flyTo(...l.ll, 90); routeFor(l.ll); } };
    el.querySelector('#run').onclick = () => {
      const a = Math.max(0.1, +v0.value || 0), b = Math.max(a, +v1.value || 0); G.vol = [a, b]; v0.value = a; v1.value = b; run(el, live);
    };
    routeFor(G.lake.ll);
    await dataReady; if (!live()) return;
    if (G.res) showResult(el);
    await mapReady; if (!live()) return;
    map.setMarker(G.lake.ll, '#e879f9');
    if (G.res) { map.setPath(G.res); map.setPathTime(G.t); } else map.flyTo(...G.lake.ll, 90); // start loading this lake's tiles while the user reads
  },
  onPick({ ground, item }) {
    const ll = ground || item?.ll; if (!ll) return;
    G.lake = { id: null, en: `${ll[1].toFixed(3)}°N ${ll[0].toFixed(3)}°E`, ne: `${num(ll[1], 3)}° उ. ${num(ll[0], 3)}° पू.`, ll };
    const s = document.getElementById('lake'); if (s) s.value = 'custom';
    map.setMarker(ll, '#e879f9'); routeFor(ll);
  },
  onPlace(p) { this.onPick({ ground: p.ll }); if (p.t === 'l') { const l = LAKES.find((x) => x.id === p.id); if (l) { G.lake = l; document.getElementById('lake').value = l.id; } } },
  onFrame(now) {
    if (!G?.playing || !G.res) return false;
    const dt = Math.min(0.1, (now - (G.last || now)) / 1000); G.last = now;
    const end = G.res.at(-1).arrivalH[1];
    G.t = Math.min(end, G.t + dt * Math.max(end, 0.5) / 12); // whole run in ~12 s
    map.setPathTime(G.t); syncTime();
    if (G.t >= end) { G.playing = false; syncPlay(); }
    return true;
  },
  leave() { if (G) G.playing = false; map.hideMarker(); },
};
async function run(el, live) {
  const out = el.querySelector('#out'); out.innerHTML = `<p class="note">${t('loading')}</p>`;
  const r = await routeFor(G.lake.ll), w = await engine(); await dataReady; if (!live()) return;
  G.res = w ? w.glof(...G.lake.ll, G.vol) : js.glof(js.tracePath(r, ...G.lake.ll), G.vol);
  G.t = 0; G.playing = true; G.last = 0;
  showResult(el);
  mapReady.then(() => { if (!live()) return; map.setPath(G.res); map.setPathTime(0); const mid = G.res[Math.floor(G.res.length / 2)]; map.flyTo(...mid.ll, Math.min(420, 60 + G.res.at(-1).km * 0.9)); });
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
  out.push({ p: { en: 'End of model path (plains)', ne: 'मोडेल बाटोको अन्त्य (समथर भूभाग)' }, q: res.at(-1) });
  return out.sort((a, b) => a.q.km - b.q.km);
}
function syncTime() { const o = document.getElementById('tout'), s = document.getElementById('tslider'); if (o) o.textContent = fmtH(G.t); if (s) s.value = G.t; }
function syncPlay() { const b = document.getElementById('play'); if (b) b.textContent = G.playing ? t('glof.pause') : t('glof.play'); }
function showResult(el) {
  const res = G.res, out = el.querySelector('#out'), end = res.at(-1).arrivalH[1], A = js.ASSUMPTIONS.glof;
  const rows = placesAlong(res);
  out.innerHTML = `${printBlock(`<p><b>${t('glof.lake')}:</b> ${esc(name(G.lake))} · <b>${t('glof.volume')}:</b> ${num(G.vol[0], 1)}–${num(G.vol[1], 1)}</p>`)}
    <h2>${t('glof.result')}</h2>
    <div class="timeline noprint"><button class="btn ghost" id="play" type="button"></button>
      <input id="tslider" type="range" min="0" max="${end}" step="any" aria-label="${t('glof.time')}"><output id="tout"></output></div>
    <div class="tw"><table><thead><tr><th>${t('glof.place')}</th><th>${t('glof.dist')}</th><th>${t('glof.arrival')}</th><th>${t('glof.peak')}</th><th>${t('glof.depth')}</th></tr></thead>
    <tbody>${rows.map(({ p, q }) => `<tr><td>${esc(name(p))}</td><td class="n">${num(q.km)} ${t('km')}</td><td>${fmtH(q.arrivalH[0])} – ${fmtH(q.arrivalH[1])}</td><td class="n">${num(Math.round(q.peak[0] / 10) * 10)} – ${num(Math.round(q.peak[1] / 10) * 10)}</td><td class="n">${num(q.depth[0], 1)} – ${num(q.depth[1], 1)}</td></tr>`).join('')}</tbody></table></div>
    <p class="note">${t('glof.ends')}</p>
    <h3>${t('assumptions')}</h3>
    <ul class="note"><li>${A.peakLow}; ${A.peakHigh}</li><li>Manning n ${A.manningN.join('–')}; width = (${A.widthCoef.join('–')})·√Q; peak decay length ${A.attenuationKm.join('–')} km; flood front ≤ ${A.maxCelerity} m/s</li>
    <li>${lang === 'ne' ? 'स्थानीय तहको केन्द्रबिन्दु बाटोबाट ५ कि.मि. भित्र भए मात्र तालिकामा देखिन्छ।' : 'A local level is listed when its centre is within 5 km of the path.'}</li></ul>
    <p class="noprint"><button class="btn ghost" type="button" id="pr">${t('print')}</button></p>`;
  out.querySelector('#pr').onclick = doPrint;
  out.querySelector('#play').onclick = () => { if (G.t >= end) G.t = 0; G.playing = !G.playing; G.last = 0; syncPlay(); };
  out.querySelector('#tslider').oninput = (e) => { G.t = +e.target.value; G.playing = false; syncPlay(); map.setPathTime(G.t); syncTime(); };
  syncPlay(); syncTime();
}

// ---------- EARTHQUAKE ----------
let Q = null;
const quakeView = {
  hideLayers: true,
  async enter(el, live) {
    showChips(false); map.clearPath();
    Q ??= { M: 7.8, strike: 290, ll: [84.731, 28.231], label: { en: '2015 Gorkha epicentre (Barpak)', ne: '२०७२ गोरखा भूकम्पको केन्द्र (बारपाक)' }, r: 0, animating: false };
    el.innerHTML = `<h1>${t('quake.h')}</h1><p class="lead">${t('quake.lead')}</p>
      <div class="noprint">
        <p><b>${t('quake.epi')}:</b> <span id="epi"></span></p><p class="note">${t('quake.tap')}</p>
        <label>${t('quake.mag')}: <output id="mo"></output><input id="M" type="range" min="5" max="8.6" step="0.1"></label>
        <div class="row"><label class="f">${t('quake.strike')}<input id="S" type="number" min="0" max="359" step="5" inputmode="numeric"></label>
        <button class="btn" id="go" type="button">${t('quake.replay')}</button></div>
      </div>
      <div id="out"></div>`;
    const M = el.querySelector('#M'), S = el.querySelector('#S');
    M.value = Q.M; S.value = Q.strike;
    M.oninput = () => { Q.M = +M.value; update(false); };
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
      map.setShaking(grid, a, b); map.setMarker(Q.ll, '#ff3b30');
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
  el.innerHTML = `${printBlock(`<p><b>${t('quake.epi')}:</b> ${Q.label ? esc(name(Q.label)) : ''} ${Q.ll[1].toFixed(3)}°N ${Q.ll[0].toFixed(3)}°E · <b>${t('quake.mag')}:</b> ${num(Q.M, 1)} · <b>${t('quake.strike')}:</b> ${num(Q.strike)}</p>`)}
    <h2>${t('quake.result')}</h2>
    <table><thead><tr><th>${t('quake.district')}</th><th>${t('quake.band')}</th><th></th></tr></thead><tbody>
    ${dist.map(({ d, b }) => `<tr><td>${esc(name(d))}</td><td class="n">${mmiChip(b[0])} – ${mmiChip(b[2])}</td><td>${mmiWord(b[1])}</td></tr>`).join('')}</tbody></table>
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
    el.innerHTML = `<h1>${t('about')}</h1>
    <div class="card"><b>${t('disclaimer')}</b></div>
    <h2>${t('sources')}</h2>${feedCards()}
    <ul>
      <li>${ne ? 'नदी र वर्षा: जल तथा मौसम विज्ञान विभाग' : 'Rivers and rain: Department of Hydrology and Meteorology (DHM)'} — <a href="https://www.hydrology.gov.np" rel="noopener">hydrology.gov.np</a>, ${ne ? 'बिपद पोर्टलको सार्वजनिक API मार्फत' : 'copied through the public BIPAD API'}.</li>
      <li>${ne ? 'भूकम्प: राष्ट्रिय भूकम्प मापन तथा अनुसन्धान केन्द्र' : 'Earthquakes: National Earthquake Monitoring and Research Center (NEMRC)'} — <a href="https://www.seismonepal.gov.np" rel="noopener">seismonepal.gov.np</a>, ${ne ? 'बिपद पोर्टल मार्फत' : 'via BIPAD'}. ${S.nemrc_site && !S.nemrc_site.ok ? (ne ? 'NEMRC को आफ्नै साइट पछिल्लो जाँचमा पहुँचयोग्य थिएन' : "NEMRC's own site was not reachable at the last check") + ` (${esc(S.nemrc_site.error || S.nemrc_site.status)}, ${when(S.nemrc_site.checked_at)}).` : ''}</li>
      <li>${ne ? 'घटना: बिपद पोर्टल' : 'Incidents: BIPAD portal'} — <a href="https://bipadportal.gov.np" rel="noopener">bipadportal.gov.np</a></li>
      <li>${ne ? 'जिल्लाहरू: नेपालको संविधान, अनुसूची ४ (धारा ५६(३))' : 'Districts: Constitution of Nepal, Schedule 4 (Article 56(3)), as published by the Nepal Law Commission'} — ${PROVINCES.flatMap((p) => p.d).length} ${ne ? 'जिल्ला' : 'districts'}.</li>
      <li>${ne ? 'भू-उचाइ: AWS Terrain Tiles (SRTM र अन्य सार्वजनिक DEM); सीमाना: Natural Earth' : 'Terrain: AWS Terrain Tiles (SRTM and other public elevation data); border: Natural Earth'}.</li>
    </ul>
    <h2>${ne ? 'तथ्यांक गुणस्तर जाँच' : 'Data checks'}</h2>
    <p class="note">${ne ? 'स्रोतमा उल्टिएका अक्षांश/देशान्तर सच्याइन्छ, असम्भव स्थान हटाइन्छ:' : 'Swapped latitude/longitude in the source is corrected; impossible locations are dropped:'}
    ${['rivers', 'rain', 'quakes', 'incidents'].map((k) => `${t('feeds.' + k)} ${num(S[k]?.qc?.swapped || 0)}/${num(S[k]?.qc?.rejected || 0)}`).join(' · ')}</p>
    <h2>${t('method')}</h2>
    <p>${ne ? 'हिमताल: डिजिटल उचाइ नक्सा (~५०० मि.) मा पानी बग्ने बाटो पत्ता लगाइन्छ, अनि अनुभवजन्य सूत्र र म्यानिङ समीकरणले छिटो र ढिलो आइपुग्ने समय निकालिन्छ।' : 'Lake burst: the water path follows the steepest descent on a ~500 m elevation grid (pits filled). Peak flow comes from two published empirical formulas (low and high). Travel time uses a kinematic wave with Manning’s equation, run at the fast and slow ends of every uncertain input.'}</p>
    <p>${ne ? 'भूकम्प: Atkinson र Wald (२००७) को तीव्रता समीकरण, फल्टको लम्बाइ Wells र Coppersmith (१९९४) अनुसार।' : 'Earthquake: Atkinson & Wald (2007) intensity equation with distance to a straight rupture whose length follows Wells & Coppersmith (1994).'}</p>
    <p class="note">${ne ? 'यी परिदृश्य जाँचका लागि मात्र हुन्, पूर्वानुमान होइनन्।' : 'These are screening scenarios for learning and planning, not forecasts.'} ${t('disclaimer')}</p>`;
  },
};

export const VIEWS = { map: mapView, data: dataView, glof: glofView, quake: quakeView, about: aboutView };
