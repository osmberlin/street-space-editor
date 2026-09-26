# @osm-editor-kit/osm-coverage

## 0.1.0-alpha.3

### Patch Changes

- - Fix install outside the OSM Editor Kit monorepo: the published `package.json` listed sibling kit packages as `workspace:*`, which npm cannot resolve. They now reference real versions.

## 0.1.0-alpha.2

### Patch Changes

- 9248f97: Update readme
- Updated dependencies [9248f97]
  - @osm-editor-kit/osm-data@0.1.0-alpha.1

## 0.1.0-alpha.0

### Minor Changes

- 8309d44: Initial npm alpha release.

  Core features to date:

  - `createOsmCoverageApi` factory with TanStack Query session state (parsed OSM graph, coverage polygon, fetch-history GeoJSON) and `ensureCoverage` for incremental viewport downloads
  - Coverage geometry: missing-area detection, zoom-aware pixel buffering, strip vs full fetch heuristics, `unionIntoCoverage`, and capped fetch-history tracking
  - Overpass helpers: `boundsToOverpassBbox`, `buildOverpassInterpreterUrl`, and preset endpoints (`overpassDeUrl`, `overpassVkUrl`)
  - `OsmDataSource` enum for selecting download backends
  - `/dev-osm-map-fixture` subpath: local OSM Map API fixture handler, bbox element filtering, and fixture index loader

### Patch Changes

- Updated dependencies [8309d44]
  - @osm-editor-kit/osm-data@0.1.0-alpha.0
