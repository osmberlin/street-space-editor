---
'@osm-editor-kit/street-imagery-react': patch
---

- **Floating viewer at the top left**: `defaultPosition={{ corner: 'top-left', left, top }}` on `FloatingPhotoViewer` places the box there until the user moves it, e.g. next to a side panel. Default stays the bottom right corner.
