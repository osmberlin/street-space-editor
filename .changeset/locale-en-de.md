---
'@osm-editor-kit/street-imagery': patch
'@osm-editor-kit/street-imagery-react': patch
---

### @osm-editor-kit/street-imagery

- **Locales**: `STREET_IMAGERY_LOCALES` (`en`, `de`), and date helpers on date-fns: `formatDate`, `formatMonth`, `formatRelativeDate`, `formatDateTooltip`. `dayLabels` takes a `StreetImageryLocale`.
- `mapillaryValueName(value, locale)`: German names for signs found in Germany and for all objects and markings; other values get the German category and the English name. `humanizeMapillaryValue`, and `NormalizedPhoto.creatorName`.
- New dependency: `date-fns`.
- Breaking, Bing Streetside: the bundled key is gone. Pass your own as `bingMapsKey` in the config (`getBingMapsKey()`); without it the adapter loads nothing and Streetside is an opener only.
- Breaking, infra3D: the config takes a list, `infra3d: { projects: [{ uid, name }] }`, and each project gets its own opener (`infra3d:<uid>`, "infra3D <name>"). `getLocationOpeners()` and `findLocationOpener(id)` replace `locationOpenerById`; `LOCATION_OPENERS` holds the photo providers only.

### @osm-editor-kit/street-imagery-react

- **English and German texts**: wrap the app in `<StreetImageryLocaleProvider locale="de">`; single texts can be overridden with `messages`. Without a provider the texts are English.
- `MapillaryFeatureBar`: a sign or object with its icon, name and one button per capture day.
- `PhotoDate`: month and year, with the full date and the age in the tooltip. The suggested-view chips use it.
- `MapillaryPanel` / `StreetLevelImageryViewer`: `hideAttribution`, for hosts that show creator and link themselves; `onViewerPhoto` gives the `creatorName`.
- Breaking: `viewSuggestionLabel(suggestion, messages)` takes the messages; `viewpointRoleLabel` is gone (use `messages.viewpointRole`).
- **Map look**: sequence lines and photo dots are black, without white outlines; the shown photo's sequence is thicker and the rest steps back. View-direction shapes and the shown photo's cone carry the style colour (`photoCircleColor`) with a hairline edge at most. New options `viewConeColor` and `viewConeScale`.
- Sequence lines run through their loaded photos (`alignLineToPoints` in the core package adds the missing corners).
- **Panoramax panel**: `onViewerPhoto` gives creator, licence, local capture time, camera and position accuracy (`NormalizedPhoto.details`); `hideLegend` hides the viewer's own legend drawer. Flat photos can no longer be panned or zoomed out of sight: at least 30 % of the image stays in view.
- `PhotoDate` takes `localDateTime` for a tooltip with the camera's local date and time.
- Optional entry `@osm-editor-kit/street-imagery-react/photo-details`: `PhotoDetailsDialog`, a modal with everything known about a photo (capture, camera, position, source, raw EXIF), and its `PHOTO_DETAILS_LABELS`. Apps that do not import it do not bundle it. `FloatingPhotoViewer` takes `titleActions`, e.g. `FloatingViewerInfoButton` to open the dialog.
