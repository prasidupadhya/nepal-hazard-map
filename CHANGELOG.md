# Changelog

## 1.0.0 (2026-11-23)

The first complete release.

### What the site does
- **Latest official data, copied every morning:** river levels and rainfall
  (DHM), earthquakes (NEMRC) and flood and GLOF reports (BIPAD). Each dataset
  shows how old it is, and a failed copy keeps the previous one and says so.
- **3D relief map of Nepal:** rivers, place names, search by district, local
  level, river station or lake, and sharp close-up terrain when zoomed in.
- **Trace any river downstream to the Nepal border:** tap a river, a gauge or
  any spot on the land.
- **What if a glacial lake bursts?** All 47 potentially dangerous glacial
  lakes that would flood Nepal (ICIMOD 2020), each with a volume range. The
  flood is routed to the Nepal border with arrival times, peak flow and depth
  as ranges.
- **What if a big earthquake hits?** Likely shaking for all 77 districts, as
  a band.
- **Share links** that reopen the exact scenario, and **printed reports** on two
  A4 pages with a north-up map, key figures and an arrival-time chart.
- **English and Nepali** throughout, district names as in the Constitution.

### Quality
- Works on any phone: tested at 360 px, with touch, with Safari's
  fingerprinting protection, without WebGL, and with failed downloads.
- Scenario maths in Rust → WebAssembly, kept identical to the JavaScript
  reference by tests.
- Accessibility checked (names, labels, contrast, tap targets, headings) in
  both languages.
- Strict Content Security Policy and security headers; installable.
- CI on every pull request: unit tests, WebAssembly build, browser checks.

Not an official warning. For alerts, follow DHM, NEMRC, the Nepal Government
and local authorities.
