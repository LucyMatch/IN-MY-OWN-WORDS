# Plan 04 — Facilitator Wire-Up

Read `BUILD_PLANS/context.md`, `BUILD_PLANS/STATE.md`, and `BUILD_PLANS/design-patterns.md` first. Also read `docs/ai-design.md` for the Facilitator persona bar — referenced throughout.

**Prerequisite:** plan-03 is done. `InYourOwnWordsPane` is rendering bubbles (staged/yellow), commit button is disabled-with-tooltip, `activeHighlightId` is threaded through the app, `FacilitatorChat` is a placeholder shell in the top-right slot.

---

## What this builds

The Facilitator becomes real. It runs as an **always-present chat** in the top-right pane with two modes interleaved on the same message thread:

- **Chat mode** — user types into the chat input, Facilitator replies conversationally. Used for clarifying questions, general discussion, "what does this word mean," etc. No commit logic.
- **Synthesis mode** — user stages a bubble (clicks + on empty input, or + on the edit pencil to save a changed bubble). This triggers a separate API call that sends the highlight + full current bubble state + chat history, and asks the Facilitator to respond in "help the reader synthesise" mode. The response lands in the same chat thread. A **second classifier call** follows, judging whether the user's current bubbles are commit-worthy. Commit button unlocks on `true`.

After this plan:

- `FacilitatorChat` is a real chat component — message list + input + loading state — wired to `/api/facilitator`.
- Chat history is **per-session**. Persists across highlight switches within a session; cleared on session change.
- Staging a bubble (+) triggers a synthesis call with full bubble context.
- Saving an edit (inline + button on StagedBubble) also triggers a synthesis call. The bubble sent is marked as edited so the Facilitator knows which one is new/changed.
- After every synthesis response, a classifier call (cheap Haiku) judges commit-readiness.
- Commit button: disabled by default → enabled when classifier returns `true`. Small "Commit anyway" text link underneath when disabled, for the agency escape hatch.
- Committing: all bubbles on the active highlight flip to `committed: true`, the marks in the reading pane transition to `bg-commit` sage green, committed bubbles become read-only (edit/delete buttons hidden), `EmptyInputBubble` disappears, commit button changes to a "Committed" static state.
- Loading states throughout — typing indicator in chat during Facilitator response; disabled stage buttons during synthesis.

**What this plan does NOT do:**

- No Buddy wire-up (plan-05).
- No persistence (plan-06).
- No PDF/upload features (scoped out).
- No streaming — everything is single-shot request/response with a loader.

---

## Code patterns

Read `BUILD_PLANS/design-patterns.md`. Patterns that apply:

