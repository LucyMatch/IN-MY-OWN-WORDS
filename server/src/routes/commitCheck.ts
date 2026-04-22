import { Router } from 'express'
import { callClaude } from '../lib/anthropic.js'
import type { CommitCheckRequest, CommitCheckResponse } from '@shared/types'

export const commitCheckRoute = Router()

const COMMIT_CHECK_SYSTEM_PROMPT = `You judge whether a reader has synthesised their understanding of a passage well enough to commit to it.

The bar (ALL THREE must be met):
1. They've identified the real thing the passage is doing, not just surface-level description.
2. They've connected their observations into a single coherent thought — not a list of fragments.
3. They've expressed it in their own words — not echoed or borrowed phrasing.

You receive: the highlighted passage, the reader's current descriptions (their attempts at articulation), and the most recent coach response.

Return JSON ONLY, no other text, in this exact shape:
{"commitReady": <boolean>, "reason": "<one short sentence>"}

Guidance:
- Default to false. Only return true when all three bars are clearly met.
- If the coach's last response was a push ("try this specific thing", "one more step", "connect X to Y", "try another in your own words"), return false — the coach is still working.
- If the coach's last response was a clear release ("commit-worthy", "that's it", "you've got it"), check the descriptions yourself before returning true. The coach can drift toward validation; you are the second opinion.
- Do not soften over time. Multiple rounds of pushing does not mean the reader has earned the commit. Judge the current state only.

Return JSON ONLY. No preamble, no explanation outside the JSON.`

commitCheckRoute.post('/commit-check', async (req, res) => {
  const { highlight, bubbles, facilitatorResponse } = (req.body ?? {}) as Partial<CommitCheckRequest>

  if (!highlight || !Array.isArray(bubbles) || !facilitatorResponse) {
    return res.status(400).json({ error: 'Missing required fields: highlight, bubbles, facilitatorResponse' })
  }

  const userMessage = `Passage:
"${highlight}"

Reader's current descriptions:
${bubbles.map((b, i) => `${i + 1}. ${b}`).join('\n')}

Coach's latest response:
"${facilitatorResponse}"

Judge commit-readiness. Return JSON only.`

  const result = await callClaude({
    system: COMMIT_CHECK_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 100,
  })

  if (result.kind === 'no-key') {
    return res.status(501).json({ error: result.message })
  }
  if (result.kind === 'error') {
    return res.status(500).json({ error: result.message })
  }

  let parsed: CommitCheckResponse = { commitReady: false, reason: 'Could not parse classifier response.' }
  try {
    const trimmed = result.text.trim()
    const cleaned = trimmed.replace(/^```(?:json)?\s*|\s*```$/g, '')
    const raw = JSON.parse(cleaned)
    if (typeof raw.commitReady === 'boolean') {
      parsed = {
        commitReady: raw.commitReady,
        reason: typeof raw.reason === 'string' ? raw.reason : '',
      }
    }
  } catch {
    // keep the conservative default
  }

  res.json(parsed)
})
