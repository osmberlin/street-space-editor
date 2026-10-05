---
'@osm-editor-kit/street-imagery-react': patch
---

- **View cone of a flat Mapillary photo points the right way**: it used the heading of the map tiles (the camera's own compass, often far off) and now follows the viewer, which reports the direction Mapillary computed from the image, as on mapillary.com. Width follows the viewer's field of view.
