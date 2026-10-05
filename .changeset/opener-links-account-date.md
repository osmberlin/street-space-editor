---
"@osm-editor-kit/street-imagery": patch
---

- **Panoramax links work without a config**: `providerLocationLink` and `providerExternalLink` threw when the host had not called `setStreetImageryConfig`. They now go to the public server; `getPanoramaxApiBase()` gives the server in use.
