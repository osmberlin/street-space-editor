---
"@osm-editor-kit/osm-lanes": minor
---

Pending npm alpha packaging (not in the first publish wave). Documents the kit package as it exists today.

Core features to date:
- Parse OSM way lane tags into typed `WayLaneModel` / `LaneSlot` records (forward, backward, both_ways) with per-field provenance
- Serialize models back to OSM lane tags while preserving unrelated tags and preferring undirected vs directional pipe keys
- Lane pipe handling for turn, vehicle, bicycle, bus, PSV, width, change, surface, and smoothness (`*:lanes` split/join utilities)
- Resolve and reconcile lane counts (`lanes`, `lanes:forward`, `lanes:backward`, `lanes:both_ways`), including reverse-oneway remirror via `osm-way-chain`
- Driving-side aware bus/PSV outer-lane inference from `lanes:bus` / `lanes:psv` count tags
- Validation warnings for count/pipe mismatches, bike-in-pipes patterns, and placement out-of-range
- Soft width reconciliation: kerb-to-kerb `width`/`est_width` vs `width:lanes`, on-carriageway parking, cycleway buffers, and DE paint estimate
- Slot editing helpers: add/remove lanes, sync counts from slots, editable direction filtering
- Only `designated` in `bus:lanes` / `psv:lanes` / `bicycle:lanes` makes a bus or cycle lane; `yes` stays a normal lane
