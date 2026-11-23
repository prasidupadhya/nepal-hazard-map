// Share image for link previews (public/og.jpg). Serve dist first: node bench/serve.mjs 4181 dist
// Usage: PW=<playwright> node scripts/make-share-image.mjs http://localhost:4181/ public/og.jpg
// share image (1200×630): a straight render of the map with the title, in the site's own type
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)(process.env.PW);
const [BASE, OUT] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await p.goto(BASE + '#/'); await p.waitForFunction(() => performance.getEntriesByName('map-ready').length, null, { timeout: 90000 }); await p.waitForTimeout(4000);
await p.evaluate(() => (location.hash = '#/data')); await p.waitForFunction(() => performance.getEntriesByName('view:data').length); await p.waitForTimeout(1000);
await p.evaluate(() => document.querySelector('#pr').click());
await p.waitForFunction(() => document.querySelector('.report img.shot')?.src?.startsWith('data:'), null, { timeout: 30000 });
const map = await p.$eval('.report img.shot', (i) => i.src);
const font = fs.readFileSync(new URL('../public/fonts/anek-latin.woff2', import.meta.url)).toString('base64');
const card = await b.newPage({ viewport: { width: 1200, height: 630 } });
await card.setContent(`<!doctype html><style>@font-face{font-family:Anek;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:400 700;font-stretch:75% 125%}
body{margin:0;width:1200px;height:630px;overflow:hidden;font-family:Anek,sans-serif;color:#1b2a32;background:#f7f9f7}
.map{position:absolute;inset:0;background:url(${map}) 78% 60%/136% auto no-repeat}
.fade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(247,249,247,.97) 0,rgba(247,249,247,.9) 42%,rgba(247,249,247,0) 62%)}
.t{position:absolute;left:64px;top:70px;width:520px}
.brand{display:flex;gap:14px;align-items:center;font-weight:650;font-stretch:118%;font-size:30px}
h1{margin:34px 0 0;font-size:62px;line-height:1.02;font-weight:700;font-stretch:104%;letter-spacing:-.01em}
p{margin:22px 0 0;font-size:25px;line-height:1.35;color:#3d4a50}
.warn{position:absolute;left:64px;bottom:56px;padding:10px 16px;border-left:6px solid #b97800;background:#fbf6ea;font-size:21px;font-weight:560}</style>
<div class="map"></div><div class="fade"></div>
<div class="t"><div class="brand"><svg width="40" height="40" viewBox="0 0 32 32"><path d="M2 25 11 11l4 5 6-9 9 18z" fill="#1B2A32"/><path d="M2 27.5h28" stroke="#0A6787" stroke-width="2"/></svg>Nepal Hazard Map</div>
<h1>Floods, glacial lakes &amp; earthquakes</h1><p>Today’s official river, rain and earthquake data on a 3D map, with what-if scenarios. English and नेपाली.</p></div>
<div class="warn">Not an official warning</div>`);
await card.waitForTimeout(500);
await card.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
await b.close();
