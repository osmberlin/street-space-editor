---
'@osm-editor-kit/street-imagery': patch
---

- **Parking sign group**: `SIGN_GROUPS` gains `parking` (no parking, no stopping, parking areas and restrictions; not bicycle parking). Parking signs used to fall into `other`.
- `SIGN_GROUP_IDS` / `SignGroupId`, and `signGroupFilter(groups)`: a cached `filter.mapFeatureValue` for chosen sign groups (objects always pass).
- **Age steps**: `createAgeSteps` (fixed thresholds as `years` or exact `starts`, own colors and ids), `ageStepColorExpression`, `ageStepMatchExpression`, `ageStepOf`, `countByAgeStep`, `yearsAgoMs`, `AGE_STEP_COLORS`, `MAX_USEFUL_AGE_YEARS`.
- `targetImageToPhoto`.
