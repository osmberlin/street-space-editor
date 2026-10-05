---
'@osm-editor-kit/street-imagery': patch
'@osm-editor-kit/street-imagery-react': patch
---

- **Mapillary lines when zoomed out**: `StreetLevelImagerySourcesAndLayers` now shows Mapillary's track lines from zoom 6 (before: 12). Below zoom 12 MapLibre reads Mapillary's vector tiles itself, with the same colours and filters; from 12 on nothing changes. These tiles are several MB each in dense areas.
- **Limit the zoom**: `options.minZoom` — below it nothing is requested or drawn, on top of each provider's own minimum zooms. `useProviderPhotos`, `useProviderSequences` and `useProviderMapFeatures` take the same as a fourth argument, `{ minZoom }`.
- For own adapters: `ProviderAdapter.sequenceTiles` (type `SequenceTiles`) names vector tiles for low zooms; `renameExpressionProperties` runs a style expression on other property names; `sequenceTilesLayerId` / `sequenceTilesSourceId`.
