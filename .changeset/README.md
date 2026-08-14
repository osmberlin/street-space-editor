# Kit package versioning & alpha publish

This monorepo uses [Changesets](https://github.com/changesets/changesets) for versions. Interactive `bunx changeset` is **not** the happy path — use the scripts below.

Wave packages always bump **`patch`** while in alpha. npm dist-tag: **`alpha`**.

## Wave packages

- `@osm-editor-kit/osm-coverage`
- `@osm-editor-kit/osm-data`
- `@osm-editor-kit/osm-map-url`
- `@osm-editor-kit/osm-maplibre`
- `@osm-editor-kit/osm-route-snapper`
- `@osm-editor-kit/osm-way-chain`
- `@osm-editor-kit/street-imagery`
- `@osm-editor-kit/street-imagery-react`

Other kit packages stay private. Draft notes: [`docs/changeset-pending-private/`](../docs/changeset-pending-private/). The app is `private` and ignored.

## Flow

```mermaid
flowchart TD
  edit[Edit packages/foo]
  fw[finish-work check + commit]
  push1[git push]
  gate{pre-push: wave pkgs covered?}
  auto["packages:changeset --auto\nscaffold + cursor-agent"]
  push2[git push again]
  rel["packages:release\nversion → build → publish → commit"]

  edit --> fw --> push1 --> gate
  gate -->|yes| rel
  gate -->|no| auto --> push2 --> gate
```

## Day to day

1. Land package work with finish-work (user-facing commit messages).
2. Optionally run `bun run packages:changeset -- --auto` before the first push.
3. `git push` — pre-push runs `packages:changeset --auto` if wave packages in `@{upstream}..HEAD` lack a pending changeset. If it commits one, **push again**.

Bypass (rare): `SKIP_PACKAGE_CHANGESET_AUTO=1 git push` or `git push --no-verify`.

## Ship alphas

```bash
bun run packages:release
# or
bun run packages:release -- --yes
bun run packages:release -- --dry-run
bun run packages:release -- --publish-only   # already versioned + built
bun run packages:check
```

`packages:release` will:

1. Refuse uncommitted wave-package edits (commit via finish-work first)
2. Ensure changeset coverage (`packages:changeset --auto` — same as pre-push; agent rewrite when needed)
3. `changeset version` (patch bumps + CHANGELOGs) when pending changesets exist
4. `build:packages`
5. Readiness checks — **already-on-npm packages are skipped** (not errors)
6. Confirm and `npm publish --tag alpha` (TTY for 2FA / EOTP) for packages with a new local version
7. Commit version bumps (does not push)

## Changeset commands

```bash
# Scaffold from commits (patch frontmatter + commit bullets)
bun run packages:changeset

# Check only (exit 1 if uncovered)
bun run packages:changeset -- --check

# Scaffold + cursor-agent rewrite + commit (exit 2 → push again)
bun run packages:changeset -- --auto
```

Agent uses `composer-2.5` by default (`OSM_CHANGESET_AGENT_MODEL` to override). Requires `cursor-agent` (or `agent`) on PATH and login / `CURSOR_API_KEY`.

## Install in other apps

```bash
bun add @osm-editor-kit/street-imagery@alpha
```
