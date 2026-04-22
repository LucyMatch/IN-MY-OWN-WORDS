/**
 * Highlights persistence.
 *   GET  /api/highlights        → Highlight[]
 *   POST /api/highlights        body: Highlight[]   → { ok: true, count }
 *
 * The client owns the data shape (see @shared/types). The server reads/writes
 * the JSON file. Swap storage.ts for SQLite/KV when you outgrow this.
 *
 * Trade-off: no validation. For a prototype, fine. For production, add
 * a schema check (Zod) here.
 */

import { Router } from 'express'
import { readHighlights, writeHighlights } from '../lib/storage.js'
import type { Highlight } from '@shared/types'

export const highlightsRoute = Router()

highlightsRoute.get('/highlights', async (_req, res) => {
  try {
    const highlights = await readHighlights()
    res.json(highlights)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown read error'
    console.error('[highlights GET]', message)
    res.status(500).json({ error: message })
  }
})

highlightsRoute.post('/highlights', async (req, res) => {
  const body = req.body
  if (!Array.isArray(body)) {
    return res.status(400).json({ error: 'Body must be an array of highlights.' })
  }

  try {
    await writeHighlights(body as Highlight[])
    res.json({ ok: true, count: body.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown write error'
    console.error('[highlights POST]', message)
    res.status(500).json({ error: message })
  }
})
