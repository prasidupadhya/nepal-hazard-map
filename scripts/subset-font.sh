#!/bin/sh
# Subset Anek Latin (variable: wdth 75–125, wght) to the characters this site uses.
# Devanagari uses the device's own Nepali font (the Anek Devanagari file is 726 KB).
set -e
pyftsubset node_modules/@fontsource-variable/anek-latin/files/anek-latin-latin-wdth-normal.woff2 \
  --unicodes="U+0020-007E,U+00A0,U+00B0,U+00B1,U+00B3,U+00B7,U+00D7,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2026,U+2212,U+2264,U+2265,U+00B1,U+00B0,U+00B3,U+2009,U+202F" \
  --layout-features='kern,liga,tnum,lnum,case' --flavor=woff2 --output-file=public/fonts/anek-latin.woff2
# keep only the weight range the design uses
fonttools varLib.instancer public/fonts/anek-latin.woff2 wght=400:700 -o public/fonts/anek-latin.woff2 -q
