// Same maths as src/scenario.js (the JS version is the test oracle).

const W: f64 = 79.9; const N: f64 = 30.5;
const RSTEP: f64 = 1.0 / 240.0; const RNX: i32 = 2016; const RNY: i32 = 1020; // HydroSHEDS 15″ grid (see src/grid.js)
const KM_LAT: f64 = 111.32;
const D8: [(i32, i32); 8] = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)];
// see src/scenario.js: NEPAL_BIT marks cells inside Nepal; a path ends BORDER_TOL cells after leaving Nepal, trimmed to the border
const NEPAL_BIT: u8 = 16; const NEAR_BIT: u8 = 32; const BORDER_TOL: i32 = 6;

#[inline] fn km_lon(lat: f64) -> f64 { 111.32 * libm::cos(lat * core::f64::consts::PI / 180.0) }
#[inline] fn sqrt(x: f64) -> f64 { x.sqrt() } // std: native f64.sqrt instruction (libm's is software)
#[inline] fn hyp(a: f64, b: f64) -> f64 { sqrt(a * a + b * b) }
#[inline] fn clamp(m: f64) -> f64 { if m < 1.0 { 1.0 } else if m > 10.0 { 10.0 } else { m } }

static mut HEAP: [u8; 16 << 20] = [0; 16 << 20];
static mut TOP: usize = 0;
#[no_mangle] pub extern "C" fn reset() { unsafe { TOP = 0; } }
#[no_mangle] pub extern "C" fn alloc(n: usize) -> *mut u8 {
    // align the absolute address (the static's own alignment is only 1 byte)
    unsafe { let base = core::ptr::addr_of_mut!(HEAP).cast::<u8>(); let p = ((base as usize + TOP + 7) & !7) - base as usize; TOP = p + n; base.add(p) }
}

fn mmi(m: f64, d: f64) -> f64 {
    let r = sqrt(d * d + 196.0); let lr = libm::log10(r);
    let b = { let x = libm::log10(r / 50.0); if x > 0.0 { x } else { 0.0 } };
    12.27 + 2.27 * (m - 6.0) + 0.1304 * (m - 6.0) * (m - 6.0) - 1.3 * lr - 0.000707 * r + 1.95 * b - 0.577 * m * lr
}

#[no_mangle]
pub extern "C" fn shaking_grid(m: f64, lon0: f64, lat0: f64, strike: f64, step: f64, nx: i32, ny: i32, out: *mut f32) {
    let kx = km_lon(lat0); let th = strike * core::f64::consts::PI / 180.0;
    let (ux, uy) = (libm::sin(th), libm::cos(th));
    let half = libm::pow(10.0, -2.44 + 0.59 * m) / 2.0;
    let o = unsafe { core::slice::from_raw_parts_mut(out, (nx * ny) as usize) };
    for j in 0..ny {
        let lat = N - (j as f64 + 0.5) * step; let y = (lat - lat0) * KM_LAT;
        for i in 0..nx {
            let x = (W + (i as f64 + 0.5) * step - lon0) * kx;
            let mut t = x * ux + y * uy; if t < -half { t = -half } if t > half { t = half }
            let d = hyp(x - t * ux, y - t * uy);
            o[(j * nx + i) as usize] = clamp(mmi(m, d)) as f32;
        }
    }
}

fn hyd(q: f64, n: f64, a: f64, s: f64) -> (f64, f64) {
    let b = a * sqrt(q); let h = libm::pow(q * n / (b * sqrt(s)), 0.6); let v = q / (b * h);
    let c = 5.0 / 3.0 * v; (h, if c > 15.0 { 15.0 } else { c })
}

/// Writes 10 f64 per path point: lon, lat, km, z, tFastH, tSlowH, qLo, qHi, dLo, dHi. Returns count.
#[no_mangle]
pub extern "C" fn glof(dir: *const u8, elev: *const i16, lon: f64, lat: f64, vlo: f64, vhi: f64, out: *mut f64, max: i32) -> i32 {
    let n = (RNX * RNY) as usize;
    let (dir, elev) = unsafe { (core::slice::from_raw_parts(dir, n), core::slice::from_raw_parts(elev, n)) };
    let o = unsafe { core::slice::from_raw_parts_mut(out, (max * 10) as usize) };
    // trace
    let (mut i, mut j) = (libm::floor((lon - W) / RSTEP) as i32, libm::floor((N - lat) / RSTEP) as i32);
    let mut cnt = 0i32; let mut km = 0.0; let mut entered = false; let mut outside = 0i32; let mut inside: Vec<bool> = Vec::new();
    while cnt < max && i >= 0 && j >= 0 && i < RNX && j < RNY {
        let k = (j * RNX + i) as usize;
        let lo = W + (i as f64 + 0.5) * RSTEP; let la = N - (j as f64 + 0.5) * RSTEP;
        if cnt > 0 { let p = ((cnt - 1) * 10) as usize; km += hyp((lo - o[p]) * km_lon(la), (la - o[p + 1]) * KM_LAT); }
        let p = (cnt * 10) as usize; o[p] = lo; o[p + 1] = la; o[p + 2] = km; o[p + 3] = elev[k] as f64; cnt += 1;
        let ins = dir[k] & NEPAL_BIT != 0; inside.push(ins);
        if ins { entered = true; outside = 0; } else { if entered { outside += 1; if outside > BORDER_TOL { break; } } if dir[k] & NEAR_BIT == 0 && elev[k] < 400 { break; } }
        let d = dir[k] & 15; if d == 0 { break; }
        i += D8[(d - 1) as usize].0; j += D8[(d - 1) as usize].1;
    }
    if entered { while cnt > 1 && !inside[(cnt - 1) as usize] { cnt -= 1; } }
    // hydraulics
    // lowest and highest of both formulas (they cross near 1.3 million m³)
    let ev = |v: f64| 0.72 * libm::pow(v * 1e6, 0.53); let hu = |v: f64| 0.00077 * libm::pow(v * 1e6, 1.017);
    let qp_lo = ev(vlo).min(hu(vlo)); let qp_hi = ev(vhi).max(hu(vhi));
    let (mut tf, mut ts) = (0.0, 0.0);
    for k in 0..cnt {
        let at = |q: i32, f: usize| o[(q * 10) as usize + f];
        let kmk = at(k, 2);
        let (mut a, mut b) = (k, k);
        while a > 0 && kmk - at(a, 2) < 1.0 { a -= 1; }
        while b < cnt - 1 && at(b, 2) - kmk < 1.0 { b += 1; }
        let mut den = (at(b, 2) - at(a, 2)) * 1000.0; if den < 0.25 { den = 0.25; }
        let mut s = (at(a, 3) - at(b, 3)) / den; if s < 0.0005 { s = 0.0005; }
        let qlo = qp_lo * libm::exp(-kmk / 40.0); let qhi = qp_hi * libm::exp(-kmk / 150.0);
        let fast = hyd(qhi, 0.04, 2.5, s); let slow = hyd(qlo, 0.08, 5.0, s);
        if k > 0 { let dx = (kmk - at(k - 1, 2)) * 1000.0; tf += dx / fast.1; ts += dx / slow.1; }
        let p = (k * 10) as usize;
        o[p + 4] = tf / 3600.0; o[p + 5] = ts / 3600.0; o[p + 6] = qlo; o[p + 7] = qhi;
        o[p + 8] = hyd(qlo, 0.04, 5.0, s).0; o[p + 9] = hyd(qhi, 0.08, 2.5, s).0;
    }
    cnt
}
