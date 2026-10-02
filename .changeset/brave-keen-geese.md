---
"@osm-editor-kit/street-imagery": patch
"@osm-editor-kit/street-imagery-react": patch
---

### @osm-editor-kit/street-imagery

- Inspect Mapillary signs and junction objects: search around a point, load all photos for a feature by capture day, filter image detections, and compute which photo and aim best show a sign or place—including helpers for Mapillary image ids in OSM tags and age bands for map styling.
- Build suggested viewpoints from pluggable photo sources (Mapillary, Street View, or custom); in dense areas, rank photos already on your map tiles, and from a street click offer views along the line and left and right across it.
- Jump to the same place in another service via location openers—plain links for every provider, look-at URLs for Mapillary and Google when keys are in config, and one opener per configured infra3D project. **Breaking:** pass `googleMapsApiKey` and your own `bingMapsKey` in config (no bundled Bing key; Streetside without a key is opener-only); infra3D is now `projects: [{ uid, name }]`.
- English and German copy and date formatting; German display names for common Mapillary signs and objects; icon URLs compatible with iD/Rapid sprites. Register only the provider entry points you use so the rest of the fetching code is not bundled. KartaView coverage from zoom 12 with more reliable tile loading; Vegbilder limited to Norway.

### @osm-editor-kit/street-imagery-react

- Point the Mapillary viewer at a junction, sign, or object and draw detection outlines; React hooks load feature images, nearby features, and filtered detections, and layers can hide unrelated sign/object types.
- Suggested-view controls use compass labels, 360°/flat cues, and photo counts in a compact grid; the active view cycles through its photos, and the floating viewer can step prev/next along a sequence (keyboard-friendly) with an optional toolbar slot for things like a selected feature’s capture days.
- `<StreetImageryLocaleProvider>` for English or German UI, a Mapillary feature bar with one button per capture day, and `PhotoDate` chips with rich tooltips; optional photo-details dialog via a separate import so apps that skip it do not bundle the modal.
- Arm “open in …” from a button and send the next map click to that service (Escape cancels). On the map, the active photo stands out with accent line, ring, pin when GPS differs from Mapillary’s position, and a configurable view cone; other sequences fade by age. Panoramax flat images stay at least partly in frame; hosts can hide the built-in legend and read full metadata from `onViewerPhoto`.
