#!/usr/bin/env bun
/**
 * Changeset check + scaffold for first-wave packages.
 *
 * The changeset is written by whoever writes the commit (user-facing notes, in the same commit).
 * This script only tells you when one is missing and scaffolds the file.
 *
 * Usage:
 *   bun run packages:changeset -- --check          exit 1 if a touched wave package is uncovered
 *   bun run packages:changeset -- [name]           scaffold .changeset/<name>.md for uncovered packages
 *   bun run packages:changeset -- --force [name]   scaffold for all touched packages
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import {
  ROOT,
  type WavePackage,
  commitsTouchingPackage,
  defaultGitRange,
  DIR_BY_NAME,
  packagesMentionedInPendingChangesets,
  shortPackageName,
  uncoveredWavePackages,
  wavePackagesTouchedInDiff,
} from './packages-wave.ts'

const EXIT_OK = 0
const EXIT_FAIL = 1

const ADJECTIVES = [
  'brave',
  'calm',
  'clever',
  'bright',
  'gentle',
  'lucky',
  'quick',
  'silly',
  'tidy',
  'witty',
  'amber',
  'coral',
  'fair',
  'keen',
  'noble',
  'proud',
  'solid',
  'swift',
  'vivid',
  'zesty',
]
const NOUNS = [
  'boats',
  'clouds',
  'foxes',
  'geese',
  'lakes',
  'maps',
  'owls',
  'pines',
  'rivers',
  'stones',
  'trails',
  'waves',
  'winds',
  'yards',
  'zebras',
  'anchors',
  'bridges',
  'canyons',
  'dunes',
  'fjords',
]

function parseArgs(argv: string[]) {
  const flags = { check: false, force: false, name: null as string | null }
  for (const arg of argv) {
    if (arg === '--') continue
    if (arg === '--check') flags.check = true
    else if (arg === '--force') flags.force = true
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: bun run packages:changeset -- [--check] [--force] [name]`)
      process.exit(0)
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown argument: ${arg}`)
    } else if (!/^[a-z0-9-]+$/.test(arg)) {
      throw new Error(`Changeset name must be kebab-case: ${arg}`)
    } else {
      flags.name = arg
    }
  }
  return flags
}

function randomChangesetId(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!
  const b = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!
  const c = NOUNS[Math.floor(Math.random() * NOUNS.length)]!
  return `${a}-${b}-${c}`
}

function formatCommitBullets(notes: { subject: string; body: string }[]): string {
  if (notes.length === 0) return '- (no commits in range for this package)'
  const lines: string[] = []
  for (const note of notes) {
    lines.push(`- ${note.subject}`)
    if (note.body) {
      for (const bodyLine of note.body.split('\n')) {
        const t = bodyLine.trim()
        if (!t) continue
        lines.push(`  ${t.startsWith('-') ? t : `- ${t}`}`)
      }
    }
  }
  return lines.join('\n')
}

function buildChangesetMarkdown(packages: WavePackage[], range: string): string {
  const frontmatter = [
    '---',
    ...packages.map((name) => `"${name}": patch`),
    '---',
    '',
  ].join('\n')

  const sections = packages.map((name) => {
    const dir = DIR_BY_NAME[name]
    const notes = commitsTouchingPackage(dir, range)
    return `### ${name}\n\n${formatCommitBullets(notes)}`
  })

  return `${frontmatter}${sections.join('\n\n')}\n`
}

function writeScaffold(packages: WavePackage[], range: string, name: string | null): string {
  mkdirSync(join(ROOT, '.changeset'), { recursive: true })
  let id = name ?? randomChangesetId()
  let path = join(ROOT, '.changeset', `${id}.md`)
  if (name && existsSync(path)) throw new Error(`.changeset/${name}.md already exists`)
  while (existsSync(path)) {
    id = randomChangesetId()
    path = join(ROOT, '.changeset', `${id}.md`)
  }
  writeFileSync(path, buildChangesetMarkdown(packages, range))
  return path
}

async function main() {
  const flags = parseArgs(process.argv.slice(2))

  p.intro(pc.bgCyan(pc.black(' packages:changeset ')))

  const range = defaultGitRange()
  const touched = wavePackagesTouchedInDiff(range)
  const uncovered = uncoveredWavePackages(range)

  if (touched.length === 0) {
    p.outro(pc.dim(`No wave packages changed in ${range}.`))
    process.exit(EXIT_OK)
  }

  if (uncovered.length === 0 && !flags.force) {
    const covered = [...packagesMentionedInPendingChangesets()]
      .map(shortPackageName)
      .join(', ')
    p.outro(pc.green(`All touched wave packages already have a pending changeset (${covered}).`))
    process.exit(EXIT_OK)
  }

  const packagesToWrite = flags.force ? touched : uncovered

  if (flags.check) {
    p.log.error(`Wave packages changed without a changeset (${range}):`)
    for (const name of uncovered) {
      console.log(`  ${pc.red('✗')} ${name}`)
    }
    console.log(
      `  ${pc.dim('→')} ${pc.cyan('bun run packages:changeset -- <name>')}  scaffolds .changeset/<name>.md`,
    )
    console.log(
      `  ${pc.dim('→')} Rewrite its body into user-facing notes, then commit it (amend the unpushed fix commit).`,
    )
    p.outro(pc.yellow('Push blocked until a pending changeset covers these packages.'))
    process.exit(EXIT_FAIL)
  }

  const path = writeScaffold(packagesToWrite, range, flags.name)
  const rel = path.startsWith(ROOT) ? path.slice(ROOT.length + 1) : path
  p.log.success(`Wrote ${rel}`)
  p.log.info('Rewrite the body into user-facing notes per package, then commit the file.')
  p.outro(pc.green('Scaffold ready.'))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(EXIT_FAIL)
})
