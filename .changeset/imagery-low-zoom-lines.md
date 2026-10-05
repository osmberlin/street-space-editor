---
'@osm-editor-kit/street-imagery': patch
'@osm-editor-kit/street-imagery-react': patch
---

- **Mapillary lines when zoomed out, and far less to download**: `StreetLevelImagerySourcesAndLayers` now shows Mapillary's track lines from zoom 6 (before: 12). Until photos are loaded (zoom 15), MapLibre reads Mapillary's line tiles itself, with the same colours and filters. Before, zoom 12 to 14 loaded the photo tiles for this: up to 96 tiles of over 10 MB each in a city view at zoom 12. Zoomed far out, the line tiles are several MB each in dense areas. `providerById.mapillary.sequencesMinZoom` is now 6; `fetchedSequencesMinZoom(providerId)` gives the zoom from which `fetchSequences` is used.
- **Limit the zoom**: `options.minZoom` — below it nothing is requested or drawn, on top of each provider's own minimum zooms. `useProviderPhotos`, `useProviderSequences` and `useProviderMapFeatures` take the same as a fourth argument, `{ minZoom }`.
- For own adapters: `ProviderAdapter.sequenceTiles` (type `SequenceTiles`) names vector tiles for low zooms; `renameExpressionProperties` runs a style expression on other property names; `sequenceTilesLayerId` / `sequenceTilesSourceId`.
