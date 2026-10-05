---
'@osm-editor-kit/street-imagery': patch
'@osm-editor-kit/street-imagery-react': patch
---

### @osm-editor-kit/street-imagery

- **Viewpoints**: `viewpointFromPoint` (looks N/E/S/W), `viewpointsFromLine` (start, click point, end; forward + back) and `viewpointsIntoNode` (one per approaching street, looking into a junction).
- **Direction-aware photo ranking**: `rankPhotosForDirection` / `buildViewSuggestions` score heading, position behind the viewpoint, distance and recency; newer flat photos beat older panos unless only panos are allowed; optional max age.
- **Mapillary radius search**: `fetchMapillaryImagesNearPoint` (Graph API, up to 50 images within 50 m).
- **Performance in dense areas**: Mapillary photo points from zoom 15 (sequences from 12), KartaView and Mapillary signs/map features from 14; Mapillary tiles decode only the needed layer; smaller tile cache. `photosToViewfieldsFeatureCollection` takes `{ bbox, maxFeatures }` (`VIEWFIELD_MIN_ZOOM`, `VIEWFIELD_MAX_FEATURES`).
- Geometry helpers: `bearingDeg`, `destinationPoint`, `snapToLine`, `pointAlongLine`, `angleDiffDeg`.

### @osm-editor-kit/street-imagery-react

- **FloatingPhotoViewer**: movable, resizable, minimizable photo box over the map with suggested-view chips, back/forward history (`[` / `]`, Esc closes), status, footer and drawer. Consumers using Tailwind must add `@source` for this package.
- **ViewpointLayer**: viewpoints, clickable view directions (`VIEWPOINT_DIRECTION_LAYER_ID`) and the clicked line.
- **useViewSuggestions** and a viewpoint session store (`useViewpoints`, `useCurrentHistoryEntry`, `getViewpointSession`, …).
- **Performance in dense areas**: only filtered photos in and around the viewport are drawn; view cones/360° disks from zoom 16 for the viewport only (max 1,500).
- `MapillaryPanel` / `StreetLevelImageryViewer`: `lookAtBearing` turns 360° photos to a direction; `onViewerPhoto` reports full photo data for images reached inside the viewer.
