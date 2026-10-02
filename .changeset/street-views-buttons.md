---
'@osm-editor-kit/street-imagery': patch
'@osm-editor-kit/street-imagery-react': patch
---

**Street views: view buttons that count and step through their photos.**

### @osm-editor-kit/street-imagery

- A viewpoint with role `here` and a bearing (a click on a street) looks four ways: `forward`, `right`, `back`, `left` (`ViewDirectionKind` has `right` and `left` now).
- `mapillaryTilePhotoSource` (entry `/providers/mapillary`): a `ViewpointPhotoSource` that picks from the photos shown on the map. The Graph API radius search returns at most 50 images and missed nearby photos in dense areas.

### @osm-editor-kit/street-imagery-react

- `FloatingPhotoViewer`: the view buttons have two lines (arrow, compass point and photo count; date of the shown photo) and no "Views" label. A click on the active button shows the view's next photo. `onSelectSuggestion(suggestion, candidate)` gets the photo to show; pass `shownPhotoId`.
- `messages.compass` (eight points) replaces the direction names on the buttons; `messages.viewer.views` is gone, `messages.viewer.nextPhotoOfView` is new.
- `PhotoCount`: picture icon with `index/total`, used by the view buttons and the day buttons of `MapillaryFeatureBar`.
- Session store: showing the photo that is already up with another direction turns it (360° photos shared by several views) without a new history step. `reset` ends the session and clears back/forward.
