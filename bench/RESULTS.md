# Performance: before → after

Profile: mid-range phone (Lighthouse mobile): 4× CPU slowdown, slow 4G (150 ms RTT, 1.6 Mbps),
390×844 @2×, cold cache, gzip like GitHub Pages. Median of 5 runs. `bench/perf.mjs`, `bench/first-open.mjs`.

| Fix | Metric | Before | After |
|---|---|---|---|
| 1. Routing grid as downstream tiles (2.7 MB → ~70–116 KB per lake) | GLOF first result | 12 648 ms | 1 591 ms |
| 2. Panel content does not wait for the 3D map | content visible | 4 285 ms | 1 709 ms |
| 3. "Load older": fetch needed months in parallel (index counts) | load older #2 / #3 | 879 / 395 ms | 273 / 246 ms |
| 4. three.js in its own chunk + preload data | content visible | 1 695 ms | 748 ms |
| 5. 1024 px texture first, 2048 px when idle | 3D map ready; bytes | 4 417 ms; 696 KB | 2 999 ms; 435 KB |
| 6. 8-bit √-encoded display heights | 3D map ready; bytes | 2 999 ms; 435 KB | 2 634 ms; 364 KB |
| 7. Adaptive pixel ratio during animation | GLOF/quake animation frame p50 | 183 ms | 117 ms |
| 8. No renderer resize while map hidden | back to map from data | 581 ms | 465 ms |
| 9. Shader warm-up — **reverted** (within noise, added complexity) | first quake open | 1 867 ms | 1 697 ms |
| 10. WASM: std `f64::sqrt` (native) instead of libm software sqrt | quake grid (desktop V8) | 8.4 ms | 3.1 ms |

## Baseline → final (all fixes)

| Area | Metric | Baseline | Final |
|---|---|---|---|
| Startup | first paint | 408 ms | 436 ms |
| Startup | content visible | 4 285 ms | 774 ms |
| Startup | 3D map ready | 4 234 ms | 2 691 ms |
| Startup | total blocking time | 382 ms | 227 ms |
| Startup | bytes; critical JS (gz) | 695 KB; 141 KB | 364 KB; 17 KB |
| Screen open | data / quake | 224 / 207 ms | 200 / 146 ms |
| Content | GLOF first result | 12 648 ms | 1 371 ms |
| Content | quake first shaking / slider step | 63 / 274 ms | 28 / 196 ms |
| Content | load older #1 / #2 / #3 | 232 / 879 / 395 ms | 261 / 238 / 282 ms |
| Scrolling | lists, frame p95, janky frames | 16.7 ms, 0 % | 16.7 ms, 0 % (also with all 600 archived rows) |

Caveat: 3D frame times come from SwiftShader (software GPU, with a per-frame canvas readback that real
phones do not have). They are valid for before/after comparison, not as absolute phone frame rates.

## Redesign (relief slab, contours, Anek Latin) — cost check

Same profile. Before = last result above; after = redesigned site.

| Metric | Before | After |
|---|---|---|
| First paint | 436 ms | 464 ms |
| Content visible | 774 ms | 823 ms |
| 3D map ready | 2 691 ms | 2 914 ms |
| Startup bytes | 364 KB | 420 KB (+59 KB font subset) |
| GLOF first result / quake screen open | 1 371 / 146 ms | 1 499 / 126 ms |
| Scrolling p95, janky frames | 16.7 ms, 0 % | 16.8 ms, 0 % |
| First quake open / back to map (SwiftShader) | 1 704 / 485 ms | 1 985 / 842 ms |

Kept: no font preload (it delayed first paint by 156 ms), 1024 px first texture at q74 (−16 KB),
scale-bar updates without layout reads. The first-open rows are ~90 % `GLES2::ReadPixels`
(software GPU + compositor readback), i.e. per-pixel shader cost in the emulator; on a real GPU
the added contour/fog work is a few ALU ops per pixel.
