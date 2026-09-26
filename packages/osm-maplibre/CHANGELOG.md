# @osm-editor-kit/osm-maplibre

## 0.1.0-alpha.2

### Patch Changes

- 676afb8: ### @osm-editor-kit/osm-maplibre

  - Builds and runs against **maplibre-gl 6**, in line with the street-imagery stack and the street-space editor.
  - Apps that depend on this package can adopt MapLibre 6 without version skew against other OSM Editor Kit map packages.

  ### @osm-editor-kit/street-imagery

  - Development and integration tests target **maplibre-gl 6**, matching the rest of the street-imagery family.
  - Street View metadata still returns no result when no Google Maps API key is configured (behavior unchanged; test coverage improved).

  ### @osm-editor-kit/street-imagery-react

  - **Peer dependency** on `maplibre-gl` is now **^6** — upgrade your app’s MapLibre to v6 when you bump this package.
  - React street-imagery UI stays aligned with MapLibre 6 used by `osm-maplibre` and `street-imagery`.

## 0.1.0-alpha.1

### Patch Changes

- 9248f97: Update readme

## 0.1.0-alpha.0

### Minor Changes

- 8309d44: Initial npm alpha release.

  Core features to date:

  - OpenFreeMap Positron basemap style (patched bundled JSON, builder, CDN URL, imagery attribution constant)
  - Null-safe OpenFreeMap style filter patches for numeric compares on missing/null feature properties
  - Custom content anchor layer and source for stacking app overlays above the basemap via `beforeId`
  - MapLibre paint expressions for metre-based line width and offset (`lineWidthFromMeters`, `lineOffsetFromMeters`) with zoom-aware scaling helpers
  - Focus paint helpers (`focusCaseColor`, `focusCaseOpacity`) for active vs muted layer styling
