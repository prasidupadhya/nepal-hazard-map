import { T, t, setLang, lang, name, num } from './i18n.js';
import { map, mapModule } from './map.js';
import { VIEWS, lakesReady } from './views.js';

// The river network is the only layer on at first; the rest are a tap away in the map key.
export const state = { latest: null, places: [], rivers: null, layers: { network: true, lakes: false, rivers: false, rain: false, quakes: false, incidents: false }, view: null };
const $ = (s) => document.querySelector(s);
export const panel = $('#panel');

// map inks: hazard levels use amber/red only; everything else is a quiet ink
export const LAYER_COLOR = { network: '#0A6787', lakes: '#B8322A', rivers: '#2F7F9A', rain: '#5B5FA6', quakes: '#6B4E2E', incidents: '#9C3D7A' };
export const LAKE_RANK_COLOR = { I: '#B8322A', II: '#B97800', III: '#6B6556' };
const riverColor = (r) => (r.status === 'DANGER LEVEL' ? '#B8322A' : r.status === 'WARNING LEVEL' ? '#B97800' : LAYER_COLOR.rivers);
const sw = (k) => (k === 'network' ? `<span class="sw line"></span>` : `<span class="sw" style="background:${LAYER_COLOR[k]}"></span>`);

// ---------- language ----------
const saved = (() => { try { return localStorage.getItem('lang'); } catch { return null; } })();
// English first; Nepali if chosen before, asked for in the URL, or the browser prefers it
setLang(new URLSearchParams(location.search).get('lang') || saved || ((navigator.language || '').startsWith('ne') ? 'ne' : 'en'));
function applyText() {
  document.title = t('title');
  document.querySelectorAll('[data-t]').forEach((el) => (el.textContent = t(el.dataset.t)));
  $('#lang').textContent = lang === 'en' ? 'नेपाली' : 'English';
  $('#lang').setAttribute('aria-label', lang === 'en' ? 'नेपालीमा हेर्नुहोस्' : 'View in English');
  $('#q').placeholder = t('search'); $('#q').setAttribute('aria-label', t('search'));
  $('#nav').innerHTML = Object.keys(T.en.nav).map((k) => `<a href="#/${k === 'map' ? '' : k}" data-v="${k}">${t('nav.' + k)}</a>`).join('');
  markNav(); chips(); drawLabels();
}
$('#lang').onclick = () => { setLang(lang === 'en' ? 'ne' : 'en'); try { localStorage.setItem('lang', lang); } catch {} applyText(); route(); };

// ---------- layer chips ----------
function chips() {
  $('#chips').setAttribute('aria-label', t('key'));
  $('#chips').innerHTML = Object.keys(state.layers).map((k) => `<button type="button" data-l="${k}" aria-pressed="${state.layers[k]}">${sw(k)}${t('layers.' + k)}</button>`).join('');
  $('#northbtn').setAttribute('aria-label', t('north')); $('#northbtn').title = t('north');
}
$('#chips').onclick = (e) => {
  const b = e.target.closest('[data-l]'); if (!b) return;
  const k = b.dataset.l; state.layers[k] = !state.layers[k]; b.setAttribute('aria-pressed', state.layers[k]); map.showLayer(k, state.layers[k]);
};
// The map key and the user's layer choices apply on the map view; scenario screens pass the layers they need.
export function showChips(on, only) { $('#chips').hidden = !on; for (const k in state.layers) map.showLayer(k, only ? only.includes(k) : on && state.layers[k]); }

// ---------- scale bar + north arrow ----------
const NICE = [1, 2, 5, 10, 20, 50, 100, 200, 500];
function onView({ kmPerPx, azimuth }) {
  const km = NICE.filter((n) => n / kmPerPx <= 110).pop() || 1, label = `${num(km)} ${t('km')}`;
  $('#scalebar').style.width = (km / kmPerPx).toFixed(1) + 'px';
  if ($('#scalelabel').textContent !== label) $('#scalelabel').textContent = label;
  $('#northbtn svg').style.transform = `rotate(${azimuth.toFixed(3)}rad)`;
}
$('#northbtn').onclick = () => map.resetNorth();

