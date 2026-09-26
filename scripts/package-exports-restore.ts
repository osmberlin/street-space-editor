#!/usr/bin/env bun
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const cwd = process.cwd()
const pkgPath = join(cwd, 'package.json')
const backupPath = join(cwd, '.package.json.dev-backup')
if (!existsSync(backupPath)) process.exit(0)

writeFileSync(pkgPath, readFileSync(backupPath, 'utf8'))
unlinkSync(backupPath)
console.log('Restored development package.json')
