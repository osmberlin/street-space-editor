# @osm-editor-kit/street-imagery

## 0.1.0-alpha.6

### Patch Changes

- ee6e8cb: KartaView loads again: photos come in small tiles (about 150 m) from zoom 18. The server times out on the larger areas the adapter asked for before. A failed tile is retried once and no longer cached as empty. `maxPageAtZoom` is gone.

  Providers can state a `coverage` area (`{ bbox, label }`); Vegbilder has Norway. `providerCoversBbox(providerId, bbox)` tells whether a map view can have imagery, and the data hooks request nothing outside it.

  `createStreetImageryConfig({ openLinksIn: 'window' })` opens links to other services in a separate window instead of a tab; `openExternalUrl(url)` does the same for the host's own links.

  Providers can have `coverageTiles`: ready-made image tiles of their tracks, drawn below the photos. KartaView uses the track tiles of its own website from zoom 12, so coverage shows before single photos load at zoom 18.

- b756bdc: **Breaking: providers are registered, and bundled only when registered.**

  ### @osm-editor-kit/street-imagery

  - Each provider's fetching code is its own entry: `@osm-editor-kit/street-imagery/providers/mapillary`, `/mapillary-signs`, `/mapillary-map-features`, `/panoramax`, `/kartaview`, `/mapilio`, `/streetside`, `/vegbilder`, and `/providers/all` (`ALL_PROVIDER_ADAPTERS`).
  - Call `registerProviderAdapters([...])` once at boot. `adapterById` holds only the registered adapters; a provider without one shows no map data.
  - `PROVIDERS` / `providerById` are static and complete without any adapter. `ProviderAdapter` now has only `id` and the fetch functions; names, colours, zoom limits, `coverage`, `coverageTiles`, `clickOnly` are in `ProviderMeta`. `PROVIDER_ADAPTERS`, `streetViewAdapter` and `lookaroundAdapter` are gone.
  - Sizes of the package's code in an app (minified, with its vector-tile dependencies): "open in …" links only 16 kB, Mapillary and Panoramax 27 kB, all providers 36 kB. Before, every app got 35 kB.

  ### @osm-editor-kit/street-imagery-react

  - `"sideEffects": false`, so bundlers drop the components an app does not use.
  - The texts of `MapillaryFeatureBar` moved out of the package-wide messages into `MAPILLARY_FEATURE_BAR_LABELS` (override with the `labels` prop), so the German sign names are bundled only with the feature bar. `messages.feature` is gone.

- 6e7ccff: **Street views: view buttons that count and step through their photos.**

  ### @osm-editor-kit/street-imagery

  - A viewpoint with role `here` and a bearing (a click on a street) looks four ways: `forward`, `right`, `back`, `left` (`ViewDirectionKind` has `right` and `left` now).
  - `mapillaryTilePhotoSource` (entry `/providers/mapillary`): a `ViewpointPhotoSource` that picks from the photos shown on the map. The Graph API radius search returns at most 50 images and missed nearby photos in dense areas.

  ### @osm-editor-kit/street-imagery-react

  - `FloatingPhotoViewer`: the view buttons have two lines (arrow, compass point and photo count; date of the shown photo) and no "Views" label. A click on the active button shows the view's next photo. `onSelectSuggestion(suggestion, candidate)` gets the photo to show; pass `shownPhotoId`.
  - `messages.compass` (eight points) replaces the direction names on the buttons; `messages.viewer.views` is gone, `messages.viewer.nextPhotoOfView` is new.
  - `PhotoCount`: picture icon with `index/total`, used by the view buttons and the day buttons of `MapillaryFeatureBar`.
  - Session store: showing the photo that is already up with another direction turns it (360° photos shared by several views) without a new history step. `reset` ends the session and clears back/forward.

## 0.1.0-alpha.5

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

## 0.1.0-alpha.4

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
