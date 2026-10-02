---
'@osm-editor-kit/street-imagery': patch
'@osm-editor-kit/street-imagery-react': patch
---

KartaView loads again: photos come in small tiles (about 150 m) from zoom 18. The server times out on the larger areas the adapter asked for before. A failed tile is retried once and no longer cached as empty. `maxPageAtZoom` is gone.

Providers can state a `coverage` area (`{ bbox, label }`); Vegbilder has Norway. `providerCoversBbox(providerId, bbox)` tells whether a map view can have imagery, and the data hooks request nothing outside it.

`createStreetImageryConfig({ openLinksIn: 'window' })` opens links to other services in a separate window instead of a tab; `openExternalUrl(url)` does the same for the host's own links.

Providers can have `coverageTiles`: ready-made image tiles of their tracks, drawn below the photos. KartaView uses the track tiles of its own website from zoom 12, so coverage shows before single photos load at zoom 18.
