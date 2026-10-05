---
'@osm-editor-kit/street-imagery-react': patch
---

- **Photo counts with thousands separators**: the date filter's tooltips show "7,664 photos" / "7.664 Fotos" instead of "7664".
- **Date filter marks on a logarithmic scale**: the first bar holds all photos older than the slider spans and dwarfed the others; small bars are now readable next to it.
- **Date filter without the "All dates" action**: `allDatesAction={false}` on `PhotoDateRangeFilter` hides it, for hosts with little room.
