---
"@osm-editor-kit/osm-coverage": patch
"@osm-editor-kit/osm-way-chain": patch
"@osm-editor-kit/osm-route-snapper": patch
---

- Fix install outside the OSM Editor Kit monorepo: the published `package.json` listed sibling kit packages as `workspace:*`, which npm cannot resolve. They now reference real versions.
