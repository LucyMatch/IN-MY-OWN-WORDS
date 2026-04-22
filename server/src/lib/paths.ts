import { existsSync } from 'node:fs'
import path from 'node:path'

/**
 * Walk up the directory tree from `startDir` until we find a directory that
 * contains `package.json`. Returns that directory (the workspace root).
 *
 * Works in both dev (tsx runs server/src/index.ts → startDir = server/src)
 * and prod (node runs server/dist/server/src/index.js → startDir = server/dist/server/src).
 * In both cases the walk stops at server/, which contains package.json.
 */
export function findWorkspaceRoot(startDir: string): string {
  let dir = startDir
  while (true) {
    if (existsSync(path.join(dir, 'package.json'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return startDir
    dir = parent
  }
}
