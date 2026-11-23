// App icons (home screen, browser tab, install) from the site's mountain mark. Run: node scripts/make-icons.js
import sharp from 'sharp';
import fs from 'node:fs';

const OUT = 'public/icons/';
fs.mkdirSync(OUT, { recursive: true });
// pad = share of the canvas left empty around the mark (maskable icons need ~20% safe area)
const svg = (pad, bg) => {
  const s = 32 / (1 - 2 * pad), o = -pad * s; // the mark spans y 7–28.5, so the view is shifted 1.75 down to centre it
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${o} ${o + 1.75} ${s} ${s}">
    ${bg ? `<rect x="${o}" y="${o + 1.75}" width="${s}" height="${s}" fill="${bg}"/>` : ''}
    <path d="M2 25 11 11l4 5 6-9 9 18z" fill="#1B2A32"/><path d="M2 27.5h28" stroke="#0A6787" stroke-width="2"/></svg>`);
};
const make = (file, size, pad, bg) => sharp(svg(pad, bg), { density: 72 * (size / 32) }).resize(size, size).png({ compressionLevel: 9 }).toFile(OUT + file);
await make('icon-192.png', 192, 0.14, '#F7F9F7');
await make('icon-512.png', 512, 0.14, '#F7F9F7');
await make('maskable-512.png', 512, 0.24, '#F7F9F7');
await make('apple-touch-icon.png', 180, 0.14, '#F7F9F7');
fs.writeFileSync(OUT + 'icon.svg', svg(0.06, null));
console.log(fs.readdirSync(OUT));
