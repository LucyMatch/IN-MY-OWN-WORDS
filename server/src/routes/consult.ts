/**
 * Buddy consultation — parallel calls.
 * POST /api/consult
 *   body: ConsultRequest    → { highlight, bubbles }
 *   res:  ConsultResponse   → { responses: BuddyResponse[] }
 *
 * Fans out one Claude call per buddy via Promise.allSettled, so a single
 * buddy failing doesn't kill the whole response. Each buddy gets the same
 * passage + bubbles, but their own system prompt (persona).
 *
 * No streaming — each buddy returns once with its full response. See
 * docs/technical-bits.md for how to upgrade to streaming later if wanted.
 *
 * To add/remove buddies, edit BUDDIES in lib/buddies.ts. This route loops
 * over whatever's in the array — no changes needed here.
 */

import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { callClaude } from '../lib/anthropic.js'
import { BUDDIES, buildBuddyUserMessage } from '../lib/buddies.js'
import type {
  ConsultRequest,
  ConsultResponse,
  BuddiesResponse,
  BuddyResponse,
} from '@shared/types'

export const consultRoute = Router()

consultRoute.post('/consult', async (req, res) => {
  const { highlight, bubbles } = (req.body ?? {}) as Partial<ConsultRequest>

  if (!highlight || typeof highlight !== 'string') {
    return res.status(400).json({ error: 'Missing required field: highlight (string).' })
  }

  const descriptions = Array.isArray(bubbles) ? bubbles : []
  const userMessage = buildBuddyUserMessage(highlight, descriptions)

  // Fire all buddies in parallel. allSettled (not all) so one failure
  // doesn't take down the others.
  const results = await Promise.allSettled(
    BUDDIES.map((buddy) =>
      callClaude({
        system: buddy.systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        maxTokens: 200,   // WAS 400 — enforces 2-3 sentence cap
      }).then((result) => ({ buddy, result })),
    ),
  )

  // If even one buddy returned no-key, the whole prototype is in fallback mode —
  // surface that explicitly so the client can show a useful message.
  const anyNoKey = results.some(
    (r) => r.status === 'fulfilled' && r.value.result.kind === 'no-key',
  )
  if (anyNoKey) {
    return res.status(501).json({
      error:
        'ANTHROPIC_API_KEY not configured on the server. Add it to .env and restart to enable buddies.',
    })
  }

  const now = new Date().toISOString()
  const responses: BuddyResponse[] = results.map((r) => {
    if (r.status === 'rejected') {
      return { id: randomUUID(), buddyId: 'unknown', error: String(r.reason), createdAt: now }
    }
    const { buddy, result } = r.value
    if (result.kind === 'ok') {
      return { id: randomUUID(), buddyId: buddy.id, buddyName: buddy.name, text: result.text, createdAt: now }
    }
    return { id: randomUUID(), buddyId: buddy.id, error: result.message, createdAt: now }
  })

  const body: ConsultResponse = { responses }
  res.json(body)
})

// Expose the buddy roster so the client can render names/descriptions
// without duplicating the persona list.
consultRoute.get('/buddies', (_req, res) => {
  const body: BuddiesResponse = {
    buddies: BUDDIES.map(({ id, name, description }) => ({ id, name, description })),
  }
  res.json(body)
})
