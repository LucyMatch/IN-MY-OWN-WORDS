/**
 * Anthropic SDK wrapper.
 *
 * Centralises:
 *   - The SDK client instance (created once, reused)
 *   - The "no API key" fallback so the app stays usable for UI work
 *   - The default model
 *
 * Usage in routes:
 *   const result = await callClaude({ system, messages })
 *   if (result.kind === 'no-key') return res.status(501).json({ error: result.message })
 *   res.json({ text: result.text })
 */

import Anthropic from '@anthropic-ai/sdk'

// Client is constructed on first call so it reads the env var after dotenv has
// loaded. ES module imports are hoisted before any code runs (including
// dotenv.config in index.ts), so reading ANTHROPIC_API_KEY at module init time
// always sees undefined.
let _client: Anthropic | null = null
function getClient(): Anthropic | null {
  if (_client) return _client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  _client = new Anthropic({ apiKey })
  return _client
}

// Default model. Bump as new ones land. Override per-call if you want.
export const DEFAULT_MODEL = 'claude-sonnet-4-6'

export type ClaudeMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type ClaudeCallResult =
  | { kind: 'ok'; text: string }
  | { kind: 'no-key'; message: string }
  | { kind: 'error'; message: string }

export type ClaudeCallParams = {
  system?: string
  messages: ClaudeMessage[]
  model?: string
  maxTokens?: number
}

/**
 * One-shot Claude call. Returns the full assistant text (no streaming).
 * If no API key is configured, returns a friendly { kind: 'no-key' } so
 * the caller can return 501 with a useful body.
 */
export async function callClaude(params: ClaudeCallParams): Promise<ClaudeCallResult> {
  const client = getClient()
  if (!client) {
    return {
      kind: 'no-key',
      message:
        'ANTHROPIC_API_KEY not configured on the server. Add it to .env and restart the server to enable AI responses.',
    }
  }

  try {
    const response = await client.messages.create({
      model: params.model ?? DEFAULT_MODEL,
      max_tokens: params.maxTokens ?? 1024,
      system: params.system,
      messages: params.messages,
    })

    // The SDK returns content as an array of blocks. For text-only responses
    // we grab every block whose .type is 'text' and join them. Using a
    // structural check (rather than importing TextBlock) so this stays
    // resilient to SDK type renames.
    const text = response.content
      .filter((block): block is { type: 'text'; text: string } & typeof block =>
        block.type === 'text' && 'text' in block,
      )
      .map((block) => block.text)
      .join('\n')

    return { kind: 'ok', text }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error calling Anthropic API'
    console.error('[anthropic]', message)
    return { kind: 'error', message }
  }
}
