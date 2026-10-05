---
"@osm-editor-kit/street-imagery": patch
"@osm-editor-kit/street-imagery-react": patch
---

### @osm-editor-kit/street-imagery

- **Parking sign group**: `SIGN_GROUPS` gains `parking` (no parking, no stopping, parking areas and restrictions; not bicycle parking). Parking signs used to fall into `other`.
- `SIGN_GROUP_IDS` / `SignGroupId`, and `signGroupFilter(groups)`: a cached `filter.mapFeatureValue` for chosen sign groups (objects always pass).
- **Age steps**: `createAgeSteps` (fixed thresholds as `years` or exact `starts`, own colors and ids), `ageStepColorExpression`, `ageStepMatchExpression`, `ageStepOf`, `countByAgeStep`, `yearsAgoMs`, `AGE_STEP_COLORS`, `MAX_USEFUL_AGE_YEARS`.
- `targetImageToPhoto`.

### @osm-editor-kit/street-imagery-react

- `useSelectedMapillaryFeature`: a selected sign with its photos, the shown one and the one to open first.
- `SelectedMapFeatureLayer`: the selected sign's halo and a line from the camera of the shown photo.
