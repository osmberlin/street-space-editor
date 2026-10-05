# @osm-editor-kit/street-imagery-react

## 0.1.0-alpha.9

### Patch Changes

- 9220e21: - **Floating viewer at the top left**: `defaultPosition={{ corner: 'top-left', left, top }}` on `FloatingPhotoViewer` places the box there until the user moves it, e.g. next to a side panel. Default stays the bottom right corner.
  - **Floating viewer without history**: `onBack`, `onForward`, `canGoBack` and `canGoForward` are optional on `FloatingPhotoViewer`; without the handlers the back and forward buttons are not shown.
- f33c592: - **Draw the imagery below a layer of your style**: `options.beforeId` on `StreetLevelImagerySourcesAndLayers` puts all its layers (lines, view shapes, dots, signs, the shown photo's cone and marker) below that layer, e.g. below road names. The layer must exist when the component mounts. Without it, nothing changes. `StreetLevelImageryViewCone` and `StreetLevelImagerySelectionOverlay` take the same `beforeId`.
- b7b89e7: - **Mapillary lines when zoomed out, and far less to download**: `StreetLevelImagerySourcesAndLayers` now shows Mapillary's track lines from zoom 6 (before: 12). Until photos are loaded (zoom 15), MapLibre reads Mapillary's line tiles itself, with the same colours and filters. Before, zoom 12 to 14 loaded the photo tiles for this: up to 96 tiles of over 10 MB each in a city view at zoom 12. Zoomed far out, the line tiles are several MB each in dense areas. `providerById.mapillary.sequencesMinZoom` is now 6; `fetchedSequencesMinZoom(providerId)` gives the zoom from which `fetchSequences` is used.
  - **Limit the zoom**: `options.minZoom` — below it nothing is requested or drawn, on top of each provider's own minimum zooms. `useProviderPhotos`, `useProviderSequences` and `useProviderMapFeatures` take the same as a fourth argument, `{ minZoom }`.
  - For own adapters: `ProviderAdapter.sequenceTiles` (type `SequenceTiles`) names vector tiles for low zooms; `renameExpressionProperties` runs a style expression on other property names; `sequenceTilesLayerId` / `sequenceTilesSourceId`.
- bbbebe2: - **View cone of a flat Mapillary photo points the right way**: it used the heading of the map tiles (the camera's own compass, often far off) and now follows the viewer, which reports the direction Mapillary computed from the image, as on mapillary.com. Width follows the viewer's field of view.
- 004515e: - **Panoramax without its own widgets**: with `hideAttribution` (`hideLegend` on `PanoramaxPanel`) the viewer no longer creates its legend, bottom drawer, player and zoom buttons at all (`widgets="false"`). Before they were created and hidden with CSS, and the drawer could still show.
- 6cd4ff6: - **Photos are easier to click**: an invisible circle of 10 px radius around each photo dot takes clicks and taps near it; the dots themselves are 2 to 4 px. It is part of `streetImageryInteractiveLayerIds`, and `queryStreetImageryFeatures` returns its hits after those on the dot itself. Layer id: `photoTargetLayerId(providerId)`.
- 10967b3: - **Photo counts with thousands separators**: the date filter's tooltips show "7,664 photos" / "7.664 Fotos" instead of "7664".
  - **Date filter marks on a logarithmic scale**: the first bar holds all photos older than the slider spans and dwarfed the others; small bars are now readable next to it.
  - **Date filter without the "All dates" action**: `allDatesAction={false}` on `PhotoDateRangeFilter` hides it, for hosts with little room.
- aa31a76: - **The viewers load only when a photo is shown**: the main entry no longer imports `mapillary-js` and `@panoramax/web-viewer`. Before, any import from the package loaded both, although `StreetLevelImageryViewer` loads its panels on demand. **Breaking**: `MapillaryPanel`, `PanoramaxPanel`, `mapillaryViewFor`, `setMapillaryViewerOutlines` and `turnMapillaryViewerTo` are now in `@osm-editor-kit/street-imagery-react/viewer-panels`.
- Updated dependencies [b7b89e7]
- Updated dependencies [9e014d6]
- Updated dependencies [6cd4ff6]
- Updated dependencies [045a3a8]
  - @osm-editor-kit/street-imagery@0.1.0-alpha.8

## 0.1.0-alpha.8

### Patch Changes

- 9880126: - **`PhotoDateRangeFilter`**: a date filter with two handles, marks that show how many photos there are at each time (`capturedAt`), lines at whole years whose labels set "the last N years" (`yearLines`), a red line for `recommendedMaxAgeYears`, dashed lines with a label for fixed dates (`markers`), and date inputs for exact days that are folded away, open or left out (`dateInputs`). New texts in `messages.dateFilter` (English, German).
- 20ee7ad: - `useSelectedMapillaryFeature`: a selected sign with its photos, the shown one and the one to open first.
  - `SelectedMapFeatureLayer`: the selected sign's halo and a line from the camera of the shown photo.
- Updated dependencies [20ee7ad]
- Updated dependencies [b2944a8]
- Updated dependencies [6ff52b7]
  - @osm-editor-kit/street-imagery@0.1.0-alpha.7

## 0.1.0-alpha.7

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

- Updated dependencies [ee6e8cb]
- Updated dependencies [b756bdc]
- Updated dependencies [6e7ccff]
  - @osm-editor-kit/street-imagery@0.1.0-alpha.6

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
