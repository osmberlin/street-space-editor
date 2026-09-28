# @osm-editor-kit/street-imagery-react

## 0.1.0-alpha.4

### Patch Changes

- ### @osm-editor-kit/street-imagery

  - **Viewpoints**: `viewpointFromPoint` (looks N/E/S/W), `viewpointsFromLine` (start, click point, end; forward + back) and `viewpointsIntoNode` (one per approaching street, looking into a junction).
  - **Direction-aware photo ranking**: `rankPhotosForDirection` / `buildViewSuggestions` score heading, position behind the viewpoint, distance and recency; newer flat photos beat older panos unless only panos are allowed; optional max age.
  - **Mapillary radius search**: `fetchMapillaryImagesNearPoint` (Graph API, up to 50 images within 50 m).
  - Geometry helpers: `bearingDeg`, `destinationPoint`, `snapToLine`, `pointAlongLine`, `angleDiffDeg`.

  ### @osm-editor-kit/street-imagery-react

  - **FloatingPhotoViewer**: movable, resizable, minimizable photo box over the map with suggested-view chips, back/forward history (`[` / `]`, Esc closes), status, footer and drawer. Consumers using Tailwind must add `@source` for this package.
  - **ViewpointLayer**: viewpoints, clickable view directions (`VIEWPOINT_DIRECTION_LAYER_ID`) and the clicked line.
  - **useViewSuggestions** and a viewpoint session store (`useViewpoints`, `useCurrentHistoryEntry`, `getViewpointSession`, …).
  - **Performance in dense areas**: only filtered photos in and around the viewport are drawn; view cones/360° disks from zoom 16 for the viewport only (max 1,500).
  - `MapillaryPanel` / `StreetLevelImageryViewer`: `lookAtBearing` turns 360° photos to a direction; `onViewerPhoto` reports full photo data for images reached inside the viewer.

- Updated dependencies
  - @osm-editor-kit/street-imagery@0.1.0-alpha.3

## 0.1.0-alpha.3

### Patch Changes

- - Installable outside the OSM Editor Kit monorepo: the previous alpha still listed sibling kit packages as `workspace:*` in npm's metadata.

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

- Updated dependencies [676afb8]
  - @osm-editor-kit/street-imagery@0.1.0-alpha.2

## 0.1.0-alpha.1

### Patch Changes

- 9248f97: Update readme
- Updated dependencies [9248f97]
  - @osm-editor-kit/street-imagery@0.1.0-alpha.1

## 0.1.0-alpha.0

### Minor Changes

- 8309d44: Initial npm alpha release.

  Core features to date:

  - React MapLibre sources and layers for street imagery (photo points, sequences, viewfields, map features) driven by `@osm-editor-kit/street-imagery` provider adapters
  - `StreetLevelImageryViewer` with lazy-loaded Mapillary (`mapillary-js`) and Panoramax (`@panoramax/web-viewer`) photo panels
  - View-direction cone overlay (`StreetLevelImageryViewCone`) synced to live viewer POV via a Zustand store
  - Selection highlight overlay for the active photo and its sequence
  - TanStack Query hooks for per-provider and all-provider photo, sequence, and map-feature fetches with viewport bbox clipping
  - `useMapViewportBbox` hook for live WGS84 bbox from a react-map-gl map instance
  - Map click helpers (`streetImageryInteractiveLayerIds`, `queryStreetImageryFeatures`) for photos, viewfields, and map features
  - Photo type and date filtering on map layers plus thumbnail/full-URL query hooks

### Patch Changes

- Updated dependencies [8309d44]
  - @osm-editor-kit/street-imagery@0.1.0-alpha.0
