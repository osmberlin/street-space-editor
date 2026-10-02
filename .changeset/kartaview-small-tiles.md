---
'@osm-editor-kit/street-imagery': patch
'@osm-editor-kit/street-imagery-react': patch
---

KartaView loads again: photos come in small tiles (about 150 m) from zoom 18. The server times out on the larger areas the adapter asked for before. A failed tile is retried once and no longer cached as empty. `maxPageAtZoom` is gone.

Providers can state a `coverage` area (`{ bbox, label }`); Vegbilder has Norway. `providerCoversBbox(providerId, bbox)` tells whether a map view can have imagery, and the data hooks request nothing outside it.
