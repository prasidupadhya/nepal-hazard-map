// three.js terrain map. Renders on demand (only while something moves) to save battery.
import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { BOX, VIEW, kmPerDegLon, KM_PER_DEG_LAT } from './grid.js';
import { MMI_COLORS } from './colors.js';

const C = { lon: (BOX.w + BOX.e) / 2, lat: (BOX.s + BOX.n) / 2 };
const KX = kmPerDegLon(C.lat), EXAG = 2.5;
export const toXZ = (lon, lat) => [(lon - C.lon) * KX, (C.lat - lat) * KM_PER_DEG_LAT];
export const toLL = (x, z) => [C.lon + x / KX, C.lat - z / KM_PER_DEG_LAT];

const MIST = 0xe7ecea, BASE = 12; // page/fog colour; slab thickness below sea level (scene km)
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
let netMinKm2 = 0; // scenario screens show only main rivers, for orientation
export const setNetworkMin = (km2) => { netMinKm2 = km2; dirty = true; };
let labelCanvas, lctx, labels = []; const labelW = new Map(), lineMats = [], netObjs = [];
let hidden = false, labelKey = '';
let inset = 0, cssH = 1, lastView = [1, 0], firstFrame = false, renderer, scene, camera, controls, terrain, heights, host, dirty = true, anim = null, onPick = null, onFrame = null, onView = null;
const layers = {};
// shared by terrain, slab sides, points: rise = intro animation (0 → 1), fog follows camera distance
const common = { rise: { value: REDUCED ? 1 : 0 }, fogNear: { value: 900 }, fogFar: { value: 2600 }, fogColor: { value: new THREE.Color(MIST) } };
const uni = {
  ...common,
  map: { value: null }, overlay: { value: null }, overlayOn: { value: 0 },
  pal: { value: MMI_COLORS.map((c) => new THREE.Color(c)) },
  rupA: { value: new THREE.Vector2() }, rupB: { value: new THREE.Vector2() }, radius: { value: 0 },
};

export function heightAt(lon, lat) {
  if (!heights) return 0;
  const fx = Math.min(VIEW.nx - 1.001, Math.max(0, (lon - BOX.w) / VIEW.step - 0.5)), fy = Math.min(VIEW.ny - 1.001, Math.max(0, (BOX.n - lat) / VIEW.step - 0.5));
  const i = Math.floor(fx), j = Math.floor(fy), a = fx - i, b = fy - j, k = j * VIEW.nx + i;
  return ((heights[k] * (1 - a) + heights[k + 1] * a) * (1 - b) + (heights[k + VIEW.nx] * (1 - a) + heights[k + VIEW.nx + 1] * a) * b) / 1000 * EXAG;
}

