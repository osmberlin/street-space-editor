---
'@osm-editor-kit/street-imagery': patch
---

- **Panoramax links work without a config**: `providerLocationLink` and `providerExternalLink` threw when the host had not called `setStreetImageryConfig`. They now go to the public server; `getPanoramaxApiBase()` gives the server in use.
- **Openers say when a service needs an account**: `LocationOpener.requiresAccount` is `true` for the infra3D openers and `false` for all others, so a host can mark the link, e.g. with a lock icon. Own `LocationOpener` objects need the new field.
- **Start date for Mapillary links**: `OpenTarget.dateFrom` (`YYYY-MM-DD`) limits Mapillary to photos from that day on, in `locationUrl` and `lookAtUrl`; also `providerLocationLink(…, { dateFrom })` and `mapillaryLookAtUrl(photos, target, { dateFrom })`. Other services ignore it. A value that is not a real day throws; `isIsoDate` and `assertIsoDate` are exported.
- **infra3D projects are fully the host's**: `Infra3dProject` is `{ uid, label, bbox? }`. `label` replaces `name` and is shown as it is (before: "infra3D <name>"). **Breaking**: rename `name` to `label` and write the full text.
- **Openers know where they have imagery**: `LocationOpener.covers(lngLat)` (Vegbilder only in Norway, an infra3D project only in its `bbox`) and `getLocationOpenersAt(lngLat)`. Own `LocationOpener` objects need the new field.
