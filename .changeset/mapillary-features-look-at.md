---
"@osm-editor-kit/street-imagery": patch
"@osm-editor-kit/street-imagery-react": patch
---

### @osm-editor-kit/street-imagery

- **Mapillary map features**: `fetchMapFeatureImages` (a sign or object with all its images by capture day and linked outlines), `fetchMapillaryMapFeaturesInBbox`, `bboxAround`.
- **Detections**: `fetchImageDetections`, `decodeDetectionOutline`.
- **Target view**: `bestTargetImage`, `targetImagesByDay`, `viewFromOutline` / `viewFromLocation` / `viewFromFlatCamera`, `SIGN_TARGET`, `PLACE_TARGET`.
- **Groups**: `SIGN_GROUPS`, `JUNCTION_FEATURE_GROUPS`, `JUNCTION_DETECTION_GROUPS`, `countByGroup`, `matchesAnyGroup`.
- **Age bands**: `ageBand`, `ageBandStarts`, `ageBandColorExpression`.
- **OSM tags**: `mapillaryImagesOfTags`, `preferredMapillaryImageId`, `parseMapillaryTagKey`.
- `NormalizedPhoto` gains `creatorId`, `organizationId`, `originalLngLat`; `createMapillaryHighlightResolver`.
- **Photo sources** for suggested views: `ViewpointPhotoSource`, `mapillaryPhotoSource`, `streetViewPhotoSource`.
- **Breaking**: the Google Maps key comes from `createStreetImageryConfig({ googleMapsApiKey })`; `VITE_GOOGLE_MAPS_API_KEY` is no longer read.
- Includes the viewpoint and dense-area changes of 0.1.0-alpha.3, which was not published.

### @osm-editor-kit/street-imagery-react

- `lookAt` and `outlines` on `MapillaryPanel` / `StreetLevelImageryViewer`; `turnMapillaryViewerTo`, `setMapillaryViewerOutlines`.
- Hooks `useMapillaryMapFeatureImages`, `useMapillaryMapFeaturesNear`, `useMapillaryImageDetections`.
- `filter.mapFeatureValue` on `StreetLevelImagerySourcesAndLayers`; `sources` on `useViewSuggestions`.
- Includes the floating viewer and viewpoint layer of 0.1.0-alpha.4, which was not published.