async function pixels(url) {
  const bmp = await createImageBitmap(await (await fetch(url)).blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  return g.getImageData(0, 0, bmp.width, bmp.height).data;
}

// Terrain: baked plaster-relief texture + contour lines (250 m / 1000 m) + earthquake overlay.
// contour(): fwidth is 0 on flat triangles and smoothstep(0, 0, x) is undefined, hence max(…, 1e-4).
// While the shaking wave travels, a small ripple lifts the relief at the wavefront.
const FOG = `uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; varying float vDepth;`;
const vert = `uniform float rise; uniform sampler2D overlay; uniform float overlayOn; uniform vec2 rupA; uniform vec2 rupB; uniform float radius;
varying vec2 vUv; varying vec2 vXZ; varying float vElev; varying float vDepth;
float rupDist(vec2 p){ vec2 ab = rupB - rupA; float t = clamp(dot(p - rupA, ab) / max(dot(ab,ab), 1e-6), 0., 1.); return length(p - (rupA + t*ab)); }
void main(){
  vUv = uv; vXZ = position.xz; vElev = position.y / ${EXAG.toFixed(1)} * 1000.;
  vec3 p = position; p.y *= rise;
  if (overlayOn > .5 && radius > 1. && radius < 790.) {
    float d = rupDist(p.xz), m = texture(overlay, uv).r * 10.;
    float env = exp(-pow((d - radius) / 16., 2.)) * clamp((m - 4.) / 5., 0., 1.);
    p.y += env * 2.2 * sin((d - radius) * .45);
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.); vDepth = -mv.z; gl_Position = projectionMatrix * mv;
}`;
const frag = `uniform sampler2D map; uniform sampler2D overlay; uniform float overlayOn; uniform vec2 rupA; uniform vec2 rupB; uniform float radius;
${FOG}
varying vec2 vUv; varying vec2 vXZ; varying float vElev;
uniform vec3 pal[11];
vec3 mmiColor(float m){ int i = int(clamp(floor(m), 1., 9.)); return mix(pal[i], pal[i + 1], clamp(m - float(i), 0., 1.)); }
float contour(float v, float step){ float f = v / step, w = max(fwidth(f), 1e-4); return w > .45 ? 0. : (1. - smoothstep(0., w * 1.4, abs(fract(f - .5) - .5))) * (1. - smoothstep(.2, .45, w)); }
void main(){
  vec3 base = texture2D(map, vUv).rgb;
  vec3 ink = vec3(.106,.165,.196);
  base = mix(base, ink, contour(vElev, 250.) * .09 + contour(vElev, 1000.) * .2);
  if (overlayOn > 0.5) {
    vec2 ab = rupB - rupA; float t = clamp(dot(vXZ - rupA, ab) / max(dot(ab,ab), 1e-6), 0., 1.);
    float d = length(vXZ - (rupA + t*ab));
    float m = texture2D(overlay, vUv).r * 10.;
    float shown = 1. - smoothstep(radius - 12., radius, d);
    float ring = (1. - smoothstep(0., 3., abs(d - radius))) * step(1., radius) * step(radius, 790.);
    base = mix(base, base * mix(vec3(1.), mmiColor(m), .75), shown * smoothstep(4.5, 6., m) * .9);
    base = mix(base, ink, ring * .55);
  }
  gl_FragColor = vec4(mix(base, fogColor, smoothstep(fogNear, fogFar, vDepth)), 1.);
}`;
// Cut sides of the slab: silt with faint strata, darker toward the base.
const wallVert = `uniform float rise; attribute float top; varying float vY; varying float vDepth;
void main(){ vec3 p = position; if (top > .5) p.y *= rise; vY = p.y; vec4 mv = modelViewMatrix * vec4(p,1.); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`;
const wallFrag = `${FOG} varying float vY;
void main(){ float s = 1. - smoothstep(0., .08, abs(fract(vY / 3.) - .5) - .42); vec3 c = mix(vec3(.36,.34,.29), vec3(.62,.59,.52), smoothstep(-${BASE}., 2., vY));
  c *= .94 + .06 * s; gl_FragColor = vec4(mix(c, fogColor, smoothstep(fogNear, fogFar, vDepth)), 1.); }`;

export async function init(el, { onPick: pick, onFrame: frame } = {}) {
  host = el; onPick = pick; onFrame = frame;
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setPixelRatio(pr); ptUni.pr.value = pr;
  renderer.setClearColor(MIST);
  el.appendChild(renderer.domElement);
  labelCanvas = document.createElement('canvas'); labelCanvas.className = 'labels'; labelCanvas.setAttribute('aria-hidden', 'true');
  el.appendChild(labelCanvas); lctx = labelCanvas.getContext('2d');
  document.fonts?.ready.then(() => { labelW.clear(); labelKey = ''; dirty = true; });
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(MIST, 900, 2600);
  camera = new THREE.PerspectiveCamera(40, 1, 1, 5000);
  camera.position.set(0, 1500, 260); // starts high above; the intro settles it
  controls = new MapControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.12;
  controls.maxPolarAngle = 1.3; controls.minDistance = 25; controls.maxDistance = 1400;
  controls.addEventListener('change', () => (dirty = true));
  new ResizeObserver(resize).observe(el); resize();

  const [h, tex] = await Promise.all([pixels('terrain/height.png'), new THREE.TextureLoader().loadAsync('terrain/texture-1024.jpg')]);
  heights = new Float32Array(VIEW.nx * VIEW.ny);
  for (let k = 0; k < heights.length; k++) heights[k] = (h[4 * k] / 2.68) ** 2; // see bake-terrain.js step 3
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  uni.map.value = tex;
  const ov = new THREE.DataTexture(new Uint8Array(VIEW.nx * VIEW.ny), VIEW.nx, VIEW.ny, THREE.RedFormat);
  ov.flipY = false; ov.magFilter = ov.minFilter = THREE.LinearFilter; ov.needsUpdate = true; uni.overlay.value = ov;

  const { nx, ny } = VIEW, pos = new Float32Array(nx * ny * 3), uv = new Float32Array(nx * ny * 2);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, [x, z] = toXZ(BOX.w + (i + 0.5) * VIEW.step, BOX.n - (j + 0.5) * VIEW.step);
    pos.set([x, (heights[k] / 1000) * EXAG, z], 3 * k); uv.set([(i + 0.5) / nx, 1 - (j + 0.5) / ny], 2 * k);
  }
  const idx = new Uint32Array((nx - 1) * (ny - 1) * 6);
  let q = 0; for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.set([a, c, b, b, c, d], q); q += 6; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  terrain = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: uni, vertexShader: vert, fragmentShader: frag }));
  scene.add(terrain);
  buildSlab(pos);
  pickHandlers(renderer.domElement);
  loop();
  intro();
  // swap in the sharp texture once the page is idle (not on Data Saver)
  if (!navigator.connection?.saveData) (window.requestIdleCallback || setTimeout)(() => new THREE.TextureLoader().loadAsync('terrain/texture.jpg').then((hi) => {
    hi.colorSpace = THREE.SRGBColorSpace; hi.anisotropy = tex.anisotropy; const old = uni.map.value; uni.map.value = hi; old.dispose(); dirty = true;
  }).catch(() => {}), { timeout: 4000 });
}

