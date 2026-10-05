---
'@osm-editor-kit/street-imagery-react': patch
---

- **Panoramax without its own widgets**: with `hideAttribution` (`hideLegend` on `PanoramaxPanel`) the viewer no longer creates its legend, bottom drawer, player and zoom buttons at all (`widgets="false"`). Before they were created and hidden with CSS, and the drawer could still show.
