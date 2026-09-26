#!/usr/bin/env bun
/**
 * prepack: rewrite package.json for the tarball, restored by package-exports-restore.ts.
 * - `exports` → `publishExports` (dist entrypoints)
 * - `workspace:*|^|~` ranges → real versions of the sibling packages (npm publish does not rewrite them)
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

type Deps = Record<string, string>
type Pkg = { name?: string; version?: string; exports?: unknown; publishExports?: unknown } & Partial<
  Record<(typeof DEP_FIELDS)[number], Deps>
>

const DEP_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies'] as const

const cwd = process.cwd()
const pkgPath = join(cwd, 'package.json')
const backupPath = join(cwd, '.package.json.dev-backup')
const raw = readFileSync(pkgPath, 'utf8')
const pkg = JSON.parse(raw) as Pkg

const packagesDir = join(cwd, '..')
const workspaceVersions = new Map<string, string>()
for (const dir of readdirSync(packagesDir)) {
  const siblingPath = join(packagesDir, dir, 'package.json')
  if (!existsSync(siblingPath)) continue
  const sibling = JSON.parse(readFileSync(siblingPath, 'utf8')) as Pkg
  if (sibling.name && sibling.version) workspaceVersions.set(sibling.name, sibling.version)
}

let changed = false
if (pkg.publishExports) {
  pkg.exports = pkg.publishExports
  changed = true
}

for (const field of DEP_FIELDS) {
  const deps = pkg[field]
  if (!deps) continue
  for (const [name, range] of Object.entries(deps)) {
    if (!range.startsWith('workspace:')) continue
    const version = workspaceVersions.get(name)
    if (!version) throw new Error(`${pkg.name}: no workspace package found for ${name}`)
    const spec = range.slice('workspace:'.length)
    deps[name] = spec === '*' || spec === '^' ? `^${version}` : spec === '~' ? `~${version}` : spec
    changed = true
  }
}

if (!changed) {
  console.log('No publishExports or workspace: ranges; leaving package.json unchanged')
  process.exit(0)
}

if (!existsSync(backupPath)) writeFileSync(backupPath, raw)
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log('Rewrote package.json for pack/publish (exports + workspace: ranges)')
