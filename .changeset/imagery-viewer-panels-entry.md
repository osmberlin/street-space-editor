---
'@osm-editor-kit/street-imagery-react': patch
---

- **The viewers load only when a photo is shown**: the main entry no longer imports `mapillary-js` and `@panoramax/web-viewer`. Before, any import from the package loaded both, although `StreetLevelImageryViewer` loads its panels on demand. **Breaking**: `MapillaryPanel`, `PanoramaxPanel`, `mapillaryViewFor`, `setMapillaryViewerOutlines` and `turnMapillaryViewerTo` are now in `@osm-editor-kit/street-imagery-react/viewer-panels`.
