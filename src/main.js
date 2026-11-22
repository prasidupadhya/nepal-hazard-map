import { T, t, setLang, lang, name } from './i18n.js';
import { map, mapModule } from './map.js';
import { VIEWS } from './views.js';

export const state = { latest: null, places: [], layers: { rivers: true, rain: false, quakes: true, incidents: true }, view: null, pickHandler: null };
const $ = (s) => document.querySelector(s);
export const panel = $('#panel');

const LAYER_COLOR = { rivers: '#38bdf8', rain: '#a78bfa', quakes: '#f97316', incidents: '#f43f5e' };
export const riverColor = (r) => (r.status === 'DANGER LEVEL' ? '#ef4444' : r.status === 'WARNING LEVEL' ? '#f59e0b' : '#38bdf8');

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
  markNav(); chips();
}
$('#lang').onclick = () => { setLang(lang === 'en' ? 'ne' : 'en'); try { localStorage.setItem('lang', lang); } catch {} applyText(); route(); };

// ---------- layer chips ----------
function chips() {
  $('#chips').innerHTML = Object.keys(state.layers).map((k) => `<button class="chip" type="button" data-l="${k}" aria-pressed="${state.layers[k]}"><span class="dot" style="background:${LAYER_COLOR[k]}"></span>${t('layers.' + k)}</button>`).join('');
}
$('#chips').onclick = (e) => {
  const b = e.target.closest('[data-l]'); if (!b) return;
  const k = b.dataset.l; state.layers[k] = !state.layers[k]; b.setAttribute('aria-pressed', state.layers[k]); map.showLayer(k, state.layers[k]);
};
export function showChips(on) { $('#chips').hidden = !on; for (const k in state.layers) map.showLayer(k, on && state.layers[k]); }

// ---------- search ----------
const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
let hits = [], sel = -1;
export function searchPlaces(q, kinds) {
  q = norm(q.trim()); if (!q) return [];
  const rank = { d: 0, l: 1, m: 2, s: 3 }, out = [];
  for (const p of state.places) {
    if (kinds && !kinds.includes(p.t)) continue;
    const a = (p._en ??= norm(p.en)), b = (p._ne ??= norm(p.ne));
    const s = a.startsWith(q) || b.startsWith(q) ? 0 : a.includes(' ' + q) || b.includes(' ' + q) ? 1 : a.includes(q) || b.includes(q) ? 2 : -1;
    if (s >= 0) out.push([s * 10 + rank[p.t], p]);
  }
  return out.sort((x, y) => x[0] - y[0] || x[1].en.localeCompare(y[1].en)).slice(0, 12).map((x) => x[1]);
}
function renderHits() {
  const ul = $('#results');
  ul.innerHTML = hits.length ? hits.map((p, i) => `<li role="option" id="h${i}" aria-selected="${i === sel}" data-i="${i}"><span>${name(p)}</span><small>${t('kinds.' + p.t)}${p.dn ? ' · ' + name(state.places.find((d) => d.t === 'd' && d.en === p.dn) || { en: p.dn }) : ''}</small></li>`).join('') : `<li aria-disabled="true">${t('noResults')}</li>`;
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
  map.flyTo(...p.ll, p.t === 'd' ? 140 : 60); map.setMarker(p.ll, '#60a5fa');
  state.view?.onPlace?.(p);
}

// ---------- map messages ----------
let msgT; export function mapMsg(s, ms = 2500) { const m = $('#mapmsg'); m.textContent = s; m.classList.add('on'); clearTimeout(msgT); msgT = setTimeout(() => m.classList.remove('on'), ms); }

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

// ---------- boot ----------
export function drawLayers() {
  const L = state.latest; if (!L || !map.ready()) return;
  map.setPoints('rivers', L.rivers, riverColor, (r) => (r.status === 'BELOW WARNING LEVEL' ? 8 : 12));
  map.setPoints('rain', L.rain, () => LAYER_COLOR.rain, (r) => 6 + Math.min(10, (r.h24 || 0) / 10));
  map.setPoints('quakes', L.quakes.slice(0, 100), () => LAYER_COLOR.quakes, (q) => 2 + q.mag * 1.4);
  map.setPoints('incidents', L.incidents.filter((i) => i.ll), (i) => (i.hazard === 26 ? '#e879f9' : LAYER_COLOR.incidents), () => 6);
  for (const k in state.layers) map.showLayer(k, state.layers[k] && !state.view?.hideLayers);
}

applyText();
const dataP = Promise.all([fetch('data/latest.json').then((r) => r.json()), fetch('data/places.json').then((r) => r.json())])
  .then(([l, p]) => { state.latest = l; state.places = p; });
const mapP = mapModule.then((m) => m.init(document.getElementById('gl'), { onPick: (x) => state.view?.onPick?.(x), onFrame: (now) => state.view?.onFrame?.(now) }));
export const dataReady = dataP;
export const mapReady = mapP;
export const ready = Promise.all([dataP, mapP]).then(() => { drawLayers(); });
route();
ready.then(() => { if (!location.hash || location.hash === '#/') map.overview(); });
