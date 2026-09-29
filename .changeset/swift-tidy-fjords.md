---
"@osm-editor-kit/street-imagery": patch
"@osm-editor-kit/street-imagery-react": patch
---

### @osm-editor-kit/street-imagery

- Build **viewpoints** from a map point (north/east/south/west), a clicked street segment (start, click, end, forward and back), or a junction (one view per approaching street).
- **Rank nearby photos per view direction** by heading, position behind the viewpoint, distance, and recency; prefer newer flat photos over older panoramas unless you restrict to panos only, with optional max age.
- Load candidate photos for a viewpoint via **Mapillary radius search** (Graph API, images within ~50 m).
- **Dense cities stay usable**: higher zoom thresholds for photo points and overlays, viewport-limited drawing, view cones and 360° disks capped and simplified, and Mapillary tiles decoded one layer at a time with a smaller cache.

### @osm-editor-kit/street-imagery-react

- **Floating photo viewer** over the map: drag, resize, minimize, suggested-view chips, back/forward history (`[` / `]`, Esc to close), status, footer, and drawer; layout is remembered in the browser.
- **Viewpoint map layer** with clickable view directions and the selected line; hooks and session store to open viewpoints, fetch **ranked Mapillary suggestions** per direction (respecting your filters), and track active direction and history.
- **Mapillary viewer** can open 360° photos facing a suggested bearing and notify your app whenever the user navigates to another image inside the viewer.
- Map layers draw **only filtered photos near the viewport**; viewfields from zoom 16 with a hard cap so heavy imagery regions no longer freeze the tab. Tailwind apps should add an `@source` entry for this package so viewer styles are picked up.
