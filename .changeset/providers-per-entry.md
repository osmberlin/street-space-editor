---
'@osm-editor-kit/street-imagery': patch
'@osm-editor-kit/street-imagery-react': patch
---

**Breaking: providers are registered, and bundled only when registered.**

### @osm-editor-kit/street-imagery

- Each provider's fetching code is its own entry: `@osm-editor-kit/street-imagery/providers/mapillary`, `/mapillary-signs`, `/mapillary-map-features`, `/panoramax`, `/kartaview`, `/mapilio`, `/streetside`, `/vegbilder`, and `/providers/all` (`ALL_PROVIDER_ADAPTERS`).
- Call `registerProviderAdapters([...])` once at boot. `adapterById` holds only the registered adapters; a provider without one shows no map data.
- `PROVIDERS` / `providerById` are static and complete without any adapter. `ProviderAdapter` now has only `id` and the fetch functions; names, colours, zoom limits, `coverage`, `coverageTiles`, `clickOnly` are in `ProviderMeta`. `PROVIDER_ADAPTERS`, `streetViewAdapter` and `lookaroundAdapter` are gone.
- Sizes of the package's code in an app (minified, with its vector-tile dependencies): "open in …" links only 16 kB, Mapillary and Panoramax 27 kB, all providers 36 kB. Before, every app got 35 kB.

### @osm-editor-kit/street-imagery-react

- `"sideEffects": false`, so bundlers drop the components an app does not use.
- The texts of `MapillaryFeatureBar` moved out of the package-wide messages into `MAPILLARY_FEATURE_BAR_LABELS` (override with the `labels` prop), so the German sign names are bundled only with the feature bar. `messages.feature` is gone.