// header height drives the layout (the disclaimer wraps differently per language)
new ResizeObserver(([e]) => document.documentElement.style.setProperty('--hdr', e.target.offsetHeight + 'px')).observe($('.top'));

// ---------- search ----------
const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
let hits = [], sel = -1;
function searchPlaces(q) {
  q = norm(q.trim()); if (!q) return [];
  const rank = { d: 0, l: 1, m: 2, s: 3 }, out = [];
  for (const p of state.places) {
    const a = (p._en ??= norm(p.en)), b = (p._ne ??= norm(p.ne));
    const s = a.startsWith(q) || b.startsWith(q) ? 0 : a.includes(' ' + q) || b.includes(' ' + q) ? 1 : a.includes(q) || b.includes(q) ? 2 : -1;
    if (s >= 0) out.push([s * 10 + rank[p.t], p]);
  }
  return out.sort((x, y) => x[0] - y[0] || x[1].en.localeCompare(y[1].en)).slice(0, 12).map((x) => x[1]);
}
function renderHits() {
  const ul = $('#results');
  ul.innerHTML = hits.length ? hits.map((p, i) => `<li role="option" id="h${i}" aria-selected="${i === sel}" data-i="${i}"><span>${name(p)}</span><small>${p.dn ? name(state.places.find((d) => d.t === 'd' && d.en === p.dn) || { en: p.dn }) + ', ' : ''}${t('kinds.' + p.t).toLowerCase()}</small></li>`).join('') : `<li aria-disabled="true">${t('noResults')}</li>`;
  ul.hidden = false; $('#q').setAttribute('aria-expanded', 'true');
  if (sel >= 0) $('#q').setAttribute('aria-activedescendant', 'h' + sel); else $('#q').removeAttribute('aria-activedescendant');
}
const closeHits = () => { $('#results').hidden = true; $('#q').setAttribute('aria-expanded', 'false'); };
$('#q').addEventListener('input', (e) => { hits = searchPlaces(e.target.value); sel = hits.length ? 0 : -1; e.target.value.trim() ? renderHits() : closeHits(); });
$('#q').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { sel = Math.min(hits.length - 1, sel + 1); renderHits(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); renderHits(); e.preventDefault(); }
  else if (e.key === 'Enter' && hits[sel]) choose(hits[sel]);
  else if (e.key === 'Escape') closeHits();
});
$('#results').addEventListener('click', (e) => { const li = e.target.closest('[data-i]'); if (li) choose(hits[+li.dataset.i]); });
document.addEventListener('click', (e) => { if (!e.target.closest('.search')) closeHits(); });
function choose(p) {
  closeHits(); $('#q').value = name(p); $('#q').blur();
  map.flyTo(...p.ll, p.t === 'd' ? 220 : 130); map.setMarker(p.ll, '#0A6787');
  state.view?.onPlace?.(p);
}

