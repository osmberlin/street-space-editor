# @osm-editor-kit/osm-way-chain

## 0.1.0-alpha.3

### Patch Changes

- - Fix install outside the OSM Editor Kit monorepo: the published `package.json` listed sibling kit packages as `workspace:*`, which npm cannot resolve. They now reference real versions.

## 0.1.0-alpha.2

### Minor Changes

- Add app-owned `OsmWaySelectionPolicy` contract (`tag` helpers, compile/match, `buildWaysOverpassQuery`). Highway inclusion lists move out of package core; legacy road-like helpers are deprecated.

### Patch Changes

- 9248f97: Update readme
- Updated dependencies [9248f97]
  - @osm-editor-kit/osm-data@0.1.0-alpha.1

## 0.1.0-alpha.1

### Patch Changes

- 9248f97: Update readme
- Updated dependencies [9248f97]
  - @osm-editor-kit/osm-data@0.1.0-alpha.1

## 0.1.0-alpha.0

### Minor Changes

- 8309d44: Initial npm alpha release.

  Core features to date:

  - Bidirectional way-chain traversal from a center segment via `OsmDataAdapter`, with per-side limits and optional candidate filters
  - Junction handling: score and auto-pick neighbor ways (same kind, name, ref) or surface ambiguous choices for `extendChainAtJunction`
  - Segment orientation: flip geometry and normalize directional OSM tags when chaining reversed ways
  - `mirrorTags` for reversing way digitization (left/right, forward/backward, oneway, lane pipes, placement, and related keys)
  - Road-like highway predicates with `public` vs `inclusive` inclusion style, plus Overpass selectors for lane-mode chains
  - Session graph adapter backed by in-memory `ParsedOsmData` (`createSessionGraphAdapter`, `osmWayToSegment`)

### Patch Changes

- Updated dependencies [8309d44]
  - @osm-editor-kit/osm-data@0.1.0-alpha.0
