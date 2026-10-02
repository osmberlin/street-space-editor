---
'@osm-editor-kit/street-imagery': patch
'@osm-editor-kit/street-imagery-react': patch
---

### @osm-editor-kit/street-imagery

- **Locales**: `STREET_IMAGERY_LOCALES` (`en`, `de`), and date helpers on date-fns: `formatDate`, `formatMonth`, `formatRelativeDate`, `formatDateTooltip`. `dayLabels` takes a `StreetImageryLocale`.
- `mapillaryValueName(value, locale)`: German names for signs found in Germany and for all objects and markings; other values get the German category and the English name. `humanizeMapillaryValue`, and `NormalizedPhoto.creatorName`.
- New dependency: `date-fns`.

### @osm-editor-kit/street-imagery-react

- **English and German texts**: wrap the app in `<StreetImageryLocaleProvider locale="de">`; single texts can be overridden with `messages`. Without a provider the texts are English.
- `MapillaryFeatureBar`: a sign or object with its icon, name and one button per capture day.
- `PhotoDate`: month and year, with the full date and the age in the tooltip. The suggested-view chips use it.
- `MapillaryPanel` / `StreetLevelImageryViewer`: `hideAttribution`, for hosts that show creator and link themselves; `onViewerPhoto` gives the `creatorName`.
- Breaking: `viewSuggestionLabel(suggestion, messages)` takes the messages; `viewpointRoleLabel` is gone (use `messages.viewpointRole`).
