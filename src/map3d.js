// three.js terrain map. Renders on demand (only while something moves) to save battery.
import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { BOX, VIEW, kmPerDegLon, KM_PER_DEG_LAT } from './grid.js';
import { MMI_COLORS } from './colors.js';

const C = { lon: (BOX.w + BOX.e) / 2, lat: (BOX.s + BOX.n) / 2 };
const KX = kmPerDegLon(C.lat), EXAG = 2.5;
export const toXZ = (lon, lat) => [(lon - C.lon) * KX, (C.lat - lat) * KM_PER_DEG_LAT];
export const toLL = (x, z) => [C.lon + x / KX, C.lat - z / KM_PER_DEG_LAT];

let firstFrame = false, renderer, scene, camera, controls, terrain, heights, host, dirty = true, anim = null, onPick = null, onFrame = null;
const layers = {};
const uni = {
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

const vert = `varying vec2 vUv; varying vec2 vXZ;
void main(){ vUv = uv; vXZ = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const frag = `uniform sampler2D map; uniform sampler2D overlay; uniform float overlayOn; uniform vec2 rupA; uniform vec2 rupB; uniform float radius;
varying vec2 vUv; varying vec2 vXZ;
uniform vec3 pal[11];
vec3 mmiColor(float m){ int i = int(clamp(floor(m), 1., 9.)); return mix(pal[i], pal[i + 1], clamp(m - float(i), 0., 1.)); }
void main(){
  vec3 base = texture2D(map, vUv).rgb;
  if (overlayOn > 0.5) {
    vec2 ab = rupB - rupA; float t = clamp(dot(vXZ - rupA, ab) / max(dot(ab,ab), 1e-6), 0., 1.);
    float d = length(vXZ - (rupA + t*ab));
    float m = texture2D(overlay, vUv).r * 10.;
    float shown = 1. - smoothstep(radius - 12., radius, d);
    float ring = (1. - smoothstep(0., 6., abs(d - radius))) * step(d, radius + 6.) * step(1., radius);
    float a = shown * smoothstep(3.5, 5.5, m) * .5;
    base = mix(base, mmiColor(m), a) + ring * .35;
  }
  gl_FragColor = vec4(base, 1.);
}`;

export async function init(el, { onPick: pick, onFrame: frame } = {}) {
  host = el; onPick = pick; onFrame = frame;
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x0d1620);
  el.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0d1620, 900, 2200);
  camera = new THREE.PerspectiveCamera(45, 1, 1, 4000);
  camera.position.set(0, 520, 520);
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
  pickHandlers(renderer.domElement);
  loop();
  // swap in the sharp texture once the page is idle (not on Data Saver)
  if (!navigator.connection?.saveData) (window.requestIdleCallback || setTimeout)(() => new THREE.TextureLoader().loadAsync('terrain/texture.jpg').then((hi) => {
    hi.colorSpace = THREE.SRGBColorSpace; hi.anisotropy = tex.anisotropy; const old = uni.map.value; uni.map.value = hi; old.dispose(); dirty = true;
  }).catch(() => {}), { timeout: 4000 });
}

function resize() {
  if (!renderer) return;
  const w = host.clientWidth || 1, h = host.clientHeight || 1;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true;
}
export const requestRender = () => { dirty = true; };

function loop(now) {
  requestAnimationFrame(loop);
  if (anim) { const p = Math.min(1, (now - anim.t0) / anim.ms); anim.step(p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2); if (p >= 1) anim = null; dirty = true; }
  if (onFrame && onFrame(now)) dirty = true;
  const moved = controls.update();
  if (dirty || moved) { renderer.render(scene, camera); dirty = false; if (terrain && !firstFrame) { firstFrame = true; performance.mark('map-ready'); } }
}

// Smooth camera flight to a place; `dist` = viewing distance in km.
export function flyTo(lon, lat, dist = 120, ms = 1400) {
  if (!camera) return;
  const [x, z] = toXZ(lon, lat), y = heightAt(lon, lat);
  const t0 = controls.target.clone(), t1 = new THREE.Vector3(x, y, z);
  const off0 = camera.position.clone().sub(t0), off1 = new THREE.Vector3(0, dist * 0.8, dist * 0.6);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) ms = 1;
  anim = { t0: performance.now(), ms, step: (e) => { controls.target.lerpVectors(t0, t1, e); camera.position.copy(controls.target).add(off0.clone().lerp(off1, e)); } };
}
// distance that fits the whole country in the current view
export function overview() {
  const W = (BOX.e - BOX.w) * KX * 0.98, hf = Math.atan(Math.tan(((camera.fov / 2) * Math.PI) / 180) * camera.aspect);
  flyTo(C.lon, C.lat - 0.25, Math.min(1100, Math.max(380, (W / 2 / Math.tan(hf)) * (camera.aspect < 1 ? 0.7 : 0.95))));
}

// ---- point layers ----
const ptVert = `attribute vec3 color; attribute float size; varying vec3 vC;
void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = size * clamp(300. / -mv.z, .8, 2.2); gl_Position = projectionMatrix * mv; }`;
const ptFrag = `varying vec3 vC; void main(){ vec2 p = gl_PointCoord*2.-1.; float r = dot(p,p); if (r>1.) discard; float edge = smoothstep(.55,.75,r); gl_FragColor = vec4(mix(vC, vec3(1.), edge*.9), 1.); }`;
export function setPoints(name, items, colorOf, sizeOf = () => 9) {
  if (layers[name]) { scene.remove(layers[name].obj); layers[name].obj.geometry.dispose(); }
  const n = items.length, p = new Float32Array(n * 3), c = new Float32Array(n * 3), s = new Float32Array(n), col = new THREE.Color();
  items.forEach((it, k) => { const [x, z] = toXZ(...it.ll); p.set([x, heightAt(...it.ll) + 0.6, z], 3 * k); col.set(colorOf(it)); c.set([col.r, col.g, col.b], 3 * k); s[k] = sizeOf(it) * Math.min(devicePixelRatio, 2); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('size', new THREE.BufferAttribute(s, 1));
  const obj = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: ptVert, fragmentShader: ptFrag, depthTest: true }));
  obj.renderOrder = 2; scene.add(obj); layers[name] = { obj, items, visible: true }; dirty = true;
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
      const a = L.obj.geometry.attributes.position.array;
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

// ---- flood path: ribbon draped on terrain, coloured by arrival window ----
let pathObj = null, marker = null;
const pathUni = { uT: { value: -1 } };
const pVert = `attribute vec2 arr; varying vec2 vArr; varying float vSide; attribute float side;
void main(){ vArr = arr; vSide = side; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;
const pFrag = `uniform float uT; varying vec2 vArr; varying float vSide;
void main(){
  float edge = 1. - smoothstep(.6, 1., abs(vSide));
  vec3 idle = vec3(.55,.75,1.), reached = vec3(.1,.45,1.), band = vec3(1.,.55,.1);
  vec3 c = idle; float a = .55;
  if (uT >= 0.) {
    if (uT >= vArr.y) { c = reached; a = .95; }
    else if (uT >= vArr.x) { float f = (uT - vArr.x) / max(vArr.y - vArr.x, 1e-3); c = mix(band, reached, f); a = .95; }
    else { a = .35; }
  }
  gl_FragColor = vec4(c, a * (.35 + .65 * edge));
}`;
export function setPath(pts) {
  clearPath();
  if (!pts.length) return;
  const n = pts.length, W = 1.4, pos = new Float32Array(n * 6), arr = new Float32Array(n * 4), side = new Float32Array(n * 2), idx = [];
  const xz = pts.map((p) => toXZ(...p.ll));
  for (let k = 0; k < n; k++) {
    const a = xz[Math.max(0, k - 2)], b = xz[Math.min(n - 1, k + 2)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1, nxv = -dz / L, nzv = dx / L;
    const y = heightAt(...pts[k].ll) + 0.35;
    pos.set([xz[k][0] + nxv * W, y, xz[k][1] + nzv * W, xz[k][0] - nxv * W, y, xz[k][1] - nzv * W], 6 * k);
    const t = pts[k].arrivalH || [0, 0]; arr.set([t[0], t[1], t[0], t[1]], 4 * k); side.set([1, -1], 2 * k);
    if (k) { const p = 2 * (k - 1), q = 2 * k; idx.push(p, p + 1, q, q, p + 1, q + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('arr', new THREE.BufferAttribute(arr, 2)); g.setAttribute('side', new THREE.BufferAttribute(side, 1)); g.setIndex(idx);
  pathObj = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: pathUni, vertexShader: pVert, fragmentShader: pFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  pathObj.renderOrder = 3; scene.add(pathObj); dirty = true;
}
export const setPathTime = (h) => { pathUni.uT.value = h; dirty = true; };
export function clearPath() { if (pathObj) { scene.remove(pathObj); pathObj.geometry.dispose(); pathObj = null; } pathUni.uT.value = -1; dirty = true; }

// single highlighted location (search result / epicentre / lake)
export function setMarker(ll, color = '#ff3b30') {
  if (!scene) return;
  if (!marker) {
    marker = new THREE.Group();
    const pin = new THREE.Mesh(new THREE.ConeGeometry(2.2, 9, 12), new THREE.MeshBasicMaterial({ color }));
    pin.rotation.x = Math.PI; pin.position.y = 6; marker.add(pin);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3, 4.2, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.5; marker.add(ring); marker.renderOrder = 4;
    scene.add(marker);
  }
  marker.children.forEach((m) => m.material.color.set(color));
  const [x, z] = toXZ(...ll); marker.position.set(x, heightAt(...ll), z); marker.visible = true; dirty = true;
}
export const hideMarker = () => { if (marker) { marker.visible = false; dirty = true; } };

// image of the current view (for printing)
export function snapshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/jpeg', 0.85); }
export const ready = () => !!terrain;
