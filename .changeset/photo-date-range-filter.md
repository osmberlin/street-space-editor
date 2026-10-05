---
"@osm-editor-kit/street-imagery": patch
"@osm-editor-kit/street-imagery-react": patch
---

### @osm-editor-kit/street-imagery

- **Date slider scale** (after iD's photo age slider, recent years get more room): `dateSliderPosition`, `dateSliderTime`, `dateRangeToSliderPositions`, `sliderPositionsToDateRange`, `dateSliderBins`, `DATE_SLIDER_MAX_YEARS`.

### @osm-editor-kit/street-imagery-react

- **`PhotoDateRangeFilter`**: a date filter with two handles, marks that show how many photos there are at each time (`capturedAt`), lines at whole years whose labels set "the last N years" (`yearLines`), a red line for `recommendedMaxAgeYears`, dashed lines with a label for fixed dates (`markers`), and date inputs for exact days that are folded away, open or left out (`dateInputs`). New texts in `messages.dateFilter` (English, German).
