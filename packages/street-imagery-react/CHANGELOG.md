# @osm-editor-kit/street-imagery-react

## 0.1.0-alpha.6

### Patch Changes

- c09920c: ### @osm-editor-kit/street-imagery

  - **Locales**: `STREET_IMAGERY_LOCALES` (`en`, `de`), and date helpers on date-fns: `formatDate`, `formatMonth`, `formatRelativeDate`, `formatDateTooltip`. `dayLabels` takes a `StreetImageryLocale`.
  - `mapillaryValueName(value, locale)`: German names for signs found in Germany and for all objects and markings; other values get the German category and the English name. `humanizeMapillaryValue`, and `NormalizedPhoto.creatorName`.
  - New dependency: `date-fns`.
  - Breaking, Bing Streetside: the bundled key is gone. Pass your own as `bingMapsKey` in the config (`getBingMapsKey()`); without it the adapter loads nothing and Streetside is an opener only.
  - Breaking, infra3D: the config takes a list, `infra3d: { projects: [{ uid, name }] }`, and each project gets its own opener (`infra3d:<uid>`, "infra3D <name>"). `getLocationOpeners()` and `findLocationOpener(id)` replace `locationOpenerById`; `LOCATION_OPENERS` holds the photo providers only.

  ### @osm-editor-kit/street-imagery-react

  - **English and German texts**: wrap the app in `<StreetImageryLocaleProvider locale="de">`; single texts can be overridden with `messages`. Without a provider the texts are English.
  - `MapillaryFeatureBar`: a sign or object with its icon, name and one button per capture day.
  - `PhotoDate`: month and year, with the full date and the age in the tooltip. The suggested-view chips use it.
  - `MapillaryPanel` / `StreetLevelImageryViewer`: `hideAttribution`, for hosts that show creator and link themselves; `onViewerPhoto` gives the `creatorName`.
  - Breaking: `viewSuggestionLabel(suggestion, messages)` takes the messages; `viewpointRoleLabel` is gone (use `messages.viewpointRole`).
  - **Map look**: sequence lines and photo dots are black, without white outlines; the shown photo's sequence is thicker and the rest steps back. View-direction shapes and the shown photo's cone carry the style colour (`photoCircleColor`) with a hairline edge at most. New options `viewConeColor` and `viewConeScale`.
  - Sequence lines run through their loaded photos (`alignLineToPoints` in the core package adds the missing corners).
  - **Panoramax panel**: `onViewerPhoto` gives creator, licence, local capture time, camera and position accuracy (`NormalizedPhoto.details`); `hideLegend` hides the viewer's own legend drawer. Flat photos can no longer be panned or zoomed out of sight: at least 30 % of the image stays in view.
  - `PhotoDate` takes `localDateTime` for a tooltip with the camera's local date and time.
  - Optional entry `@osm-editor-kit/street-imagery-react/photo-details`: `PhotoDetailsDialog`, a modal with everything known about a photo (capture, camera, position, source, raw EXIF), and its `PHOTO_DETAILS_LABELS`. Apps that do not import it do not bundle it. `FloatingPhotoViewer` takes `titleActions`, e.g. `FloatingViewerInfoButton` to open the dialog.
  - Style colours for the map layers: `photoTypeColorExpression`, `PHOTO_TYPE_COLORS`, `MAP_FEATURE_COLOR` (age colours: `ageBandColorExpression`).
  - Removed unused exports: `isPhotoProviderId`, `isMapFeatureProviderId`, `tilePixelSizeAtZoom`, `mapFeatureExternalLink`, `findPhotoIndexInGroup`, `collectNearbyStreetsidePhotos`, `dayLabels`, `SequenceHighlightBbox`, `useAllProviderMapFeaturesLoading`, `useViewpointSessionId`, `useViewpointSessionActions`.

- 83364e2: ### @osm-editor-kit/street-imagery

  - **Location openers**: `LOCATION_OPENERS`, `locationOpenerById`, `openLocationInNewTab` open a place in another imagery service. Mapillary and Google Street View (with a Maps key) open the nearest image already turned to the place (`mapillaryLookAtUrl`, `streetViewLookAtUrl`).
  - **infra3D**: `buildInfra3dUrl` (`jumpTo`, `lookAt`, `imageKey`) and an opener; the project comes from `createStreetImageryConfig({ infra3d: { projectUid } })`.

  ### @osm-editor-kit/street-imagery-react

  - `LocationPickOnMap`, `useArmedLocationOpenerId`, `useLocationPickActions`: arm an opener, the next map click opens the clicked place.

- Updated dependencies [c09920c]
- Updated dependencies [83364e2]
  - @osm-editor-kit/street-imagery@0.1.0-alpha.5

## 0.1.0-alpha.5

### Patch Changes

- ### @osm-editor-kit/street-imagery

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

- Updated dependencies
  - @osm-editor-kit/street-imagery@0.1.0-alpha.4

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