// Sides of the relief model along the grid edge, plus a soft shadow on the "table".
function buildSlab(pos) {
  const { nx, ny } = VIEW, ring = [];
  for (let i = 0; i < nx; i++) ring.push(i);
  for (let j = 1; j < ny; j++) ring.push(j * nx + nx - 1);
  for (let i = nx - 2; i >= 0; i--) ring.push((ny - 1) * nx + i);
  for (let j = ny - 2; j > 0; j--) ring.push(j * nx);
  ring.push(0);
  const n = ring.length, p = new Float32Array(n * 6), top = new Float32Array(n * 2), idx = [];
  ring.forEach((k, q) => { p.set([pos[3 * k], pos[3 * k + 1], pos[3 * k + 2], pos[3 * k], -BASE, pos[3 * k + 2]], 6 * q); top.set([1, 0], 2 * q); if (q) { const a = 2 * (q - 1), b = 2 * q; idx.push(a, a + 1, b, b, a + 1, b + 1); } });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('top', new THREE.BufferAttribute(top, 1)); g.setIndex(idx);
  scene.add(new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: common, vertexShader: wallVert, fragmentShader: wallFrag, side: THREE.DoubleSide })));
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  // tight plane: the blurred shadow fills most of it, so few fully transparent pixels get blended
  const x = c.getContext('2d'); x.filter = 'blur(12px)'; x.fillStyle = 'rgba(27,42,50,.38)'; x.fillRect(22, 22, 212, 84);
  const [W, D] = [(BOX.e - BOX.w) * KX, (BOX.n - BOX.s) * KM_PER_DEG_LAT];
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.2, D * 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(16, -BASE - 18, 22); scene.add(shadow);
}

// The one orchestrated moment: the relief rises out of the mist while the camera settles.
function intro() {
  if (REDUCED) { overview(1); return; }
  const t0 = performance.now(), ms = 2200;
  const step = () => { const p = Math.min(1, (performance.now() - t0) / ms); common.rise.value = 1 - (1 - p) ** 3; dirty = true; if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step); overview(ms);
}

