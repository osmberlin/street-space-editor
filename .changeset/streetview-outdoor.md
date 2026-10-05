---
'@osm-editor-kit/street-imagery': patch
---

- **Street View: outdoor panoramas only**: the metadata lookup (`fetchStreetViewMetadata`, so `streetViewPhotoSource` and the Street View `lookAtUrl`) asks Google for `source=outdoor`. It no longer returns photo spheres taken inside buildings. Needs `googleMapsApiKey`; the plain link without a key cannot be limited.
