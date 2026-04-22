import type { Highlight } from '@shared/types'

function sanitizeForSave(highlights: Highlight[]): Highlight[] {
  return highlights.map((h) => ({
    ...h,
    commitReady: false,
  }))
}

export async function loadHighlights(): Promise<Highlight[]> {
  try {
    const response = await fetch('/api/highlights')
    if (!response.ok) {
      console.error('[persistence] load failed with status', response.status)
      return []
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await response.json()) as any[]
    return data.map((h: any) => {
      const { buddyResponses: _buddyResponses, ...rest } = h  // drop old field if present
      return {
        ...rest,
        commitReady: false,
        chatHistory: rest.chatHistory ?? [],
      } as Highlight
    })
  } catch (err) {
    console.error('[persistence] load error', err)
    return []
  }
}

/**
 * Fire-and-forget save. Failures log to console but don't block the UI.
 * Any failed save retries naturally on the next mutation.
 */
export function saveHighlights(highlights: Highlight[]): void {
  const payload = sanitizeForSave(highlights)
  void fetch('/api/highlights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.error('[persistence] save error', err)
  })
}