function resize() {
  if (!renderer) return;
  const w = host.clientWidth, h = host.clientHeight;
  hidden = !w || !h;
  if (hidden) return; // map hidden (data/about pages): keep the framebuffer, render nothing until shown
  cssH = h; labelKey = ''; renderer.setSize(w, h, false);
  labelCanvas.width = Math.round(w * devicePixelRatio); labelCanvas.height = Math.round(h * devicePixelRatio);
  for (const m of lineMats) m.resolution.set(w, h);
  // On desktop the sheet floats over the right of the map: shift the projection centre so that
  // flights and the overview centre in the part of the map people can see.
  const pr0 = document.getElementById('panel')?.getBoundingClientRect(), hr = host.getBoundingClientRect();
  inset = pr0 && pr0.width && pr0.left > hr.left + 200 && pr0.left < hr.right ? Math.round(hr.right - pr0.left + 16) : 0;
  camera.aspect = (w + inset) / h;
  if (inset) camera.setViewOffset(w + inset, h, inset, 0, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix(); dirty = true;
}
export const requestRender = () => { dirty = true; };

// Adaptive resolution: while frames render back to back, drop the pixel ratio when
// they are slow (cheap phone GPUs are fill-rate bound) and raise it when there is headroom.
const MAX_PR = Math.min(devicePixelRatio, 2);
let pr = MAX_PR, lastT = 0, prevRendered = false; const ft = [];
function adapt(now, rendered) {
  const d = now - lastT, cont = rendered && prevRendered; lastT = now; prevRendered = rendered;
  if (!rendered) return;
  if (!cont) { ft.length = 0; return; } // only judge back-to-back frames
  ft.push(d); if (ft.length < 20) return;
  const m = ft.sort((a, b) => a - b)[10]; ft.length = 0;
  const next = m > 24 ? Math.max(1, pr - 0.25) : m < 14 ? Math.min(MAX_PR, pr + 0.25) : pr;
  if (next !== pr) { pr = next; renderer.setPixelRatio(pr); ptUni.pr.value = pr; resize(); }
}

function loop(now) {
  requestAnimationFrame(loop);
  if (anim) { const p = Math.min(1, (now - anim.t0) / anim.ms); anim.step(p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2); if (p >= 1) anim = null; dirty = true; }
  if (onFrame && onFrame(now)) dirty = true;
  const moved = controls.update();
  adapt(now, dirty || moved);
  if ((dirty || moved) && !hidden) {
    const dist = camera.position.distanceTo(controls.target);
    common.fogNear.value = scene.fog.near = dist * 1.1; common.fogFar.value = scene.fog.far = dist * 2.9;
    const risen = common.rise.value > 0.999;
    for (const o of netObjs) o.visible = risen && !!layers.network?.visible && dist < o.userData.maxDist && o.userData.minKm2 >= netMinKm2; // rivers appear once the relief has risen
    renderer.render(scene, camera); dirty = false;
    drawLabels(dist);
    if (terrain && !firstFrame) { firstFrame = true; performance.mark('map-ready'); }
    const sc = Math.max(0.35, dist / 260); // pins and fronts keep roughly the same size on screen
    if (marker) marker.scale.setScalar(sc); if (fronts) fronts.forEach((f) => f.scale.setScalar(sc));
    // scale bar / north arrow: only when they change, and without reading layout (cssH is cached in resize)
    const kmPerPx = (2 * dist * Math.tan((camera.fov * Math.PI) / 360)) / cssH, az = controls.getAzimuthalAngle();
    if (onView && (Math.abs(kmPerPx / lastView[0] - 1) > 0.01 || Math.abs(az - lastView[1]) > 0.005)) { lastView = [kmPerPx, az]; onView({ kmPerPx, azimuth: az }); }
  }
}
export const setOnView = (f) => { onView = f; dirty = true; };
// turn the view back to north-up, keeping distance and tilt
export function resetNorth() {
  const off = camera.position.clone().sub(controls.target), r = Math.hypot(off.x, off.z), a0 = Math.atan2(off.x, off.z);
  const da = Math.atan2(Math.sin(-a0), Math.cos(-a0));
  anim = { t0: performance.now(), ms: REDUCED ? 1 : 700, step: (e) => { const a = a0 + da * e; camera.position.set(controls.target.x + r * Math.sin(a), camera.position.y, controls.target.z + r * Math.cos(a)); } };
}

// Smooth camera flight to a place; `dist` = viewing distance in km.
export function flyTo(lon, lat, dist = 120, ms = 1400) {
  if (!camera) return;
  const [x, z] = toXZ(lon, lat), y = heightAt(lon, lat);
  const t0 = controls.target.clone(), t1 = new THREE.Vector3(x, y, z);
  const off0 = camera.position.clone().sub(t0), off1 = new THREE.Vector3(0, dist * 0.8, dist * 0.6);
  if (REDUCED) ms = 1;
  anim = { t0: performance.now(), ms, step: (e) => { controls.target.lerpVectors(t0, t1, e); camera.position.copy(controls.target).add(off0.clone().lerp(off1, e)); } };
}
// distance that fits the whole country in the current view
export function overview(ms = 1400) {
  const visAspect = (host.clientWidth - inset) / (host.clientHeight || 1); // fit to the visible part, not under the sheet
  const W = (BOX.e - BOX.w) * KX * 0.98, hf = Math.atan(Math.tan(((camera.fov / 2) * Math.PI) / 180) * visAspect);
  flyTo(C.lon, C.lat - 0.2, Math.min(1250, Math.max(380, (W / 2 / Math.tan(hf)) * (visAspect < 1 ? 0.56 : 1))), ms);
}

// ---- point layers ----
const ptUni = { rise: common.rise, pr: { value: 1 } };
const ptVert = `uniform float rise; uniform float pr; attribute vec3 color; attribute float size; varying vec3 vC; varying float vA;
void main(){ vC = color; vA = smoothstep(.85, 1., rise); vec3 p = position; p.y *= rise; vec4 mv = modelViewMatrix * vec4(p,1.);
  gl_PointSize = size * pr * clamp(340. / -mv.z, .85, 2.2); gl_Position = projectionMatrix * mv; }`;
// coloured disc, white keyline, thin ink rim: reads on the pale relief
const ptFrag = `varying vec3 vC; varying float vA; void main(){ vec2 p = gl_PointCoord*2.-1.; float r = length(p); if (r > 1.) discard;
  vec3 c = r < .62 ? vC : r < .84 ? vec3(1.) : vec3(.106,.165,.196); gl_FragColor = vec4(c, vA * (1. - smoothstep(.92, 1., r))); }`;
export function setPoints(name, items, colorOf, sizeOf = () => 9) {
  if (layers[name]) { scene.remove(layers[name].obj); layers[name].obj.geometry.dispose(); }
  const n = items.length, p = new Float32Array(n * 3), c = new Float32Array(n * 3), s = new Float32Array(n), col = new THREE.Color();
  items.forEach((it, k) => { const [x, z] = toXZ(...it.ll); p.set([x, heightAt(...it.ll) + 0.6, z], 3 * k); col.set(colorOf(it)); c.set([col.r, col.g, col.b], 3 * k); s[k] = sizeOf(it); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('size', new THREE.BufferAttribute(s, 1));
  const obj = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: ptUni, vertexShader: ptVert, fragmentShader: ptFrag, transparent: true, depthTest: true }));
  obj.renderOrder = 2; scene.add(obj); layers[name] = { obj, items, pos: p, visible: true }; dirty = true;
}

