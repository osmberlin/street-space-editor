#!/usr/bin/env bun
/**
 * Version + build + publish for first-wave @osm-editor-kit packages.
 *
 * See .changeset/README.md.
 *
 * Usage:
 *   bun run packages:release
 *   bun run packages:release -- --dry-run
 *   bun run packages:release -- --yes
 *   bun run packages:release -- --publish-only
 *   bun run packages:check
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import {
  DIR_BY_NAME,
  ROOT,
  WAVE_PACKAGES,
  type WavePackage,
  packagesMentionedInPendingChangesets,
  pendingChangesetFiles,
  wavePackageForPath,
} from './packages-wave.ts'

const CHECK_ONLY = process.argv.includes('--check') || process.argv.includes('packages:check')
const isCheckScript = process.env.npm_lifecycle_event === 'packages:check'

type Issue = { message: string; fix?: string }

type PackageStatus = 'ready' | 'upToDate' | 'blocked'

type PackageReport = {
  name: WavePackage
  version: string
  status: PackageStatus
  issues: Issue[]
}

type PkgJson = {
  name?: string
  version?: string
  private?: boolean
  publishConfig?: { access?: string; tag?: string }
  publishExports?: unknown
}

function parseArgs(argv: string[]) {
  const flags = {
    yes: false,
    dryRun: false,
    check: CHECK_ONLY || isCheckScript,
    publishOnly: false,
  }
  for (const arg of argv) {
    if (arg === '--') continue
    if (arg === '--yes' || arg === '-y') flags.yes = true
    else if (arg === '--dry-run') flags.dryRun = true
    else if (arg === '--check') flags.check = true
    else if (arg === '--publish-only') flags.publishOnly = true
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: bun run packages:release [--check] [--dry-run] [--yes] [--publish-only]
       bun run packages:check`)
      process.exit(0)
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return flags
}

function runAsync(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; inherit?: boolean },
): Promise<{ status: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const inherit = opts?.inherit === true
    const child = spawn(cmd, args, {
      cwd: opts?.cwd ?? ROOT,
      stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    if (!inherit) {
      child.stdout?.on('data', (chunk: Buffer | string) => {
        stdout += String(chunk)
      })
      child.stderr?.on('data', (chunk: Buffer | string) => {
        stderr += String(chunk)
      })
    }
    child.on('error', reject)
    child.on('close', (status) => {
      resolve({ status: status ?? 1, stdout, stderr })
    })
  })
}

function runInherit(cmd: string, args: string[], cwd = ROOT) {
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', encoding: 'utf8' })
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`)
  }
}

function readPkg(name: WavePackage): PkgJson {
  return JSON.parse(readFileSync(join(ROOT, DIR_BY_NAME[name], 'package.json'), 'utf8')) as PkgJson
}

async function npmVersionExists(name: string, version: string): Promise<boolean | 'unknown'> {
  const result = await runAsync('npm', ['view', `${name}@${version}`, 'version'])
  if (result.status === 0 && result.stdout.trim() === version) return true
  const err = `${result.stderr}${result.stdout}`
  if (err.includes('E404') || err.includes('404')) return false
  if (err.includes('E401') || err.includes('401')) return 'unknown'
  return 'unknown'
}

function preModeActive() {
  return existsSync(join(ROOT, '.changeset', 'pre.json'))
}

async function checkGlobal(): Promise<Issue[]> {
  const issues: Issue[] = []
  if (!preModeActive()) {
    issues.push({
      message: 'Changesets is not in alpha prerelease mode',
      fix: 'bunx changeset pre enter alpha',
    })
  }
  const whoami = await runAsync('npm', ['whoami'])
  if (whoami.status !== 0) {
    issues.push({
      message: 'npm auth failed (npm whoami)',
      fix: 'npm login  # must publish under @osm-editor-kit',
    })
  }
  return issues
}

async function checkPackage(
  name: WavePackage,
  pendingMention: Set<string>,
  opts: { canQueryNpm: boolean; requireNoPending: boolean },
): Promise<PackageReport> {
  const dir = DIR_BY_NAME[name]
  const pkg = readPkg(name)
  const version = pkg.version ?? '0.0.0'
  const issues: Issue[] = []

  if (pkg.private === true) {
    issues.push({
      message: 'package is private',
      fix: `Edit ${dir}/package.json — remove "private": true (wave packages must be public)`,
    })
  }
  if (!version.includes('-alpha')) {
    issues.push({
      message: `version "${version}" is not an alpha prerelease`,
      fix: 'Land package commits, then re-run bun run packages:release (auto-creates a changeset)',
    })
  }
  if (pkg.publishConfig?.tag !== 'alpha') {
    issues.push({
      message: 'publishConfig.tag is not "alpha"',
      fix: `Set publishConfig.tag to "alpha" in ${dir}/package.json`,
    })
  }
  if (pkg.publishConfig?.access !== 'public') {
    issues.push({
      message: 'publishConfig.access is not "public"',
      fix: `Set publishConfig.access to "public" in ${dir}/package.json`,
    })
  }
  if (!pkg.publishExports) {
    issues.push({
      message: 'missing publishExports (dist entrypoints for the tarball)',
      fix: `Add publishExports pointing at dist/ in ${dir}/package.json`,
    })
  }
  if (!existsSync(join(ROOT, dir, 'dist', 'index.js'))) {
    issues.push({
      message: 'missing dist/index.js',
      fix: 'bun run build:packages   # packages:release runs this automatically',
    })
  }
  if (!existsSync(join(ROOT, dir, 'dist', 'index.d.ts'))) {
    issues.push({
      message: 'missing dist/index.d.ts',
      fix: 'bun run build:packages   # packages:release runs this automatically',
    })
  }
  if (name === '@osm-editor-kit/osm-route-snapper') {
    const wasm = join(ROOT, dir, 'vendor/osm-to-route-snapper/osm_to_route_snapper_bg.wasm')
    if (!existsSync(wasm)) {
      issues.push({
        message: 'missing vendored WASM for route-snapper',
        fix: `Ensure ${dir}/vendor/osm-to-route-snapper/ is present and listed in "files"`,
      })
    }
  }
  if (opts.requireNoPending && pendingMention.has(name)) {
    issues.push({
      message: 'has a pending changeset that is not applied yet',
      fix: 'Re-run bun run packages:release (applies version-packages automatically)',
    })
  }

  let alreadyOnNpm = false
  if (opts.canQueryNpm) {
    const onNpm = await npmVersionExists(name, version)
    if (onNpm === true) alreadyOnNpm = true
  }

  if (issues.length > 0) {
    return { name, version, status: 'blocked', issues }
  }
  if (alreadyOnNpm) {
    return {
      name,
      version,
      status: 'upToDate',
      issues: [{ message: `${name}@${version} already on npm (nothing to publish)` }],
    }
  }
  return { name, version, status: 'ready', issues: [] }
}

function printReport(globalIssues: Issue[], reports: PackageReport[]) {
  if (globalIssues.length > 0) {
    p.log.error('Global blockers')
    for (const issue of globalIssues) {
      console.log(`  ${pc.red('✗')} ${issue.message}`)
      if (issue.fix) console.log(`    ${pc.dim('→')} ${pc.cyan(issue.fix)}`)
    }
  }

  const ready = reports.filter((r) => r.status === 'ready')
  const upToDate = reports.filter((r) => r.status === 'upToDate')
  const blocked = reports.filter((r) => r.status === 'blocked')

  if (ready.length > 0) {
    p.log.success(`Ready to publish (${ready.length})`)
    for (const r of ready) {
      console.log(`  ${pc.green('✓')} ${r.name}@${r.version}`)
    }
  }

  if (upToDate.length > 0) {
    p.log.info(`Already on npm — skipped (${upToDate.length})`)
    for (const r of upToDate) {
      console.log(`  ${pc.dim('·')} ${r.name}@${r.version}`)
    }
  }

  if (blocked.length > 0) {
    p.log.warn(`Blocked (${blocked.length})`)
    for (const r of blocked) {
      console.log(`  ${pc.yellow('•')} ${r.name}@${r.version}`)
      for (const issue of r.issues) {
        console.log(`      ${pc.red('✗')} ${issue.message}`)
        if (issue.fix) console.log(`        ${pc.dim('→')} ${pc.cyan(issue.fix)}`)
      }
    }
  }
}

function dirtyWavePackagePaths(): string[] {
  const status = spawnSync('git', ['status', '--porcelain', '--', 'packages'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  if (status.status !== 0 || !status.stdout.trim()) return []
  const paths: string[] = []
  for (const line of status.stdout.split('\n')) {
    if (!line.trim()) continue
    const path = line.slice(3).trim().replace(/^"/, '').replace(/"$/, '')
    // Ignore build outputs if they appear
    if (path.includes('/dist/')) continue
    if (wavePackageForPath(path)) paths.push(path)
  }
  return paths
}

async function ensureChangesetCoverage() {
  const dirty = dirtyWavePackagePaths()
  if (dirty.length > 0) {
    p.log.error('Uncommitted changes in wave packages — commit them first (finish-work), then re-run.')
    for (const path of dirty.slice(0, 20)) {
      console.log(`  ${pc.yellow('•')} ${path}`)
    }
    if (dirty.length > 20) console.log(`  ${pc.dim(`…and ${dirty.length - 20} more`)}`)
    p.outro(pc.red('Release aborted.'))
    process.exit(1)
  }

  p.log.step('Ensuring changeset coverage (same as pre-push)…')
  const result = spawnSync('bun', ['run', 'scripts/packages-changeset.ts', '--', '--auto'], {
    cwd: ROOT,
    stdio: 'inherit',
    encoding: 'utf8',
  })
  const code = result.status ?? 1
  if (code === 2) {
    p.outro(
      pc.yellow(
        'Changeset was created and committed. Push that commit (git push), then re-run bun run packages:release.',
      ),
    )
    process.exit(1)
  }
  if (code !== 0) {
    p.outro(pc.red('Could not ensure changeset coverage. Fix and retry.'))
    process.exit(1)
  }
}

function commitVersionBumps() {
  const status = spawnSync('git', ['status', '--porcelain', '--', 'packages', '.changeset'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  if (status.status !== 0) throw new Error('git status failed')
  if (!status.stdout.trim()) {
    p.log.info('No version bump files to commit.')
    return
  }

  const env = { ...process.env, HUSKY: '0' }
  const add = spawnSync('git', ['add', '--', 'packages', '.changeset'], {
    cwd: ROOT,
    encoding: 'utf8',
    env,
  })
  if (add.status !== 0) throw new Error(`git add failed:\n${add.stderr || add.stdout}`)
  const commit = spawnSync(
    'git',
    ['commit', '-m', 'Chore: version packages for alpha publish'],
    { cwd: ROOT, encoding: 'utf8', env },
  )
  if (commit.status !== 0) {
    throw new Error(`git commit failed:\n${commit.stderr || commit.stdout}`)
  }
  p.log.success('Committed version bumps + CHANGELOGs')
}

async function runReadinessChecks(opts: { requireNoPending: boolean }) {
  const globalIssues = await checkGlobal()
  const canQueryNpm = !globalIssues.some((i) => i.fix.startsWith('npm login'))
  const pendingMention = packagesMentionedInPendingChangesets()

  const s = p.spinner()
  s.start(canQueryNpm ? 'Checking wave packages against npm…' : 'Checking wave packages…')
  const reports: PackageReport[] = []
  for (const [i, name] of WAVE_PACKAGES.entries()) {
    const short = name.replace('@osm-editor-kit/', '')
    s.message(`Checking ${short} (${i + 1}/${WAVE_PACKAGES.length})…`)
    reports.push(
      await checkPackage(name, pendingMention, {
        canQueryNpm,
        requireNoPending: opts.requireNoPending,
      }),
    )
  }
  s.stop('Checks done')
  printReport(globalIssues, reports)
  return { globalIssues, reports }
}

async function publishReady(ready: PackageReport[], flags: { yes: boolean; dryRun: boolean }) {
  if (flags.dryRun) {
    p.outro(pc.dim(`Dry run — would publish ${ready.length} package(s) to dist-tag alpha.`))
    return
  }

  p.log.info(
    'npm may ask for 2FA in the browser (EOTP). Complete that in the terminal when prompted.',
  )

  let proceed = flags.yes
  if (!proceed) {
    const answer = await p.confirm({
      message: `Publish ${ready.length} ready package(s) to npm dist-tag ${pc.cyan('alpha')}?`,
      initialValue: false,
    })
    if (p.isCancel(answer)) {
      p.cancel('Cancelled.')
      process.exit(0)
    }
    proceed = answer
  }
  if (!proceed) {
    p.outro('Publish cancelled.')
    return
  }

  for (const [i, r] of ready.entries()) {
    const label = `${r.name}@${r.version}`
    p.log.step(`Publishing ${label} (${i + 1}/${ready.length})…`)
    const result = await runAsync(
      'npm',
      ['publish', '--access', 'public', '--tag', 'alpha'],
      { cwd: join(ROOT, DIR_BY_NAME[r.name]), inherit: true },
    )
    if (result.status !== 0) {
      p.log.error(`Failed ${label}`)
      p.outro(
        pc.yellow(
          'If npm asked for a one-time password: finish browser auth (or npm login), then re-run bun run packages:release — already-published versions are skipped.',
        ),
      )
      process.exit(1)
    }
    p.log.success(`Published ${label}`)
  }

  p.note(ready.map((r) => `bun add ${r.name}@alpha`).join('\n'), 'Install in consumers')
  p.outro(pc.green('Done. Push the version-bump commit when ready.'))
}

async function main() {
  const flags = parseArgs(process.argv.slice(2))
  p.intro(pc.bgCyan(pc.black(flags.check ? ' packages:check ' : ' packages:release ')))

  if (flags.check) {
    const { globalIssues, reports } = await runReadinessChecks({ requireNoPending: true })
    const blocked = reports.filter((r) => r.status === 'blocked')
    if (globalIssues.length > 0 || blocked.length > 0) {
      p.outro(pc.yellow('Some packages are blocked — fix with the → commands above.'))
      process.exit(1)
    }
    const ready = reports.filter((r) => r.status === 'ready')
    const upToDate = reports.filter((r) => r.status === 'upToDate')
    p.outro(
      pc.green(
        `Check ok — ${ready.length} ready to publish, ${upToDate.length} already on npm.`,
      ),
    )
    return
  }

  if (!flags.publishOnly) {
    await ensureChangesetCoverage()

    const pending = pendingChangesetFiles()
    if (pending.length === 0) {
      p.log.info('No pending changesets to apply (versions already reflect landed changes).')
    } else {
      p.log.step(`Applying ${pending.length} pending changeset(s)…`)
      runInherit('bun', ['run', 'version-packages'])
      p.log.success('version-packages done')
    }

    p.log.step('Building wave packages…')
    runInherit('bun', ['run', 'build:packages'])
    p.log.success('build:packages done')
  }

  const { globalIssues, reports } = await runReadinessChecks({ requireNoPending: true })
  if (globalIssues.length > 0) {
    p.outro(pc.red('Fix global blockers before publishing.'))
    process.exit(1)
  }

  const blocked = reports.filter((r) => r.status === 'blocked')
  const ready = reports.filter((r) => r.status === 'ready')
  if (ready.length === 0) {
    if (blocked.length > 0) {
      p.outro(pc.red('Nothing ready to publish — fix blocked packages above.'))
      process.exit(1)
    }
    p.outro(
      pc.green(
        'Nothing new to publish — all wave packages are already on npm at their current versions.',
      ),
    )
    process.exit(0)
  }

  if (blocked.length > 0) {
    p.log.warn(`Continuing with ${ready.length} ready package(s); ${blocked.length} remain blocked.`)
  }

  await publishReady(ready, flags)

  if (!flags.dryRun && !flags.publishOnly) {
    try {
      commitVersionBumps()
    } catch (error) {
      p.log.warn(error instanceof Error ? error.message : String(error))
      p.log.info('Publish succeeded; commit version bumps manually if needed.')
    }
  }
}

main().catch((error) => {
  p.log.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