// ---------- router ----------
function markNav() {
  const v = location.hash.split('/')[1] || 'map';
  document.querySelectorAll('#nav a').forEach((a) => (a.dataset.v === v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
}
let gen = 0;
export async function route() {
  const key = location.hash.split('/')[1] || 'map', v = VIEWS[key] || VIEWS.map, my = ++gen;
  markNav();
  state.view?.leave?.();
  state.view = v;
  document.body.classList.toggle('full', !!v.full);
  if (!v.full) requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  $('#legend').hidden = true;
  await v.enter(panel, () => my === gen);
  if (my === gen) performance.mark('view:' + key);
}
window.addEventListener('hashchange', () => { route(); panel.scrollTop = 0; if (document.body.classList.contains('full')) window.scrollTo(0, 0); });

// ---------- place names on the map (current language) ----------
export function drawLabels() {
  if (!state.places.length || !map.ready()) return;
  const rank = (p) => (p.t === 'm' ? [0, 0, 1, 3, 4][p.k] : 2); // metropolitan, sub-metropolitan, districts, municipalities, rural
  map.setLabels(state.places.filter((p) => p.t === 'm' || p.t === 'd').map((p) => ({ ll: p.ll, text: name(p), rank: rank(p), pri: p.t === 'm' && p.en === 'Kathmandu' ? 1 : 0 })));
}
// Douglas–Peucker: drop points within tol (degrees) of the line between kept points
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(), [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    let m = -1, md = tol;
    for (let k = a + 1; k < b; k++) { const d = Math.abs((pts[k][0] - ax) * dy - (pts[k][1] - ay) * dx) / L; if (d > md) { md = d; m = k; } }
    if (m > 0) { keep[m] = 1; st.push([a, m], [m, b]); }
  }
  return pts.filter((_, k) => keep[k]);
}
// river network from public/terrain/rivers.json (start cell + D8 codes per reach)
export async function loadRivers() {
  const j = await (await fetch('terrain/rivers.json')).json(), { ROUTE, D8, cellLL } = await import('./grid.js');
  const polys = j.lines.map(([start, codes, km2]) => {
    let i = start % ROUTE.nx, jj = Math.floor(start / ROUTE.nx); const pts = [cellLL(ROUTE, i, jj)], cells = [start];
    for (const c of codes) { i += D8[c - 1][0]; jj += D8[c - 1][1]; pts.push(cellLL(ROUTE, i, jj)); cells.push(jj * ROUTE.nx + i); }
    return { pts: simplify(pts, ROUTE.step * 0.6), cells, km2 }; // drawn simplified; cells keep full detail for tracing
  });
  const cellReach = new Map(); polys.forEach((pl, i) => pl.cells.forEach((c) => cellReach.has(c) || cellReach.set(c, i)));
  state.rivers = { polys, lakes: j.lakes, cellReach };
  map.setRiverNetwork(polys);
  const only = state.view?.layers; map.showLayer('network', only ? only.includes('network') : state.layers.network && !state.view?.hideLayers);
}

// ---------- boot ----------
export function drawLayers() {
  const L = state.latest; if (!L || !map.ready()) return;
  map.setPoints('rivers', L.rivers, riverColor, (r) => (r.status === 'BELOW WARNING LEVEL' ? 10 : 14));
  map.setPoints('rain', L.rain, () => LAYER_COLOR.rain, (r) => 8 + Math.min(10, (r.h24 || 0) / 10));
  map.setPoints('quakes', L.quakes.slice(0, 100), () => LAYER_COLOR.quakes, (q) => 4 + q.mag * 1.5);
  map.setPoints('incidents', L.incidents.filter((i) => i.ll), () => LAYER_COLOR.incidents, () => 8);
  lakesReady.then((LAKES) => {
    map.setPoints('lakes', LAKES, (l) => LAKE_RANK_COLOR[l.rank], () => 12);
    const only = state.view?.layers; map.showLayer('lakes', only ? only.includes('lakes') : state.layers.lakes && !state.view?.hideLayers);
  });
  const only = state.view?.layers;
  for (const k in state.layers) map.showLayer(k, only ? only.includes(k) : state.layers[k] && !state.view?.hideLayers);
}

applyText();
const dataP = Promise.all([fetch('data/latest.json').then((r) => r.json()), fetch('data/places.json').then((r) => r.json())])
  .then(([l, p]) => { state.latest = l; state.places = p; });
const mapP = mapModule.then((m) => { m.setOnView(onView); return m.init(document.getElementById('gl'), { onPick: (x) => state.view?.onPick?.(x), onFrame: (now) => state.view?.onFrame?.(now) }); });
export const dataReady = dataP;
export const mapReady = mapP;
// rivers are decoded when the browser is idle, so they never compete with the first frames
export const ready = Promise.all([dataP, mapP]).then(() => { drawLayers(); drawLabels(); (window.requestIdleCallback || setTimeout)(() => loadRivers(), { timeout: 1500 }); });
route();