// ---- river network: screen-space lines (main rivers thicker), pickable by their cells ----
// polys: [{ pts: [[lon, lat], …], km2 }]; picking reports { poly, i, ll }.
export function setRiverNetwork(polys) {
  for (const o of netObjs) { scene.remove(o); o.geometry.dispose(); }
  netObjs.length = 0;
  const pick = [], items = [];
  // smaller rivers only when zoomed in: at the national view they are sub-pixel clutter
  for (const [minKm2, maxKm2, width, color, maxDist] of [[25, 250, 1, 0x4a95ad, 300], [250, 1000, 1.2, 0x3b8aa3, 520], [1000, 5000, 1.6, 0x2f7f9a, Infinity], [5000, Infinity, 2.6, 0x0a6787, Infinity]]) {
    const seg = [];
    polys.forEach((pl, pi) => {
      if (pl.km2 < minKm2 || pl.km2 >= maxKm2) return;
      const xyz = pl.pts.map((ll) => { const [x, z] = toXZ(...ll); return [x, heightAt(...ll) + 0.45, z]; });
      for (let k = 1; k < xyz.length; k++) seg.push(...xyz[k - 1], ...xyz[k]);
      xyz.forEach((v, i) => { pick.push(...v); items.push({ poly: pi, i, ll: pl.pts[i] }); });
    });
    const g = new LineSegmentsGeometry(); g.setPositions(seg);
    const m = new LineMaterial({ color, linewidth: width, transparent: true, opacity: 0.95, depthTest: true });
    m.resolution.set(host.clientWidth || 1, host.clientHeight || 1); lineMats.push(m);
    const o = new LineSegments2(g, m); o.renderOrder = 1; o.visible = false; o.userData.maxDist = maxDist; o.userData.minKm2 = minKm2; scene.add(o); netObjs.push(o);
  }
  layers.network = { obj: netObjs[0], items, pos: new Float32Array(pick), visible: layers.network?.visible ?? true };
  dirty = true;
}

