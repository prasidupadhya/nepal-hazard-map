// Static server for dist/ that gzips text like GitHub Pages. Usage: node bench/serve.mjs [port] [dir]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const port = +(process.argv[2] || 4180), root = path.resolve(process.argv[3] || 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.bin': 'application/octet-stream' };
const GZ = new Set(['.html', '.js', '.css', '.json', '.svg']);
http.createServer((req, res) => {
  let f = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const ext = path.extname(f), body = fs.readFileSync(f), h = { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': 'max-age=600' };
  if (GZ.has(ext) && /gzip/.test(req.headers['accept-encoding'] || '')) { h['content-encoding'] = 'gzip'; res.writeHead(200, h); return res.end(zlib.gzipSync(body, { level: 6 })); }
  res.writeHead(200, h); res.end(body);
}).listen(port, () => console.log('serving', root, 'on', port));
