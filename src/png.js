// PNG → exact pixel bytes in plain JavaScript, without a canvas.
// Why: browsers may change pixels read back from a canvas. Safari's Advanced Fingerprinting
// Protection (on by default since Safari 26, and in private browsing before that), Brave and
// Firefox's resistFingerprinting add noise to getImageData, and colour management can shift values.
// The route tiles store river directions as exact byte codes, so one changed bit breaks tracing.
// Supports what this app uses: 8-bit, non-interlaced, grey / grey+alpha / RGB / RGBA / palette.

export async function fetchPNG(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return decodePNG(new Uint8Array(await r.arrayBuffer()));
}

// → { w, h, ch, data } with `ch` bytes per pixel (palette images come out as RGB / RGBA)
export async function decodePNG(b) {
  const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  if (SIG.some((v, i) => b[i] !== v)) throw new Error('not a PNG');
  const u32 = (i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  let w = 0, h = 0, depth = 0, type = 0, interlace = 0, pal = null, trns = null; const idat = [];
  for (let i = 8; i + 8 <= b.length; ) {
    const n = u32(i), t = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]), d = b.subarray(i + 8, i + 8 + n);
    if (t === 'IHDR') { w = u32(i + 8); h = u32(i + 12); depth = d[8]; type = d[9]; interlace = d[12]; }
    else if (t === 'PLTE') pal = d;
    else if (t === 'tRNS') trns = d;
    else if (t === 'IDAT') idat.push(d);
    else if (t === 'IEND') break;
    i += 12 + n;
  }
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (depth !== 8 || interlace || !ch || !w || !h) throw new Error(`unsupported PNG (depth ${depth}, type ${type}, interlace ${interlace})`);
  let z = idat.length === 1 ? idat[0] : new Uint8Array(idat.reduce((s, d) => s + d.length, 0));
  if (idat.length > 1) { let o = 0; for (const d of idat) { z.set(d, o); o += d.length; } }
  const stride = w * ch, raw = await inflate(z, h * (stride + 1));
  if (raw.length < h * (stride + 1)) throw new Error('PNG data too short');
  // undo the per-row filters
  const px = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, o = y * stride, p = o - stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[src + x], a = x >= ch ? px[o + x - ch] : 0, up = y ? px[p + x] : 0, c = y && x >= ch ? px[p + x - ch] : 0;
      let r;
      switch (f) {
        case 0: r = v; break;
        case 1: r = v + a; break;
        case 2: r = v + up; break;
        case 3: r = v + ((a + up) >> 1); break;
        case 4: { const q = a + up - c, pa = Math.abs(q - a), pb = Math.abs(q - up), pc = Math.abs(q - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? up : c); break; }
        default: throw new Error('bad PNG filter ' + f);
      }
      px[o + x] = r;
    }
  }
  if (type !== 3) return { w, h, ch, data: px };
  // palette → RGB(A)
  const oc = trns ? 4 : 3, out = new Uint8Array(w * h * oc);
  for (let k = 0; k < w * h; k++) {
    const e = px[k]; out[k * oc] = pal[3 * e]; out[k * oc + 1] = pal[3 * e + 1]; out[k * oc + 2] = pal[3 * e + 2];
    if (trns) out[k * oc + 3] = e < trns.length ? trns[e] : 255;
  }
  return { w, h, ch: oc, data: out };
}

// zlib stream → bytes. The browser's own decompressor when there is one, else the JavaScript one below.
async function inflate(z, size) {
  if (typeof DecompressionStream === 'function') {
    try {
      const s = new Blob([z]).stream().pipeThrough(new DecompressionStream('deflate'));
      return new Uint8Array(await new Response(s).arrayBuffer());
    } catch { /* fall through */ }
  }
  return inflateRaw(z.subarray(2), size); // skip the 2-byte zlib header
}

// ---- small DEFLATE decoder (RFC 1951), after Mark Adler's puff.c ----
const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
function huff(lengths) {
  const count = new Uint16Array(16), sym = new Uint16Array(lengths.length), offs = new Uint16Array(16);
  for (const l of lengths) count[l]++;
  count[0] = 0;
  for (let l = 1; l < 16; l++) offs[l] = offs[l - 1] + count[l - 1];
  lengths.forEach((l, s) => { if (l) sym[offs[l]++] = s; });
  return { count, sym };
}
let FIXED = null;
export function inflateRaw(src, size = 1 << 16) {
  let out = new Uint8Array(size), n = 0, pos = 0, buf = 0, cnt = 0;
  const need = (k) => { if (n + k > out.length) { const o = new Uint8Array(Math.max(out.length * 2, n + k)); o.set(out); out = o; } };
  const bits = (k) => {
    while (cnt < k) { if (pos >= src.length) throw new Error('deflate: out of input'); buf |= src[pos++] << cnt; cnt += 8; }
    const v = buf & ((1 << k) - 1); buf >>>= k; cnt -= k; return v;
  };
  const decode = (hf) => {
    let code = 0, first = 0, index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bits(1); const c = hf.count[len];
      if (code - c < first) return hf.sym[index + (code - first)];
      index += c; first += c; first <<= 1; code <<= 1;
    }
    throw new Error('deflate: bad code');
  };
  let last = 0;
  while (!last) {
    last = bits(1); const type = bits(2);
    if (type === 0) {
      buf = 0; cnt = 0; // stored block: byte-aligned
      const len = src[pos] | (src[pos + 1] << 8); pos += 4;
      need(len); out.set(src.subarray(pos, pos + len), n); n += len; pos += len;
      continue;
    }
    let lit, dist;
    if (type === 1) {
      if (!FIXED) { const l = new Array(288).fill(8, 0, 144).fill(9, 144, 256).fill(7, 256, 280).fill(8, 280, 288); FIXED = [huff(l), huff(new Array(30).fill(5))]; }
      [lit, dist] = FIXED;
    } else if (type === 2) {
      const nl = bits(5) + 257, nd = bits(5) + 1, nc = bits(4) + 4, cl = new Array(19).fill(0);
      for (let i = 0; i < nc; i++) cl[ORDER[i]] = bits(3);
      const ch = huff(cl), lens = [];
      while (lens.length < nl + nd) {
        const s = decode(ch);
        if (s < 16) lens.push(s);
        else if (s === 16) { const p = lens[lens.length - 1]; for (let r = 3 + bits(2); r--; ) lens.push(p); }
        else if (s === 17) for (let r = 3 + bits(3); r--; ) lens.push(0);
        else for (let r = 11 + bits(7); r--; ) lens.push(0);
      }
      lit = huff(lens.slice(0, nl)); dist = huff(lens.slice(nl));
    } else throw new Error('deflate: bad block type');
    for (;;) {
      let s = decode(lit);
      if (s < 256) { need(1); out[n++] = s; continue; }
      if (s === 256) break;
      s -= 257; const len = LBASE[s] + bits(LEXT[s]);
      const d = decode(dist), back = DBASE[d] + bits(DEXT[d]);
      need(len); for (let i = 0; i < len; i++, n++) out[n] = out[n - back];
    }
  }
  return out.subarray(0, n);
}
