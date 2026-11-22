# Nepal Flood, Glacial Lake & Earthquake Map

A free static website (English and Nepali). It shows a daily copy of official
hazard data on a 3D map and lets people try "what if" scenarios.

**Not an official warning.** For alerts, follow DHM, NEMRC, the Nepal Government
and local authorities.

## Data
| What | Source | How |
|---|---|---|
| River levels, rainfall | DHM (hydrology.gov.np) | BIPAD public API, copied daily |
| Earthquakes | NEMRC (seismonepal.gov.np) | BIPAD public API, copied daily |
| Flood / GLOF incidents | BIPAD (bipadportal.gov.np) | copied daily, archived by month |
| Districts | Constitution of Nepal, Schedule 4 | `src/districts.js` |
| Terrain | AWS Terrain Tiles (SRTM etc.), Natural Earth border | baked once by `scripts/bake-terrain.js` |
| Typeface | Anek Latin (Ek Type), SIL Open Font License | `public/fonts/` (licence in `OFL.txt`) |

Every copy records when it was made and how old the newest reading is; the
site shows both. A failed copy keeps the previous one and says so.

## Commands
```
npm ci
npm test                 # parsers, districts, scenario maths, WASM = JS
npm run fetch            # copy official data now (needs network)
npm run wasm             # rebuild the Rust → WebAssembly scenario engine
npm run build            # static site in dist/
./scripts/subset-font.sh # rebuild the Anek Latin subset (needs: pip install fonttools brotli)
node e2e/check.mjs       # browser checks (serve dist first: npx vite preview)
```

## Hosting (free)
Vercel (Hobby): import this repository; it detects Vite (build `npm run build`,
output `dist`). The workflow in `.github/workflows/daily.yml` copies the data every
day at 06:02 Nepal Time, tests it and commits it; Vercel redeploys on that push.
