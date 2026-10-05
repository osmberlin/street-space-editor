---
"@osm-editor-kit/street-imagery-react": patch
---

- **Draw the imagery below a layer of your style**: `options.beforeId` on `StreetLevelImagerySourcesAndLayers` puts all its layers (lines, view shapes, dots, signs, the shown photo's cone and marker) below that layer, e.g. below road names. The layer must exist when the component mounts. Without it, nothing changes. `StreetLevelImageryViewCone` and `StreetLevelImagerySelectionOverlay` take the same `beforeId`.
