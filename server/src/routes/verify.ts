/**
 * "Are you sure about that?" — re-prompt a buddy response to sanity-check itself.
 * POST /api/verify
 *   body: VerifyRequest    → { highlight, originalResponse, buddyId? }
 *   res:  VerifyResponse   → { text }
 *
 * The button surfaces against any buddy response in the UI. Clicking it
 * sends the original response back through Claude with a system prompt
 * that asks it to scrutinise its own claims, correct anything wrong,
 * and reaffirm what stands.
 *
 * Discernment-as-feature: the goal isn't to make buddies "more right",
 * it's to give the reader a one-click way to put pressure on a claim
 * they don't trust. The model can still be wrong — that's also useful.
 */

import { Router } from 'express'
import { callClaude } from '../lib/anthropic.js'
import { BUDDIES } from '../lib/buddies.js'
import type { VerifyRequest, VerifyResponse } from '@shared/types'

export const verifyRoute = Router()

const VERIFY_SYSTEM_PROMPT = `You are reviewing a previous response you (or another reading buddy) gave about a passage. The reader has clicked "verify" — they're not sure they trust the claim.

Your job is to scrutinise the previous response:
- Are the factual claims accurate? If not, correct them plainly.
- Are there overstatements, hedges that should be sharper, or assumptions presented as facts? Flag them.
- If the response stands up, say so plainly and briefly. Don't pad.
- Keep your reply to 2-4 sentences. This is a sanity check, not a re-explanation.

Do not flatter the reader for asking. Just review and respond.`

verifyRoute.post('/verify', async (req, res) => {
  const { highlight, originalResponse, buddyId } = (req.body ?? {}) as Partial<VerifyRequest>

  if (!highlight || !originalResponse) {
    return res
      .status(400)
      .json({ error: 'Missing required fields: highlight (string), originalResponse (string).' })
  }

  // If the buddyId is supplied and matches a known buddy, mention its
  // persona so the verification stays in-character. Otherwise generic.
  const buddy = buddyId ? BUDDIES.find((b) => b.id === buddyId) : undefined
  const personaContext = buddy
    ? `\n\nThe original response came from "${buddy.name}" (${buddy.description}). Stay roughly in that voice while reviewing.`
    : ''

  const userMessage = `Passage:\n"${highlight}"\n\nPrevious response:\n"${originalResponse}"\n\nReview it.`

  const result = await callClaude({
    system: VERIFY_SYSTEM_PROMPT + personaContext,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens: 200,   // WAS 400
  })

  if (result.kind === 'no-key') {
    return res.status(501).json({ error: result.message })
  }
  if (result.kind === 'error') {
    return res.status(500).json({ error: result.message })
  }

  const body: VerifyResponse = { text: result.text }
  res.json(body)
})
