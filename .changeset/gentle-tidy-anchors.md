---
"@osm-editor-kit/osm-maplibre": patch
"@osm-editor-kit/street-imagery": patch
"@osm-editor-kit/street-imagery-react": patch
---

### @osm-editor-kit/osm-maplibre

- Builds and runs against **maplibre-gl 6**, in line with the street-imagery stack and the street-space editor.
- Apps that depend on this package can adopt MapLibre 6 without version skew against other OSM Editor Kit map packages.

### @osm-editor-kit/street-imagery

- Development and integration tests target **maplibre-gl 6**, matching the rest of the street-imagery family.
- Street View metadata still returns no result when no Google Maps API key is configured (behavior unchanged; test coverage improved).

### @osm-editor-kit/street-imagery-react

- **Peer dependency** on `maplibre-gl` is now **^6** — upgrade your app’s MapLibre to v6 when you bump this package.
- React street-imagery UI stays aligned with MapLibre 6 used by `osm-maplibre` and `street-imagery`.