// ---- traced river: thick line on a white halo, revealed downstream (setTraceProgress 0..1) ----
let trace = null;
export function setTrace(pts) {
  clearTrace(); if (!scene || pts.length < 2) return;
  const seg = []; let prev = null;
  for (const ll of pts) { const [x, z] = toXZ(...ll), v = [x, heightAt(...ll) + 0.7, z]; if (prev) seg.push(...prev, ...v); prev = v; }
  // scenario ink: yellow line with a thin black edge (no base-map layer uses it)
  trace = [[7, 0x1b2a32, 1], [4.5, 0xffd60a, 1]].map(([w, c, o], k) => {
    const g = new LineSegmentsGeometry(); g.setPositions(seg);
    const m = new LineMaterial({ color: c, linewidth: w, transparent: true, opacity: o, depthTest: false });
    m.resolution.set(host.clientWidth || 1, host.clientHeight || 1); lineMats.push(m);
    const o2 = new LineSegments2(g, m); o2.renderOrder = 6 + k; scene.add(o2); return o2;
  });
  trace.n = seg.length / 6; setTraceProgress(0);
}
export function setTraceProgress(f) { if (!trace) return; const n = Math.max(1, Math.round(trace.n * f)); for (const o of trace) o.geometry.instanceCount = n; dirty = true; }
export function clearTrace() { if (!trace) return; for (const o of trace) { scene.remove(o); o.geometry.dispose(); lineMats.splice(lineMats.indexOf(o.material), 1); o.material.dispose(); } trace = null; dirty = true; }

// ---- place-name labels: ranked, shown by zoom, no overlaps (2D canvas over the WebGL view) ----
// items: [{ ll, text, rank, pri }]  rank 0 = always shown … 4 = only when close; pri breaks ties (the capital first)
const LABEL_MAX_DIST = [Infinity, 1400, 700, 330, 170];
export function setLabels(items) {
  labels = items.map((l) => { const [x, z] = toXZ(...l.ll); return { ...l, x, y: heightAt(...l.ll), z }; }).sort((a, b) => a.rank - b.rank || (b.pri || 0) - (a.pri || 0));
  labelW.clear(); labelKey = ''; dirty = true;
}
const lv = new THREE.Vector3();
function drawLabels(dist) {
  // redraw only when the view, the labels or the relief changed (not on every animation frame)
  const e = camera.matrixWorld.elements, key = `${e[12].toFixed(2)},${e[13].toFixed(2)},${e[14].toFixed(2)},${e[8].toFixed(4)},${e[10].toFixed(4)},${common.rise.value.toFixed(3)},${labels.length}`;
  if (key === labelKey) return; labelKey = key;
  const W = labelCanvas.width, H = labelCanvas.height, s = devicePixelRatio;
  lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, W, H);
  if (!labels.length || common.rise.value < 0.999 || !host.clientWidth) { if (labelCanvas.dataset.drawn) labelCanvas.dataset.drawn = ''; return; }
  lctx.setTransform(s, 0, 0, s, 0, 0);
  const w = host.clientWidth - inset, h = host.clientHeight, boxes = [], drawn = [];
  lctx.textBaseline = 'middle'; lctx.lineJoin = 'round';
  for (const l of labels) {
    if (dist > LABEL_MAX_DIST[l.rank] || drawn.length >= 90) continue;
    lv.set(l.x, l.y, l.z).project(camera);
    if (lv.z > 1) continue;
    const px = ((lv.x + 1) / 2) * host.clientWidth, py = ((1 - lv.y) / 2) * h;
    if (px < 0 || py < 0 || px > w || py > h) continue;
    const font = l.rank === 0 ? '650 15px Anek, "Noto Sans Devanagari", system-ui, sans-serif' : l.rank === 1 ? '600 13.5px Anek, "Noto Sans Devanagari", system-ui, sans-serif' : l.rank === 2 ? '500 12.5px Anek, "Noto Sans Devanagari", system-ui, sans-serif' : '500 12px Anek, "Noto Sans Devanagari", system-ui, sans-serif';
    lctx.font = font;
    const key = font + l.text; let tw = labelW.get(key); if (tw == null) { tw = lctx.measureText(l.text).width; labelW.set(key, tw); }
    const dot = l.rank !== 2, bx = px + (dot ? 6 : -tw / 2), by = py - 9, bw = tw + (dot ? 2 : 0), bh = 18;
    if (boxes.some((b) => bx < b[0] + b[2] + 4 && bx + bw + 4 > b[0] && by < b[1] + b[3] && by + bh > b[1])) continue;
    boxes.push([bx, by, bw, bh]); drawn.push(l.text);
    lctx.lineWidth = 3.2; lctx.strokeStyle = 'rgba(247,249,247,.92)'; lctx.fillStyle = l.rank === 2 ? '#6b6556' : '#1b2a32';
    if (dot) { lctx.beginPath(); lctx.arc(px, py, l.rank === 0 ? 3.2 : 2.5, 0, 7); lctx.fill(); lctx.lineWidth = 1.5; lctx.stroke(); lctx.lineWidth = 3.2; }
    const tx = dot ? px + 7 : px - tw / 2;
    lctx.strokeText(l.text, tx, py); lctx.fillText(l.text, tx, py);
  }
  const d = drawn.join('|'); if (labelCanvas.dataset.drawn !== d) labelCanvas.dataset.drawn = d;
}
export function showLayer(name, on) { if (layers[name]) { layers[name].obj.visible = on; layers[name].visible = on; dirty = true; } }

