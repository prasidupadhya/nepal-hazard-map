// WebAssembly build of the scenario maths (wasm/src/lib.rs). Same API shape as scenario.js.
import { ROUTE } from './grid.js';
export async function loadWasm(bytesOrUrl) {
  const src = typeof bytesOrUrl === 'string' ? fetch(bytesOrUrl) : bytesOrUrl;
  const { instance } = typeof bytesOrUrl === 'string' ? await WebAssembly.instantiateStreaming(src, {}) : await WebAssembly.instantiate(src, {});
  const x = instance.exports, mem = () => x.memory.buffer;
  let routePtrs = null;
  return {
    setRoute(route) {
      x.reset();
      const N = ROUTE.nx * ROUTE.ny, d = x.alloc(N), e = x.alloc(N * 2);
      new Uint8Array(mem(), d, N).set(route.dir); new Int16Array(mem(), e, N).set(route.elev);
      routePtrs = { d, e, out: x.alloc(4000 * 80), grid: x.alloc(4 * 1024 * 1024) };
    },
    glof(lon, lat, vol) {
      const n = x.glof(routePtrs.d, routePtrs.e, lon, lat, vol[0], vol[1], routePtrs.out, 4000), o = new Float64Array(mem(), routePtrs.out, n * 10), r = [];
      for (let k = 0; k < n; k++) { const p = k * 10; r.push({ ll: [o[p], o[p + 1]], km: o[p + 2], z: o[p + 3], arrivalH: [o[p + 4], o[p + 5]], peak: [o[p + 6], o[p + 7]], depth: [o[p + 8], o[p + 9]] }); }
      return r;
    },
    shakingGrid(q, g) {
      if (!routePtrs) { x.reset(); routePtrs = { grid: x.alloc(g.nx * g.ny * 4) }; }
      x.shaking_grid(q.M, q.ll[0], q.ll[1], q.strike, g.step, g.nx, g.ny, routePtrs.grid);
      return new Float32Array(mem(), routePtrs.grid, g.nx * g.ny).slice();
    },
  };
}
