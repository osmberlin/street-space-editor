---
"@osm-editor-kit/street-imagery-react": patch
---

- **No photos of a provider that is turned off**: `useAllProviderPhotos`, `useProviderPhotos`, `useProviderSequences` and `useProviderMapFeatures` kept returning the last result after the provider was turned off or the map was zoomed out below its minimum zoom. The date filter's marks then showed e.g. Mapillary's photos while only Panoramax was on. The last result is now only kept while the next viewport loads.