// ---- picking: nearest visible point within 22 px, else ground position ----
function pickHandlers(el) {
  let down = null;
  el.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
  el.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6 || !onPick) return;
    const r = el.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top, v = new THREE.Vector3();
    let best = null, bd = 22;
    for (const [name, L] of Object.entries(layers)) {
      if (!L.visible) continue;
      const a = L.pos;
      for (let k = 0; k < L.items.length; k++) {
        v.set(a[3 * k], a[3 * k + 1], a[3 * k + 2]).project(camera);
        if (v.z > 1) continue;
        const d = Math.hypot(((v.x + 1) / 2) * r.width - sx, ((1 - v.y) / 2) * r.height - sy);
        if (d < bd) { bd = d; best = { layer: name, item: L.items[k] }; }
      }
    }
    if (best) return onPick(best);
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((sx / r.width) * 2 - 1, -(sy / r.height) * 2 + 1), camera);
    const hit = ray.intersectObject(terrain)[0];
    if (hit) onPick({ ground: toLL(hit.point.x, hit.point.z) });
  });
}

// ---- earthquake overlay ----
export function setShaking(grid, a, b) {
  const t = uni.overlay.value, d = t.image.data;
  // grid row 0 is north; DataTexture row 0 is v = 0 (south) — flip rows
  for (let j = 0; j < VIEW.ny; j++) for (let i = 0; i < VIEW.nx; i++) d[(VIEW.ny - 1 - j) * VIEW.nx + i] = Math.round((grid[j * VIEW.nx + i] / 10) * 255);
  t.needsUpdate = true; uni.overlayOn.value = 1;
  uni.rupA.value.set(...toXZ(...a)); uni.rupB.value.set(...toXZ(...b)); dirty = true;
}
export const setShakeRadius = (km) => { uni.radius.value = km; dirty = true; };
export const clearShaking = () => { uni.overlayOn.value = 0; dirty = true; };

