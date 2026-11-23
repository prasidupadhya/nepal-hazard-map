# Third-party data, fonts and software

The project's own source code is under the MIT License (see `LICENSE`).
The material below comes from other publishers. It is credited here and in
the site's About page. Each item stays under its publisher's terms. If you
reuse or redistribute it, check those terms yourself; nothing here grants
rights the publishers have not granted.

## Official hazard data (copied daily into `public/data/`)

| Data | Publisher | Copied from |
|---|---|---|
| River levels, rainfall | Department of Hydrology and Meteorology (DHM), Government of Nepal, hydrology.gov.np | BIPAD public API |
| Earthquakes | National Earthquake Monitoring and Research Center (NEMRC), Government of Nepal, seismonepal.gov.np | BIPAD public API |
| Flood and GLOF incident reports, districts, local levels | BIPAD portal, National Disaster Risk Reduction and Management Authority (NDRRMA), bipadportal.gov.np | BIPAD public API |

Rights in this data remain with the Government of Nepal agencies above. The
copies are kept so the site works offline-first and shows how old each
reading is. They are not an official record. For alerts, follow DHM, NEMRC,
the Nepal Government and local authorities.

District names follow the Constitution of Nepal, Schedule 4.

## Terrain and rivers (baked into `public/terrain/`)

- **Elevation:** AWS Terrain Tiles (Terrarium format), originally produced by
  Mapzen and hosted by the AWS Open Data programme. They combine SRTM, GMTED2010,
  ETOPO1 and other public sources. Attribution requirements are listed at
  <https://github.com/tilezen/joerd/blob/master/docs/attribution.md>.
- **River flow directions:** HydroSHEDS 15″ (Lehner, B., Verdin, K., Jarvis, A.
  (2008), *New global hydrography derived from spaceborne elevation data*,
  Eos 89(10): 93–94). Licence: <https://www.hydrosheds.org>.
- **Country outline:** Natural Earth (public domain), through the `world-atlas`
  npm package.

## Glacial lakes (`scripts/data/`, `src/lakes.js`)

- The list of 47 potentially dangerous glacial lakes: ICIMOD (2020),
  *Glacial lakes and glacial lake outburst floods in Nepal*, Table 5.6.
- Surveyed volumes of Tsho Rolpa, Imja Tsho and Thulagi: ICIMOD (2011),
  *Glacial lakes and glacial lake outburst floods in Nepal*.
- Lake water areas: measured on Copernicus Sentinel-2 imagery (ESA), read
  through the Element 84 Earth Search STAC catalogue. Contains modified
  Copernicus Sentinel data.
- Volume estimate from area: Huggel, C., Kääb, A., Haeberli, W., Teysseire, P.,
  Paul, F. (2002), Canadian Geotechnical Journal 39: 316–330.

## Scenario methods (formulas, no data copied)

Evans (1986) and Huggel et al. (2002) peak flow; Manning's equation; Atkinson &
Wald (2007) intensity; Wells & Coppersmith (1994) rupture length. Full
references are on the About page.

## Fonts

- **Anek Latin** by Ek Type, SIL Open Font License 1.1 (`public/fonts/OFL.txt`).
  The file in `public/fonts/` is a subset made by `scripts/subset-font.sh`.

## Software libraries

Installed from npm and crates.io under their own licences. The main ones are
three.js (MIT), Vite (MIT), Vitest (MIT), sharp (Apache-2.0), geotiff (MIT),
proj4 (MIT), pngjs (MIT), topojson-client (ISC), world-atlas (ISC) and the Rust
crate libm (MIT). See `package-lock.json` and `wasm/Cargo.lock` for
the full list.
