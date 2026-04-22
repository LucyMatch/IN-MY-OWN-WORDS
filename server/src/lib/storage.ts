/**
 * Highlights storage.
 *
 * Plain JSON file on disk at server/data/highlights.json. Read on GET,
 * overwrite on POST. No locking, no migrations, no schema validation —
 * this is a prototype, not a database.
 *
 * Concurrency note: last write wins. If two requests arrive at exactly
 * the same time the second clobbers the first. Fine for a one-user demo.
 *
 * For a production version: swap this for SQLite or Vercel KV. The route
 * handlers use these functions, so swapping the implementation here
 * doesn't touch the routes.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Highlight } from '@shared/types'
import { findWorkspaceRoot } from './paths.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// data/ always lives at server/data regardless of where the compiled file lives.
const DATA_DIR = path.join(findWorkspaceRoot(__dirname), 'data')
const HIGHLIGHTS_FILE = path.join(DATA_DIR, 'highlights.json')

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true })
}

export async function readHighlights(): Promise<Highlight[]> {
  try {
    const raw = await readFile(HIGHLIGHTS_FILE, 'utf-8')
    return JSON.parse(raw) as Highlight[]
  } catch (err) {
    // File doesn't exist yet → empty list. Anything else, log and return empty.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('[storage] readHighlights error:', err)
    }
    return []
  }
}

export async function writeHighlights(highlights: Highlight[]): Promise<void> {
  await ensureDataDir()
  await writeFile(HIGHLIGHTS_FILE, JSON.stringify(highlights, null, 2), 'utf-8')
}