- Canonical component shape for every new/rewritten component.
- `cn()` on every className.
- Data-attributes for state (`data-committed` on bubbles and marks; `data-loading` on the chat input area).
- `Button` primitive for the commit tick (it's a standalone action). Raw `<button>` for chat send.

---

## The two-call model on synthesis turns

Every synthesis turn is **two sequential API calls**:

1. **Facilitator response call** (`/api/facilitator`, existing endpoint, refined prompt).
2. **Commit classifier call** (`/api/commit-check`, NEW endpoint, cheap Haiku).

The classifier is stateless relative to round count — it can't be worn down by repeated asking. It reads: the highlight, the current bubbles, and the Facilitator's latest response. Returns `{commitReady: boolean, reason: string}`. Reason is for debugging, not displayed to user.

Chat turns (user types in the chat input) use ONLY the Facilitator response call. No classifier needed — chat doesn't affect commit state.

---

## Data model changes

### Update `Highlight` type

Remove `buddyResponses` for now (plan-05 adds it back properly). Add a per-highlight commit-ready flag:

Actually — don't touch `buddyResponses`. It's already there and plan-05 uses it. Leave it. Add:

```ts
export type Highlight = {
  id: string
  sessionId: string
  ranges: HighlightRange[]
  text: string
  bubbles: Bubble[]
  buddyResponses: BuddyResponse[]
  /** True if the classifier has cleared the current bubble set for commit. Transient — not persisted. */
  commitReady: boolean            // NEW — plan-04
  createdAt: string
}
```

`commitReady` is transient UI state. Plan-06 will decide whether to persist it. For now it lives on the Highlight because it's a property of the bubble set, and clean access from both the reading pane and the bubbles pane.

### Update `ChatMessage` type (add optional kind tag)

So we can visually distinguish chat vs synthesis responses if we want to later. Non-blocking for plan-04; the kind defaults to 'chat'.

```ts
export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  /** Optional: distinguishes the two modes of response for rendering. Defaults to 'chat'. */
  kind?: 'chat' | 'synthesis'
}
```

### Update `FacilitatorRequest` (add synthesis context)

The existing shape is `{messages, highlight?}`. Extend:

```ts
export type FacilitatorRequest = {
  messages: ChatMessage[]
  highlight?: string                  // the selected passage text
  /** If provided, this is a synthesis call — Facilitator pivots to synthesis-mode prompt. */
  synthesisContext?: {
    bubbles: Array<{
      text: string
      /** True if this is the bubble the user just staged or just edited. */
      isFocus: boolean
    }>
  }
}
```

When `synthesisContext` is present, the server uses the synthesis system prompt. When absent, the chat system prompt.

### New types for classifier endpoint

```ts
export type CommitCheckRequest = {
  highlight: string
  bubbles: string[]                   // current bubble texts, in order
  facilitatorResponse: string         // the latest response text from Facilitator
}

export type CommitCheckResponse = {
  commitReady: boolean
  reason: string
}
```

---

## Server changes

### New route: `server/src/routes/commitCheck.ts`

```ts
import { Router } from 'express'
import { callClaude } from '../lib/anthropic.js'
import type { CommitCheckRequest, CommitCheckResponse } from '@shared/types'

export const commitCheckRoute = Router()

const COMMIT_CHECK_SYSTEM_PROMPT = `You judge whether a reader has synthesised their understanding of a passage well enough to commit to it.

The bar (ALL THREE must be met):
1. They've identified the real thing the passage is doing, not just surface-level description.
2. They've connected their observations into a single coherent thought — not a list of fragments.
3. They've expressed it in their own words — not echoed or borrowed phrasing.

You receive: the highlighted passage, the reader's current bubbles (their attempts at articulation), and the most recent Facilitator response.

Return JSON ONLY, no other text, in this exact shape:
{"commitReady": <boolean>, "reason": "<one short sentence>"}

Guidance:
- Default to false. Only return true when all three bars are clearly met.
- If the Facilitator's last response was a push ("try this specific thing", "one more step", "connect X to Y"), return false — the Facilitator is still working.
- If the Facilitator's last response was a clear release ("commit-worthy", "that's it", "you've got it"), check the bubbles yourself before returning true. The Facilitator can drift toward validation; you are the second opinion.
- Do not soften over time. Multiple rounds of pushing does not mean the user has earned the commit. Judge the current state only.

Return JSON ONLY. No preamble, no explanation outside the JSON.`

commitCheckRoute.post('/commit-check', async (req, res) => {
  const { highlight, bubbles, facilitatorResponse } = (req.body ?? {}) as Partial<CommitCheckRequest>

  if (!highlight || !Array.isArray(bubbles) || !facilitatorResponse) {
    return res.status(400).json({ error: 'Missing required fields: highlight, bubbles, facilitatorResponse' })
  }

  const userMessage = `Passage:
"${highlight}"

Reader's current bubbles:
${bubbles.map((b, i) => `${i + 1}. ${b}`).join('\n')}

Facilitator's latest response:
"${facilitatorResponse}"

Judge commit-readiness. Return JSON only.`

  const result = await callClaude({
    system: COMMIT_CHECK_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    model: 'claude-haiku-4-5-20251001',   // cheap classifier
    maxTokens: 100,
  })

  if (result.kind === 'no-key') {
    return res.status(501).json({ error: result.message })
  }
  if (result.kind === 'error') {
    return res.status(500).json({ error: result.message })
  }

  // Parse the JSON. If it fails, default to false (conservative).
  let parsed: CommitCheckResponse = { commitReady: false, reason: 'Could not parse classifier response.' }
  try {
    const trimmed = result.text.trim()
    // Strip any accidental code fences
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
```

Register in `server/src/index.ts` alongside the other routes.

### Update `server/src/routes/facilitator.ts`

The route stays at `/api/facilitator` but now handles both modes based on whether `synthesisContext` is in the request.

Two system prompts:

```ts
const CHAT_SYSTEM_PROMPT = `You are the Facilitator — a reading companion helping someone work through a piece of writing.

Behaviour:
- Engage with their questions about the text. Answer what the passage says, clarify vocabulary, discuss context.
- When they ask for your interpretation, redirect gently — "what do you make of it?" — but don't refuse if they push.
- Keep replies short and conversational (2-4 sentences typically).
- Never lecture. Never list unprompted. You are a person, not a textbook.
- Warm but not sycophantic. Care that they understand, not that they feel praised.`

const SYNTHESIS_SYSTEM_PROMPT = `You are the Facilitator — a reading coach working with someone who is trying to articulate their understanding of a passage in their own words.

Context you receive with this call:
- The highlighted passage they're working on.
- Their current "bubbles" — each is one attempt at articulating the passage. They may be iterating across multiple bubbles.
- One bubble is marked as "focus" — the one they just added or edited. React to this one primarily; the others are context.

Your job: push them toward synthesis. The bar for "commit-worthy":
1. They've identified the real thing the passage is doing.
2. They've connected observations into a single coherent thought.
3. They've expressed it in their own words.

Response pattern:
- 1-2 sentences, interrogative or directional.
- Name what's missing AND point at the specific next move.
- NEVER "try again" or "think more." Always "try this specific thing."

Anti-patterns:
- **Validation machine.** Agreeing too quickly. If they're MOSTLY right, push one more round. Soft-commits corrupt the learning.
- **Vague prompts.** "Think about X" is useless. The move must be specific.
- **Over-teaching.** Do not explain the passage. Work on their writing.
- **Soft-pedalling.** Warm but direct. No "great job!" No "interesting thought!"

Move library (examples):
- "You've got the target but flattened two moves into one — what does X add?"
- "You've got the what, now connect it to the how."
- "You're telling me, not showing me — name the specific thing."
- "You've answered your own question — now write it in one thought."
- "That's it. Commit-worthy."

If their current bubbles meet all three bars, say so plainly. Otherwise push.`
```

Route logic:

```ts
facilitatorRoute.post('/facilitator', async (req, res) => {
  const { messages, highlight, synthesisContext } = (req.body ?? {}) as Partial<FacilitatorRequest>

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing required field: messages (non-empty array of {role, content}).' })
  }

  const isSynthesis = !!synthesisContext
  const systemBase = isSynthesis ? SYNTHESIS_SYSTEM_PROMPT : CHAT_SYSTEM_PROMPT

  let system = systemBase
  if (highlight) {
    system += `\n\nThe reader is currently focused on this passage:\n"${highlight}"`
  }
  if (isSynthesis && synthesisContext) {
    const bubbleList = synthesisContext.bubbles
      .map((b, i) => `${i + 1}. ${b.isFocus ? '[FOCUS — newest/edited] ' : ''}${b.text}`)
      .join('\n')
    system += `\n\nTheir current bubbles:\n${bubbleList}`
  }

  const result = await callClaude({
    system,
    messages,
    maxTokens: 600,
  })

  if (result.kind === 'no-key') {
    return res.status(501).json({ error: result.message })
  }
  if (result.kind === 'error') {
    return res.status(500).json({ error: result.message })
  }

  res.json({ text: result.text })
})
```

---

## Client-side state shape

### `PrototypeSlide` adds:

```tsx
const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])  // per-session
const [facilitatorLoading, setFacilitatorLoading] = useState(false)

// Clear chat on session switch (next to existing highlights+active reset)
useEffect(() => {
  setHighlights([])
  setActiveHighlightId(null)
  setChatHistory([])
}, [activeSessionId])
```

### Two new handler functions in `PrototypeSlide`:

**`sendChatMessage(text: string)`** — pure chat turn.
1. Append `{role: 'user', content: text, kind: 'chat'}` to chatHistory.
2. Set `facilitatorLoading = true`.
3. POST `/api/facilitator` with `messages: [...chatHistory, newUserMessage]`, `highlight: activeHighlight?.text`, NO synthesisContext.
4. Append `{role: 'assistant', content: response.text, kind: 'chat'}` to chatHistory.
5. Set `facilitatorLoading = false`.

**`sendSynthesisTurn(highlightId: string, focusBubbleId: string)`** — staged-bubble turn.
1. Find the highlight and the focus bubble.
2. Build a synthetic user message: `"[staged: '{focusBubble.text}']"` — appended to chatHistory with `kind: 'synthesis'`.
3. Set `facilitatorLoading = true`.
4. POST `/api/facilitator` with:
   - `messages`: full chatHistory including the synthetic user message
   - `highlight`: the Highlight's `text`
   - `synthesisContext.bubbles`: all bubbles, with `isFocus: b.id === focusBubbleId`
5. Append facilitator response to chatHistory with `kind: 'synthesis'`.
6. POST `/api/commit-check` with highlight, bubble texts, and facilitator response text.
7. Update the highlight's `commitReady` based on the classifier result.
8. Set `facilitatorLoading = false`.

### Wire the existing bubble mutation handlers to trigger synthesis

Update `addBubble` and `updateBubble`:

```tsx
function addBubble(highlightId: string, text: string) {
  const newBubbleId = crypto.randomUUID()
  setHighlights((prev) =>
    prev.map((h) =>
      h.id === highlightId
        ? {
            ...h,
            bubbles: [...h.bubbles, {
              id: newBubbleId,
              text,
              staged: true,
              committed: false,
              createdAt: new Date().toISOString(),
            }],
            commitReady: false,  // reset pending classifier re-check
          }
        : h
    )
  )
  // Fire-and-forget synthesis call
  void sendSynthesisTurn(highlightId, newBubbleId)
}

function updateBubble(highlightId: string, bubbleId: string, text: string) {
  setHighlights((prev) =>
    prev.map((h) =>
      h.id === highlightId
        ? {
            ...h,
            bubbles: h.bubbles.map((b) => (b.id === bubbleId ? { ...b, text } : b)),
            commitReady: false,  // reset pending classifier re-check
          }
        : h
    )
  )
  void sendSynthesisTurn(highlightId, bubbleId)
}
```

`deleteBubble` does NOT trigger a synthesis call. Deleting is a structural change, not a new articulation for review.

### New commit handler

```tsx
function commitHighlight(highlightId: string) {
  setHighlights((prev) =>
    prev.map((h) =>
      h.id === highlightId
        ? {
            ...h,
            bubbles: h.bubbles.map((b) => ({ ...b, committed: true, staged: false })),
            commitReady: false,  // no longer relevant after commit
          }
        : h
    )
  )
  // No API call; commit is local state only.
}
```

Override case ("Commit anyway"): same handler. The button either fires with classifier approval or via the override link.

Pass down to `InYourOwnWordsPane`: `onCommit: (highlightId: string) => void`.

### Pass `chatHistory`, `facilitatorLoading`, `sendChatMessage` to `FacilitatorChat`.

Pass `commitReady` (from the active highlight) and `onCommit` to `InYourOwnWordsPane`. Also pass `facilitatorLoading` so bubble stage buttons can disable during a call.

---

## `FacilitatorChat` — full rewrite

Current: placeholder. Now a real chat component.

### Props

```ts
type FacilitatorChatProps = {
  messages: ChatMessage[]
  loading: boolean
  onSend: (text: string) => void
}
```

### Layout

Header + scrollable messages + input at bottom (fixed).

```tsx
<div className="flex min-h-0 flex-1 flex-col">
  <div className="border-border-subtle flex items-center border-b px-4 pb-2 pt-4">
    <p className="text-text-tertiary text-xs uppercase tracking-widest">Facilitator</p>
  </div>

  <div className="scroll-area flex-1 overflow-y-auto px-4 py-3">
    {messages.length === 0 ? (
      <EmptyState />
    ) : (
      messages.map((m, i) => <ChatBubble key={i} message={m} />)
    )}
    {loading && <TypingIndicator />}
  </div>

  <div className="border-border-subtle border-t p-3">
    <ChatInput onSend={onSend} disabled={loading} />
  </div>
</div>
```

### `ChatBubble` subcomponent (inline in same file)

```tsx
function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div
      data-role={message.role}
      data-kind={message.kind ?? 'chat'}
      className={cn(
        'mb-3 max-w-[85%] rounded-xl px-3 py-2 text-sm leading-snug',
        isUser
          ? 'bg-user-bubble text-text-primary ml-auto'
          : 'text-text-primary',
      )}
    >
      {message.kind === 'synthesis' && isUser && (
        <p className="text-text-tertiary mb-1 text-xs">Staged:</p>
      )}
      <p className="whitespace-pre-line">{message.content}</p>
    </div>
  )
}
```

User chat messages sit right, in the user-bubble grey. Facilitator messages sit left, no bubble background — just text (matches the starter's ClaudeMessage pattern).

Synthesis-kind user messages get a small "Staged:" label prefix to distinguish them visually from typed chat messages.

### `ChatInput` subcomponent (inline)

```tsx
function ChatInput({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  const [value, setValue] = useState('')
  const canSend = value.trim().length > 0 && !disabled

  function handleSend() {
    if (!canSend) return
    onSend(value.trim())
    setValue('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="bg-surface shadow-input flex items-end rounded-xl">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask the facilitator…"
        rows={1}
        disabled={disabled}
        className="text-text-primary placeholder:text-text-tertiary flex-1 resize-none border-none bg-transparent px-3 py-2 text-sm leading-snug outline-none disabled:opacity-50"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        aria-label="Send message"
        className="text-text-tertiary hover:text-text-primary m-1 flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ArrowUp className="size-4" />
      </button>
    </div>
  )
}
```

### `TypingIndicator`

Simple three-dot animation.

```tsx
function TypingIndicator() {
  return (
    <div className="text-text-tertiary mb-3 flex items-center gap-1 text-sm">
      <span className="animate-bounce" style={{ animationDelay: '0ms' }}>•</span>
      <span className="animate-bounce" style={{ animationDelay: '150ms' }}>•</span>
      <span className="animate-bounce" style={{ animationDelay: '300ms' }}>•</span>
    </div>
  )
}
```

### `EmptyState`

```tsx
function EmptyState() {
  return (
    <div className="text-text-tertiary flex h-full flex-col items-center justify-center px-6 text-center text-sm">
      <p>Ask the Facilitator anything about the passage. Highlight and stage a bubble for focused feedback.</p>
    </div>
  )
}
```

---

## `InYourOwnWordsPane` — updates

### New props

```ts
commitReady: boolean
onCommit: (highlightId: string) => void
facilitatorLoading: boolean
```

### Commit button behaviour

Three visual states:

- **Disabled + commit-not-ready** — button disabled, "Commit anyway" link shown beneath.
- **Enabled + commit-ready** — button active (sage green tick), no override link.
- **Committed** — button replaced with a static "Committed" badge. Empty input bubble hidden.

```tsx
{activeHighlight && activeHighlight.bubbles.every((b) => b.committed) && activeHighlight.bubbles.length > 0 ? (
  <div className="border-border-subtle flex items-center justify-center border-t px-4 py-3">
    <div className="text-commit flex items-center gap-2 text-sm">
      <Check className="size-4" />
      <span>Committed</span>
    </div>
  </div>
) : activeHighlight ? (
  <div className="border-border-subtle flex flex-col items-stretch border-t px-4 py-3">
    <Button
      variant="primary"
      disabled={!commitReady || facilitatorLoading || activeHighlight.bubbles.length === 0}
      onClick={() => onCommit(activeHighlight.id)}
      title={!commitReady ? 'Facilitator response required to commit' : undefined}
      className="w-full gap-2"
    >
      <Check className="size-4" />
      Commit
    </Button>
    {!commitReady && activeHighlight.bubbles.length > 0 && !facilitatorLoading && (
      <button
        type="button"
        onClick={() => onCommit(activeHighlight.id)}
        className="text-text-tertiary hover:text-text-primary mt-2 cursor-pointer text-xs underline-offset-2 hover:underline"
      >
        Commit anyway
      </button>
    )}
  </div>
) : null}
```

### Hide EmptyInputBubble when highlight is committed

```tsx
{activeHighlight ? (
  <>
    {!activeHighlight.bubbles.some((b) => b.committed) && (
      <EmptyInputBubble onStage={(text) => onAddBubble(activeHighlight.id, text)} />
    )}
    {activeHighlight.bubbles.map((b) => (
      <StagedBubble
        key={b.id}
        bubble={b}
        onUpdate={(text) => onUpdateBubble(activeHighlight.id, b.id, text)}
        onDelete={() => onDeleteBubble(activeHighlight.id, b.id)}
      />
    ))}
  </>
) : (
  <InstructionText />
)}
```

Check for `some((b) => b.committed)` — if any bubble is committed, they're all committed (the commit action flips them all). Hide the input.

### Disable stage during facilitator loading

Pass `disabled={facilitatorLoading}` through to `EmptyInputBubble` and `StagedBubble` so the + buttons don't fire while a call is in flight.

---

## `StagedBubble` — updates for committed state

When `bubble.committed === true`:

- Use `bg-commit` (sage green) instead of `bg-highlight` yellow.
- Hide edit (pencil) and delete (×) buttons.
- Bubble becomes read-only display.

```tsx
return (
  <div
    data-editing={isEditing || undefined}
    data-committed={bubble.committed || undefined}
    className={cn(
      'mb-3 flex flex-col rounded-xl px-3 py-2',
      'bg-highlight data-[committed]:bg-commit',
    )}
  >
    {/* ... existing inner content ... */}
    {!bubble.committed && (
      <div className="mt-1 flex justify-end gap-1">
        {/* edit/delete buttons as before */}
      </div>
    )}
  </div>
)
```

---

## `ReadingPane` / mark — updates for committed highlights

Extend the `<mark>` class to switch colour when the highlight is committed:

```tsx
const isCommitted = h.bubbles.length > 0 && h.bubbles.every((b) => b.committed)
// ...
<mark
  data-highlight-id={seg.highlightId}
  data-active={h.id === activeHighlightId || undefined}
  data-committed={isCommitted || undefined}
  onClick={() => onSetActiveHighlight(h.id)}
  className={cn(
    'cursor-pointer rounded-[2px] px-0.5 transition-colors duration-500',
    'bg-highlight data-[committed]:bg-commit',
    'data-[active]:ring-2 data-[active]:ring-accent-strong/40',
  )}
>
  {seg.text}
</mark>
```

Actually: `segmentParagraph` returns segments that have `highlightId` but not the highlight object itself. Either:
- Look up the highlight by id inside the map (small map lookup cost per mark — fine).
- Extend `segmentParagraph` to include `isCommitted` on the segment.

Go with the lookup inside the map — keeps `segmentParagraph` pure.

```tsx
{segments.map((seg, j) => {
  if (seg.type === 'text') return seg.text
  const h = highlights.find((x) => x.id === seg.highlightId)
  const isCommitted = h ? h.bubbles.length > 0 && h.bubbles.every((b) => b.committed) : false
  return (
    <mark
      key={j}
      data-highlight-id={seg.highlightId}
      data-active={seg.highlightId === activeHighlightId || undefined}
      data-committed={isCommitted || undefined}
      onClick={() => onSetActiveHighlight(seg.highlightId)}
      className={cn(
        'cursor-pointer rounded-[2px] px-0.5 transition-colors duration-500',
        'bg-highlight data-[committed]:bg-commit',
        'data-[active]:ring-2 data-[active]:ring-accent-strong/40',
      )}
    >
      {seg.text}
    </mark>
  )
})}
```

The `transition-colors duration-500` gives the yellow → green commit moment its visual payoff.

---

## Files to create

```
server/src/routes/commitCheck.ts
```

## Files to modify

```
shared/types.ts                                         ← Highlight.commitReady, ChatMessage.kind, FacilitatorRequest.synthesisContext, CommitCheckRequest/Response
server/src/routes/facilitator.ts                        ← two system prompts, synthesisContext handling
server/src/index.ts                                     ← register commitCheckRoute
client/src/components/slides/PrototypeSlide.tsx         ← chatHistory, loading state, sendChatMessage, sendSynthesisTurn, wire addBubble/updateBubble to trigger synthesis, commitHighlight handler
client/src/components/prototype/FacilitatorChat.tsx     ← full rewrite: messages, input, loading
client/src/components/prototype/InYourOwnWordsPane.tsx  ← commit button states, hide input when committed, disable during loading
client/src/components/prototype/StagedBubble.tsx        ← committed visual state + hide edit/delete when committed
client/src/components/prototype/ReadingPane.tsx         ← committed mark colour transition
```

No changes to `EmptyInputBubble.tsx` beyond the optional `disabled` prop.

---

## Constraints

- **Two-call model on synthesis.** Facilitator call THEN classifier. Not parallel — classifier needs the facilitator's response.
- **Classifier is Haiku.** Cheap. Fast. Stateless-in-spirit.
- **No streaming.** Loading indicators do the work.
- **No persistence.** Plan-06 still handles that — but `commitReady` is transient by design anyway.
- **No post-commit edits.** Committed bubbles are read-only. Empty input bubble disappears. If user wants to redo, delete the whole highlight.
- **Chat history is per-session.** Persists across highlight switches within a session. Cleared on session change.
- **Don't start the dev server.** Lucy verifies visually.
- **Match `BUILD_PLANS/design-patterns.md`.**

---

## Out of scope

- Buddy wire-up (plan 05)
- Persistence (plan 06)
- Streaming responses (parked — feature plan if desired)
- Bubble reordering / drag-to-sort (not planned)
- "Undo commit" — explicit scope call, user must delete highlight to restart
- Multiple concurrent highlights with in-flight facilitator calls (treat as sequential for prototype; if user spams + during a call, the second call queues naturally via React state)

---

## Definition of done

- `shared/types.ts` updated: `Highlight.commitReady`, `ChatMessage.kind?`, `FacilitatorRequest.synthesisContext?`, new `CommitCheckRequest` / `CommitCheckResponse`.
- `server/src/routes/commitCheck.ts` exists; registered in `index.ts`.
- `server/src/routes/facilitator.ts` has both system prompts and switches based on `synthesisContext`.
- `FacilitatorChat` is a real chat: messages render, input works, typing indicator shows during loading.
- Typing in the chat input and pressing Enter (or the send button) calls `/api/facilitator` in chat mode — no classifier call fires.
- Staging a bubble (+) calls `/api/facilitator` in synthesis mode with the full bubble set + focus flag, THEN `/api/commit-check`. Both appear in chat history.
- Editing a staged bubble and clicking + to save → same two-call flow, with the edited bubble marked as focus.
- `commitReady` on the active highlight updates based on classifier result.
- Commit button is disabled by default. "Commit anyway" link appears underneath (small text). Link fires the same commit handler.
- When classifier returns `true`, commit button enables and "Commit anyway" link disappears.
- Clicking commit: all bubbles flip to `committed: true`. Bubbles transition from yellow → sage green. Marks in reading pane transition. Empty input bubble disappears. Commit area replaced with static "Committed" badge.
- Session switch clears chat history AND highlights AND active id.
- Chat continues uninterrupted when user switches highlights within a session.
- If `ANTHROPIC_API_KEY` is missing, server returns 501 with the friendly message; client shows an inline error in the chat ("Facilitator unavailable — API key not configured") and synthesis calls no-op gracefully.
- No console errors.
- `npm run typecheck` passes for both workspaces.
- `BUILD_PLANS/STATE.md` updated — plan-04 done, plan-05 next. "Known issues" notes any classifier quirks observed during testing.
- Summary includes: whether the typing indicator and loading states feel right; whether the staged-label on synthesis chat messages is clear or confusing; whether the classifier's commit-readiness judgment felt fair in manual testing (noted as a subjective check); whether the yellow → green transition timing (500ms) lands well; any observed latency that needs polish.
