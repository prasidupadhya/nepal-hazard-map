// The PNG decoder must give exactly the bytes libpng (sharp) gives, for every file the app reads.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import zlib from 'node:zlib';
import sharp from 'sharp';
import { decodePNG, inflateRaw } from '../src/png.js';

const root = new URL('../public/terrain/', import.meta.url);
const raw = async (buf) => { const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true }); return { data: new Uint8Array(data), ch: info.channels, w: info.width, h: info.height }; };
const same = (a, b) => { expect(a.w).toBe(b.w); expect(a.h).toBe(b.h); expect(a.ch).toBe(b.ch); expect(Buffer.compare(Buffer.from(a.data), Buffer.from(b.data))).toBe(0); };

describe('PNG decoder (no canvas)', () => {
  it('decodes every route tile byte-exact', async () => {
    const files = fs.readdirSync(new URL('route/', root)).filter((f) => f.endsWith('.png'));
    expect(files.length).toBeGreaterThan(500);
    for (const f of files) { const b = fs.readFileSync(new URL('route/' + f, root)); same(await decodePNG(new Uint8Array(b)), await raw(b)); }
  });
  it('decodes the display heights byte-exact', async () => {
    const b = fs.readFileSync(new URL('height.png', root)); same(await decodePNG(new Uint8Array(b)), await raw(b));
  });
  it('the JavaScript inflate (for browsers without DecompressionStream) matches zlib', async () => {
    for (const f of ['route/' + fs.readdirSync(new URL('route/', root))[7], 'height.png']) {
      const b = fs.readFileSync(new URL(f, root)), DS = globalThis.DecompressionStream;
      globalThis.DecompressionStream = undefined;
      try { same(await decodePNG(new Uint8Array(b)), await raw(b)); } finally { globalThis.DecompressionStream = DS; }
    }
    // stored, fixed and dynamic blocks
    const data = Buffer.from(Array.from({ length: 70000 }, (_, i) => (i * 7919) % 251));
    for (const level of [0, 1, 9]) expect(Buffer.compare(Buffer.from(inflateRaw(zlib.deflateRawSync(data, { level }))), data)).toBe(0);
    for (const strategy of [zlib.constants.Z_FIXED, zlib.constants.Z_HUFFMAN_ONLY, zlib.constants.Z_RLE]) expect(Buffer.compare(Buffer.from(inflateRaw(zlib.deflateRawSync(data, { strategy }))), data)).toBe(0);
  });
  it('handles every filter type, alpha and palettes', async () => {
    const w = 37, h = 23, rgba = Buffer.alloc(w * h * 4);
    for (let k = 0; k < rgba.length; k++) rgba[k] = (k * 31 + (k >> 5)) & 255;
    for (const opts of [{ adaptiveFiltering: true }, { adaptiveFiltering: false }, { palette: true, colours: 200, bitdepth: 8 }]) {
      const b = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png({ compressionLevel: 6, ...opts }).toBuffer();
      same(await decodePNG(new Uint8Array(b)), await raw(b));
    }
    const grey = await sharp(rgba.subarray(0, w * h), { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
    same(await decodePNG(new Uint8Array(grey)), await raw(grey));
  });
});
