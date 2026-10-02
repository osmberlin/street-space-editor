---
'@osm-editor-kit/street-imagery': patch
'@osm-editor-kit/street-imagery-react': patch
---

### @osm-editor-kit/street-imagery

- **Location openers**: `LOCATION_OPENERS`, `locationOpenerById`, `openLocationInNewTab` open a place in another imagery service. Mapillary and Google Street View (with a Maps key) open the nearest image already turned to the place (`mapillaryLookAtUrl`, `streetViewLookAtUrl`).
- **infra3D**: `buildInfra3dUrl` (`jumpTo`, `lookAt`, `imageKey`) and an opener; the project comes from `createStreetImageryConfig({ infra3d: { projectUid } })`.

### @osm-editor-kit/street-imagery-react

- `LocationPickOnMap`, `useArmedLocationOpenerId`, `useLocationPickActions`: arm an opener, the next map click opens the clicked place.
