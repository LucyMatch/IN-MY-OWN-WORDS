import { Router } from 'express'
import { callClaude } from '../lib/anthropic.js'
import { PERSONAS } from '../lib/personas.js'
import type { LensRequest, LensResponse } from '@shared/types'

export const lensRoute = Router()

lensRoute.post('/lens', async (req, res) => {
  const { personaId, highlight, descriptions, session, chatHistory } = (req.body ?? {}) as Partial<LensRequest>

  if (!personaId || typeof highlight !== 'string') {
    return res.status(400).json({ error: 'Missing required fields: personaId, highlight.' })
  }

  const persona = PERSONAS.find((p) => p.id === personaId)
  if (!persona) {
    return res.status(404).json({ error: `Unknown persona: ${personaId}` })
  }

  let system = persona.systemPrompt

  if (session) {
    system += `\n\n--- SESSION CONTEXT ---
Title: ${session.title}
Author: ${session.author}
Section: ${session.section}`
  }

  const descriptionBlock =
    descriptions && descriptions.length > 0
      ? `\n\nThe reader's current descriptions of the passage:\n${descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`
      : ''

  // Pass only the last 4 chat turns — recency awareness, don't overwhelm.
  const recentChat = (chatHistory ?? []).slice(-4)
  const chatBlock =
    recentChat.length > 0
      ? `\n\nRecent conversation (for context — don't repeat what's been said):\n${recentChat.map((m) => `[${m.role}] ${m.content}`).join('\n')}`
      : ''

  const userMessage = `Passage:\n"${highlight}"${descriptionBlock}${chatBlock}\n\nRespond per your system prompt. Remember to open with your framing phrase.`

  const result = await callClaude({
    system,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens: 180,
  })

  if (result.kind === 'no-key') return res.status(501).json({ error: result.message })
  if (result.kind === 'error') return res.status(500).json({ error: result.message })

  const body: LensResponse = { text: result.text, personaName: persona.name, personaId: persona.id }
  res.json(body)
})
