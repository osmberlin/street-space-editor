---
"@osm-editor-kit/street-imagery-react": patch
---

### @osm-editor-kit/street-imagery-react

- Panoramax pictures open in the same **mapillary-js** viewer as Mapillary, so you get one lazy-loaded engine, the same on-map view cone, and no Panoramax-specific Vite setup for the default panel.
- Walk a Panoramax sequence with previous, next, and play; images start at the `sd` preview and load the full-resolution file when you zoom in.
- Nearby-photo arrows in the viewer are not available for Panoramax (they rely on Mapillary’s 3D reconstruction); creator and licence appear in a bottom line unless you set `hideAttribution` and show them yourself via `onViewerPhoto`.
- Use **`PanoramaxDataProvider`** from `viewer-panels` to drive your own `mapillary-js` `Viewer` against the Panoramax API.
- Prefer Panoramax’s official web viewer? Import **`PanoramaxWebViewerPanel`** from `@osm-editor-kit/street-imagery-react/panoramax-web-viewer` and pass it as `panoramaxPanel` on `StreetLevelImageryViewer` (optional peer `@panoramax/web-viewer` and its app setup).
