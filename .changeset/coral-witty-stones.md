---
"@osm-editor-kit/street-imagery-react": patch
---
### @osm-editor-kit/street-imagery-react

- Turning off a street imagery provider clears its photos from the map instead of leaving the last loaded set visible.
- The date filter’s timeline marks only include providers that are currently enabled, so counts no longer mix in e.g. Mapillary when only Panoramax is on.
- Zooming out below a provider’s minimum photo zoom removes that provider’s leftover photos from the map and filter, not just stops new requests.
- Panning at a valid zoom still keeps the previous viewport’s photos on screen briefly while the next area loads.