// ---- flood path: yellow line on a black edge (screen-space width), coloured by arrival window ----
// Each vertex knows its earliest and latest arrival; setPathTime recolours: arrived = yellow,
// between the two fronts = pale yellow, not yet reached = grey.
let pathObj = null, pathArr = null, marker = null;
const P_ARRIVED = [1, 0.84, 0.04], P_BAND = [1, 0.95, 0.62], P_IDLE = [0.74, 0.72, 0.62];
export function setPath(pts) {
  clearPath();
  if (pts.length < 2) return;
  const seg = [], arr = [];
  for (let k = 1; k < pts.length; k++) {
    for (const q of [pts[k - 1], pts[k]]) { const [x, z] = toXZ(...q.ll); seg.push(x, heightAt(...q.ll) + 0.6, z); arr.push(q.arrivalH || [0, 0]); }
  }
  pathArr = arr;
  pathObj = [[7, false], [4.2, true]].map(([w, colored], k) => {
    const g = new LineSegmentsGeometry(); g.setPositions(seg);
    if (colored) g.setColors(new Float32Array(seg.length).fill(0.8));
    const m = new LineMaterial({ color: colored ? 0xffffff : 0x1b2a32, linewidth: w, vertexColors: colored, depthTest: false });
    m.resolution.set(host.clientWidth || 1, host.clientHeight || 1); lineMats.push(m);
    const o = new LineSegments2(g, m); o.renderOrder = 3 + k; scene.add(o); return o;
  });
  setPathTime(-1);
}
export function setPathTime(h) {
  if (!pathObj) return;
  const buf = pathObj[1].geometry.attributes.instanceColorStart.data, a = buf.array;
  pathArr.forEach(([e, l], v) => {
    const c = h < 0 ? P_ARRIVED : h >= l ? P_ARRIVED : h >= e ? P_BAND : P_IDLE;
    a.set(c, v * 3);
  });
  buf.needsUpdate = true; dirty = true;
}
export function clearPath() {
  if (pathObj) for (const o of pathObj) { scene.remove(o); o.geometry.dispose(); lineMats.splice(lineMats.indexOf(o.material), 1); o.material.dispose(); }
  pathObj = null; pathArr = null; if (fronts) hideFronts(); dirty = true;
}

// single highlighted location (search result / epicentre / lake): a slim survey pin
export function setMarker(ll, color = '#1B2A32') {
  if (!scene) return;
  if (!marker) {
    marker = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 10, 6), new THREE.MeshBasicMaterial({ color: 0x1b2a32 }));
    stem.position.y = 5; marker.add(stem);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.8, 20, 14), new THREE.MeshBasicMaterial({ color }));
    head.position.y = 10.5; head.name = 'head'; marker.add(head);
    const foot = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.1, 32), new THREE.MeshBasicMaterial({ color: 0x1b2a32, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    foot.rotation.x = -Math.PI / 2; foot.position.y = 0.3; marker.add(foot);
    marker.renderOrder = 4; scene.add(marker);
  }
  marker.getObjectByName('head').material.color.set(color);
  const [x, z] = toXZ(...ll); marker.position.set(x, heightAt(...ll), z); marker.visible = true; dirty = true;
}
export const hideMarker = () => { if (marker) { marker.visible = false; dirty = true; } };

// Earliest and latest flood fronts: two flat rings riding the path.
let fronts = null;
export function setFronts(early, late) {
  if (!scene) return;
  if (!fronts) {
    // earliest front: yellow ring outlined in black; latest front: black ring outlined in yellow
    fronts = [[0xffd60a, 0x1b2a32], [0x1b2a32, 0xffd60a]].map(([fill, line]) => {
      const g = new THREE.Group(), mat = (c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, depthTest: false });
      const outer = new THREE.Mesh(new THREE.RingGeometry(1.9, 3.7, 40), mat(line)), inner = new THREE.Mesh(new THREE.RingGeometry(2.25, 3.35, 40), mat(fill));
      outer.renderOrder = 5; inner.renderOrder = 6; inner.position.y = 0.01; g.add(outer, inner);
      g.rotation.x = -Math.PI / 2; scene.add(g); return g;
    });
  }
  [early, late].forEach((ll, k) => { const f = fronts[k]; f.visible = !!ll; if (ll) { const [x, z] = toXZ(...ll); f.position.set(x, heightAt(...ll) + 0.5, z); } });
  dirty = true;
}
export const hideFronts = () => setFronts(null, null);

// image of the current view (for printing)
export function snapshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/jpeg', 0.85); }
export const ready = () => !!terrain;
