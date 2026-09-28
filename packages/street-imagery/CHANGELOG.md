# @osm-editor-kit/street-imagery

## 0.1.0-alpha.3

### Patch Changes

- ### @osm-editor-kit/street-imagery

  - **Viewpoints**: `viewpointFromPoint` (looks N/E/S/W), `viewpointsFromLine` (start, click point, end; forward + back) and `viewpointsIntoNode` (one per approaching street, looking into a junction).
  - **Direction-aware photo ranking**: `rankPhotosForDirection` / `buildViewSuggestions` score heading, position behind the viewpoint, distance and recency; newer flat photos beat older panos unless only panos are allowed; optional max age.
  - **Mapillary radius search**: `fetchMapillaryImagesNearPoint` (Graph API, up to 50 images within 50 m).
  - **Performance in dense areas**: Mapillary photo points from zoom 15 (sequences from 12), KartaView and Mapillary signs/map features from 14; Mapillary tiles decode only the needed layer; smaller tile cache. `photosToViewfieldsFeatureCollection` takes `{ bbox, maxFeatures }` (`VIEWFIELD_MIN_ZOOM`, `VIEWFIELD_MAX_FEATURES`).
  - Geometry helpers: `bearingDeg`, `destinationPoint`, `snapToLine`, `pointAlongLine`, `angleDiffDeg`.

  ### @osm-editor-kit/street-imagery-react

  - **FloatingPhotoViewer**: movable, resizable, minimizable photo box over the map with suggested-view chips, back/forward history (`[` / `]`, Esc closes), status, footer and drawer. Consumers using Tailwind must add `@source` for this package.
  - **ViewpointLayer**: viewpoints, clickable view directions (`VIEWPOINT_DIRECTION_LAYER_ID`) and the clicked line.
  - **useViewSuggestions** and a viewpoint session store (`useViewpoints`, `useCurrentHistoryEntry`, `getViewpointSession`, …).
  - `MapillaryPanel` / `StreetLevelImageryViewer`: `lookAtBearing` turns 360° photos to a direction; `onViewerPhoto` reports full photo data for images reached inside the viewer.

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
