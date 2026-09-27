# @osm-editor-kit/osm-route-snapper

## 0.1.0-alpha.3

### Patch Changes

- - Installable outside the OSM Editor Kit monorepo: the previous alpha still listed sibling kit packages as `workspace:*` in npm's metadata.

## 0.1.0-alpha.2

### Patch Changes

- - Fix install outside the OSM Editor Kit monorepo: the published `package.json` listed sibling kit packages as `workspace:*`, which npm cannot resolve. They now reference real versions.

## 0.1.0-alpha.1

### Patch Changes

- 9248f97: Update readme
- Updated dependencies [9248f97]
  - @osm-editor-kit/osm-data@0.1.0-alpha.1

## 0.1.0-alpha.0

### Minor Changes

- 8309d44: Initial npm alpha release.

  Core features to date:

  - Build route-snapper bincode graph bytes from merged session `ParsedOsmData` via vendored `osm-to-route-snapper` WASM
  - Serialize parsed OSM coverage to minimal OSM XML for graph conversion
  - Extract routing-network GeoJSON (intersection-split edges) from graph bytes using `route-snapper` WASM
  - GeoJSON LineStrings for Overpass/session highway ways and a coverage graph signature for cache keys
  - TanStack Query factory that rebuilds the graph when Overpass coverage grows

### Patch Changes

- Updated dependencies [8309d44]
  - @osm-editor-kit/osm-data@0.1.0-alpha.0
