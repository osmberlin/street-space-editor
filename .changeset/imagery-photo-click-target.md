---
"@osm-editor-kit/street-imagery": patch
"@osm-editor-kit/street-imagery-react": patch
---

- **Photos are easier to click**: an invisible circle of 10 px radius around each photo dot takes clicks and taps near it; the dots themselves are 2 to 4 px. It is part of `streetImageryInteractiveLayerIds`, and `queryStreetImageryFeatures` returns its hits after those on the dot itself. Layer id: `photoTargetLayerId(providerId)`.
