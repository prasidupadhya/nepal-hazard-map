// Loads the three.js map in its own chunk so text never waits for it.
// Calls made before it has loaded do nothing (views re-apply map state after mapReady).
let m = null;
export const mapModule = import('./map3d.js').then((x) => (m = x));
export const map = new Proxy({}, { get: (_, k) => (...a) => (m ? m[k](...a) : k === 'ready' ? false : undefined) });
