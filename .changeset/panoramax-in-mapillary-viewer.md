---
'@osm-editor-kit/street-imagery-react': minor
---

- **Panoramax photos open in the Mapillary viewer**: `PanoramaxPanel` (and so `StreetLevelImageryViewer`) is now a `mapillary-js` viewer with the new `PanoramaxDataProvider`. One viewer engine for both providers; `@panoramax/web-viewer`, Photo Sphere Viewer and their build setup are no longer needed. A picture opens with its `sd` file; on zooming in, the original is loaded once and the sharp parts are cut from it in the browser. Steps along the sequence work; arrows to pictures nearby do not (no 3D reconstruction).
- **Breaking: Panoramax's own viewer moved** to `PanoramaxWebViewerPanel` in the new entry `@osm-editor-kit/street-imagery-react/panoramax-web-viewer`. Pass it as `panoramaxPanel` to `StreetLevelImageryViewer` to keep it. `@panoramax/web-viewer` is now an optional peer dependency, needed only for this entry.
- **Breaking: `PanoramaxPanel` takes `hideAttribution`** instead of `hideLegend`. Without it the panel shows creator and licence in a line at the bottom.
- `viewer-panels` also exports `PanoramaxDataProvider`, `panoramaxPhotoFromItem` and the type `PanoramaxItem`.
