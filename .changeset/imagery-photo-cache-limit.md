---
'@osm-editor-kit/street-imagery': patch
---

- **Memory has a limit when panning through a city**: the tile cache now also counts what the tiles hold (photos, lines) and keeps at most 800,000 items, about 400 MB. Before it kept 60 tiles, whatever their size; a Mapillary tile of a city centre holds about 180,000 photos. `fetchTileCached` takes an optional `countItems` for values that are not arrays.
- Mapillary photos are kept as they are used, not as the tile's GeoJSON, so nothing is converted again on each pan.
