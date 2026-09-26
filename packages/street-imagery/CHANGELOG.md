# @osm-editor-kit/street-imagery

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

  - Provider adapter registry with ten sources (Mapillary, Panoramax, KartaView, Mapilio, Bing Streetside, Vegbilder, Google Street View, Apple Look Around, plus Mapillary signs and map features)
  - Normalized photo, sequence, and map-feature types with bbox/tile-based fetching
  - GeoJSON builders for photo points, sequence lines, and map-feature points
  - Viewfield geometry (heading wedges, pano disks, view cones) for map layers
  - Search filters by capture date, flat vs panorama, with MapLibre expression helpers
  - MVT tile fetch/decode, tile math, and in-memory tile cache
  - Runtime config (Mapillary token, Panoramax API base)
  - Viewer helpers: external deep links, click-radius nearest-photo grouping, thumbnail URL resolution
