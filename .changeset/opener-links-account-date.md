---
"@osm-editor-kit/street-imagery": patch
---

- **Panoramax links work without a config**: `providerLocationLink` and `providerExternalLink` threw when the host had not called `setStreetImageryConfig`. They now go to the public server; `getPanoramaxApiBase()` gives the server in use.
- **Openers say when a service needs an account**: `LocationOpener.requiresAccount` is `true` for the infra3D openers and `false` for all others, so a host can mark the link, e.g. with a lock icon. Own `LocationOpener` objects need the new field.
