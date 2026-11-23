import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// After the build: give the service worker the list of files the app needs to open offline,
// and a version made from their contents (a new deploy = a new version = fresh caches).
const PRECACHE = [/^index\.html$/, /^assets\//, /^manifest\.webmanifest$/, /^icons\//, /^fonts\/.+\.woff2$/, /^wasm\//,
  /^terrain\/(height\.png|texture-1024\.jpg|border\.json|rivers\.json|route\/index\.json)$/, /^data\/(latest|places)\.json$/];
function serviceWorker() {
  let out = 'dist';
  return {
    name: 'service-worker',
    apply: 'build',
    configResolved(c) { out = c.build.outDir; },
    closeBundle() {
      const files = [], walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); f.isDirectory() ? walk(p) : files.push(path.relative(out, p).split(path.sep).join('/')); } };
      walk(out);
      const list = files.filter((f) => PRECACHE.some((r) => r.test(f))).sort();
      const hash = crypto.createHash('sha256');
      for (const f of list) if (!f.startsWith('data/')) hash.update(f).update(fs.readFileSync(path.join(out, f)));
      const urls = list.map((f) => (f === 'index.html' ? './' : f));
      const sw = path.join(out, 'sw.js');
      fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace("'__VERSION__'", JSON.stringify(hash.digest('hex').slice(0, 12))).replace('__PRECACHE__', JSON.stringify(urls)));
    },
  };
}

export default { base: './', build: { target: 'es2022' }, plugins: [serviceWorker()], test: { include: ['test/**/*.test.js'] } };
