# Plan 08-alt — Context Lenses in Chat (Buddy System Replacement)

**Status:** Alternative to `plan-08-right-column-restructure.md` (the vertical buddies pane). Choose one after plan-07 testing.

Read `BUILD_PLANS/context.md`, `BUILD_PLANS/STATE.md`, `BUILD_PLANS/design-patterns.md`, and `docs/ux-considerations.md` first.

**Prerequisite:** plan-07 complete. Facilitator loop should be pushing reliably; chat mode has session context; language swaps landed.

---

## The design change

**From:** three buddies (English Teacher, Historian, Reframer) always run in parallel when the first description is staged. Their responses live in a dedicated Buddy panel — three persistent cards, each with Verify + re-run. Push model.

**To:** a collapsible "Use a context lens" pane containing a button list of personas (Professor, Reframer, Feminist Historian, etc.). User clicks a button → API call fires → response lands inline in the Chat thread, clearly demarcated as a lens response. Pull model. On-demand, user-initiated, one at a time.

**Why:** the current buddy panel is obstructing the core mechanic. Parallel cards are hard to read, personas blur together in practice, and the push model spends API calls the reader didn't ask for. The real goal — *"let the reader pull in a different lens when they're stuck"* — is what matters. The current UI is in the way.

**What stays the same:**
- The personas themselves (English Teacher, Historian, Reframer voices) — same system prompts, just reframed as "lenses" instead of "buddies."
- Session-scoped chat thread.
- Verify affordance (though it moves).

**What changes:**
- Layout: Sessions | Reading | In Your Own Words | Chat (+ collapsible Lens pane). Four panes not five.
- No more persistent buddy cards.
- No more Mode A / Mode B logic — all lens responses are direct expert reads.
- No persistence of lens responses (ephemeral tools, not artifacts — per user decision).
- New demarcation pattern: lens responses render with a persona header + "If I were [persona], I'd say…" opening phrase.

---

## Why this is the right move now (and the argument against it)

### For

- **Pull model matches how the feature actually gets used.** In the claude.ai role-play tests, lens shifts worked when the reader asked for them. The current push model forces them regardless.
- **One chat thread is a cleaner cognitive model.** Everything about the passage lives in one conversation, framed by the coach.
- **Removes the Mode A/B leak problem from plan-07.** No Mode A/B logic = nothing to leak.
- **Scales to 8 personas without UI explosion.** Button list handles what a card panel can't.
- **Eliminates the need for plan-08 (vertical pane restructure).** This IS plan-08, done differently and cheaper.
- **Reduces API spend.** Reader only pays for lenses they ask for. Currently 3 parallel calls fire on every first bubble staged.

### Against (honest)

- **Loses side-by-side triangulation.** Reading three takes simultaneously is a different cognitive move from reading them sequentially. But: this was already failing in the current UI — if the ideal isn't achievable, pragmatic wins.
- **Loses the "discovery surface" of seeing all three at once.** Reader might not know to ask for the Historian's take unless they can see that option exists. Mitigation: keep the lens pane visible (even if collapsed), showing the full list on expand.
- **Lens responses inline in chat need strong visual demarcation** so they don't blur with Facilitator messages. This is design work that needs to land well.

---

## Data model changes

### `shared/types.ts`

**Remove:**
```ts
// The entire BuddyResponse type — no longer needed.
```

**Update `Highlight`:**
```ts
export type Highlight = {
  id: string
  sessionId: string
  ranges: HighlightRange[]
  text: string
  bubbles: Bubble[]
  // buddyResponses: BuddyResponse[]   ← REMOVE
  commitReady: boolean
  createdAt: string
}
```

**Add `Persona` type:**
```ts
export type Persona = {
  id: string
  name: string          // "The Professor", "The Reframer", "The Feminist Historian"
  subtitle: string      // short descriptor under the name in the button
  buttonLabel: string   // "say it again but different — the professor"
}
```

**Add `ChatMessage` kind:**
```ts
export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  kind?: 'chat' | 'synthesis' | 'lens'   // 'lens' is new
  personaId?: string   // only present on 'lens' messages
  personaName?: string // for display without server lookup
}
```

**New request/response types:**
```ts
export type LensRequest = {
  personaId: string
  highlight: string
  descriptions: string[]   // reader's current bubbles' text
  session?: { title: string; author: string; section: string }
  chatHistory: ChatMessage[]
}

export type LensResponse = {
  text: string
  personaName: string
}

export type PersonasResponse = {
  personas: Persona[]
}
```

**Update `ConsultRequest` / `ConsultResponse`:** removed entirely. Same for `/api/verify` — it's still useful but lands on chat messages, not buddy responses. See below.

---

## Server changes

### Rename + rewrite: `server/src/lib/buddies.ts` → `server/src/lib/personas.ts`

The three existing personas (English Teacher, Historian, Reframer) move over with minimal change. Key differences:

1. **Drop the `MODE_LOGIC` block entirely.** No more A/B decision.
2. **The system prompt now opens with a framing phrase requirement:** every response begins "If I were [persona name] looking at this, I'd say…" or a close variant. This is the visual demarcation cue and it comes from the model, not the UI wrapper.
3. **Voice/style guidance preserved** — craft-focused for Teacher, period-aware for Historian, visual-technique for Reframer.
4. **Add 2-3 new personas as stubs** to prove the scaling story. Suggest: "The Feminist Historian," "The Political Theorist," "The Playwright." Keep the system prompts short and pointed.

New `BASE_CONSTRAINTS`:
```ts
const BASE_CONSTRAINTS = `Output format:
- Open with a framing phrase: "If I were [your persona name] looking at this, I'd say…" or similar. This is how the reader knows whose lens they're getting.
- 2-3 sentences after the framing phrase. Hard cap.
- A real take, not a summary. Expert register, plain English.
- Owned opinion, clearly yours. Never hedge with "one could argue" — you have a view.
- Never address the reader as "you."
- Speak from your lens. Don't try to sound balanced or neutral — the reader came to you for YOUR angle.`
```

### Delete: `server/src/routes/consult.ts`

Gone. `/api/consult` and `/api/buddies` no longer exist.

### New: `server/src/routes/lens.ts`

```ts
// POST /api/lens
// Body: LensRequest
// Returns: LensResponse

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

  // Build a single user message with the passage + descriptions + light chat context
  // for recency awareness. We don't want the lens to repeat something the coach just said.
  const descriptionBlock = descriptions && descriptions.length > 0
    ? `\n\nThe reader's current descriptions:\n${descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`
    : ''

  // Only pass the last 4 chat turns as context — enough for recency, not overwhelming.
  const recentChat = (chatHistory ?? []).slice(-4)
  const chatBlock = recentChat.length > 0
    ? `\n\nRecent conversation (for context — don't repeat what's been said):\n${recentChat.map((m) => `[${m.role}] ${m.content}`).join('\n')}`
    : ''

  const userMessage = `Passage:\n"${highlight}"${descriptionBlock}${chatBlock}\n\nRespond per your system prompt. Remember to open with your framing phrase.`

  const result = await callClaude({
    system,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens: 250,
  })

  if (result.kind === 'no-key') return res.status(501).json({ error: result.message })
  if (result.kind === 'error') return res.status(500).json({ error: result.message })

  const body: LensResponse = { text: result.text, personaName: persona.name }
  res.json(body)
})
```

### New: `GET /api/personas` (or keep the existing `/api/buddies` renamed)

Returns the public roster: `{ personas: [{ id, name, subtitle, buttonLabel }] }`. Client fetches once on load to populate the button list.

### Keep: `server/src/routes/verify.ts`

Still works — takes `originalResponse` text, returns a re-check. Pointed at chat messages instead of buddy cards. No change to the route itself; just the UI that triggers it.

### Update: `server/src/index.ts`

Remove `consultRoute`, add `lensRoute` and `personasRoute`.

---

## Client changes

### Delete: `BuddyPanel.tsx`

All of it. `BuddyCard`, `NotYetState`, `LoadingSkeleton`, Verify button, re-run, Minus delete. Gone.

### New: `LensPane.tsx`

Collapsible pane with persona buttons. Mirrors the `InYourOwnWordsPane` collapse vocabulary (60px collapsed strip with chevron, expanded with content).

**Location:** sits in the right column above or below the chat. Needs a design decision — see "Layout" below.

**Shape:**
```tsx
type LensPaneProps = {
  personas: Persona[]
  activeHighlightId: string | null
  onInvokeLens: (personaId: string) => void
  loading: boolean   // true while any lens call is in flight
  expanded: boolean
  onToggleExpanded: () => void
}

export function LensPane(props: LensPaneProps) {
  // ... collapsed chevron strip / expanded content per the usual pattern

  // Content when expanded:
  // - Title: "Use a context lens"
  // - Subtitle (small): "Get this passage through a different expert's eye"
  // - Button list: one button per persona, shows name + subtitle + "say it again but different"
  // - Disabled if no active highlight (no passage to lens on)
}
```

Each persona button: one click fires `onInvokeLens(personaId)`. The button itself shows loading state briefly (spinner) while its call is in flight. Pane-level loading is used to suppress concurrent clicks.

**Layout within the button:**
```
[ The Professor ]
  Craft, form, figurative language.
  → say it again but different
```

Where the chevron/arrow is the affordance that this is a "call" action.

### Update: `FacilitatorChat.tsx`

Add support for `kind: 'lens'` messages. Visual demarcation:

- **Persona header** above the message body: the persona's name in a small caps label, slightly tinted.
- **Left-border accent** on the message bubble in a distinct colour (maybe `--color-accent-subtle`) to visually separate from Facilitator messages.
- **Verify button** on hover/focus for lens messages (re-uses existing Verify flow).
- **No "Staged:" or "[staged: '...']" prefix** — that's synthesis-mode only.

Message render pseudocode:
```tsx
if (message.kind === 'lens') {
  return (
    <div className="border-l-accent-strong border-l-2 pl-3 my-3">
      <p className="text-text-tertiary text-xs uppercase tracking-wider mb-1">
        {message.personaName} — a different lens
      </p>
      <p className="text-text-primary text-sm leading-relaxed">{message.content}</p>
      {/* Verify button on hover */}
    </div>
  )
}
```

The "If I were…" framing comes from the model (we told it to open that way), so the reader reads:

> **THE PROFESSOR — A DIFFERENT LENS**
> If I were The Professor looking at this, I'd say the passage uses free indirect discourse to…

Double demarcation (header + model framing) might feel redundant. Worth testing both — if the header is enough, drop the "If I were" requirement. If the framing phrase is enough, drop the header. Start with both, cut one after testing.

### Update: `PrototypeSlide.tsx`

**Remove:**
- `consultingHighlights` state and all related logic.
- `sendConsult`, `reRunBuddy`, `verifyBuddyResponse` (in its current card-targeted form), `deleteBuddyResponse`.
- `addBubble`'s "first bubble fires consult" side effect.
- The `BuddyPanel` import and usage in the layout.
- Load `/api/buddies` on mount — replaced with `/api/personas`.

**Add:**
- `personas: Persona[]` state, loaded from `/api/personas` on mount.
- `lensLoading: boolean` state.
- `lensPaneExpanded: boolean` state (persist to localStorage if you want).
- `invokeLens(personaId: string)` handler:

```tsx
async function invokeLens(personaId: string) {
  const activeHighlight = highlights.find((h) => h.id === activeHighlightId)
  if (!activeHighlight) return

  setLensLoading(true)
  try {
    const body: LensRequest = {
      personaId,
      highlight: activeHighlight.text,
      descriptions: activeHighlight.bubbles.map((b) => b.text),
      session: activeSession
        ? { title: activeSession.title, author: activeSession.author, section: activeSession.section }
        : undefined,
      chatHistory: chatHistoryRef.current,
    }
    const res = await fetch('/api/lens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const errMsg = res.status === 501
        ? 'Lens unavailable — API key not configured.'
        : 'Lens call failed.'
      setChatHistory((prev) => [...prev, { role: 'assistant', content: errMsg, kind: 'chat' }])
      return
    }
    const data = (await res.json()) as LensResponse
    setChatHistory((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: data.text,
        kind: 'lens',
        personaId,
        personaName: data.personaName,
      },
    ])
  } catch {
    setChatHistory((prev) => [...prev, { role: 'assistant', content: 'Something went wrong.', kind: 'chat' }])
  } finally {
    setLensLoading(false)
  }
}
```

- `verifyChatMessage(messageIndex: number)` handler — targets chat messages, not highlight buddy responses. Calls `/api/verify` with the message's text. Appends verification inline or replaces on the message.

**Verify on chat messages — implementation note:**

Previously Verify was on persistent buddy cards. Now it's on ephemeral chat messages. Options:
- (a) Append the verification as a new chat message below the lens response, framed as "Verified:".
- (b) Mutate the lens message in place to show an inline verification block.

Go with (a). Simpler, matches chat-thread semantics, doesn't break the "chat history is session-scoped, ephemeral" model.

### Layout

The right column layout becomes:

```
┌─ SESSIONS ─┬─ READING ─┬─ IN YOUR OWN WORDS ─┬─ CHAT + LENS ─┐
│            │           │                     │                │
│            │           │                     │  Chat (main)   │
│            │           │                     │                │
│            │           │                     │  [ collapsible │
│            │           │                     │   Lens pane ]  │
└────────────┴───────────┴─────────────────────┴────────────────┘
```

The Lens pane is a collapsible section WITHIN the right column, below the chat. Collapsed by default (60px strip with chevron + "Context lens" label), expands on click to show the persona list.

Alternative: put the Lens pane as a thin strip ABOVE the chat input (like a persistent button row). Simpler, always visible.

**Recommend:** collapsible below chat. Keeps the chat the visual focus, lens is a utility.

Width of the right column can drop from 360px to 320px since we're no longer cramming two panels into it.

### Facilitator can nudge toward the lens pane

Update the synthesis system prompt (from plan-07) with an additional move in the library:

```
- "If you're stuck finding the next angle, try a context lens — there's a list below the chat."
```

Only fires when the Facilitator judges the reader is genuinely stuck (repeated vague descriptions, explicit "I don't know where to go" messages). Doesn't fire gratuitously.

---

## Files to create

```
server/src/lib/personas.ts                            ← Renamed from buddies.ts. MODE_LOGIC removed, framing phrase requirement added, 2-3 new persona stubs.
server/src/routes/lens.ts                             ← NEW — POST /api/lens
server/src/routes/personas.ts                         ← NEW — GET /api/personas (roster)
client/src/components/prototype/LensPane.tsx         ← NEW — collapsible pane with persona button list
```

## Files to modify

```
shared/types.ts                                        ← Drop BuddyResponse, Highlight.buddyResponses, ConsultRequest/Response. Add Persona, LensRequest, LensResponse, PersonasResponse. Update ChatMessage kind union.
server/src/index.ts                                    ← Remove consultRoute, add lensRoute + personasRoute
server/src/routes/facilitator.ts                       ← Add the "try a lens" move to the synthesis system prompt library
client/src/components/slides/PrototypeSlide.tsx        ← Remove all buddy logic, add persona/lens state and handlers, swap BuddyPanel for LensPane in layout
client/src/components/prototype/FacilitatorChat.tsx   ← Render kind:'lens' messages distinctly (persona header + left border), move Verify here
client/src/lib/persistence.ts                         ← Still sanitises but buddyResponses is gone from the type so just drop that mapping
server/src/lib/storage.ts                             ← No change needed — it just stores what the client sends
```

## Files to delete

```
client/src/components/prototype/BuddyPanel.tsx        ← Gone
server/src/routes/consult.ts                          ← Gone
server/src/routes/buddies.ts                          ← Gone (if it exists as a separate route — might already be in consult.ts)
```

---

## Constraints

- **No persistence of lens responses.** They're ephemeral chat messages. Cleared on session switch along with the rest of the chat history.
- **Personas are server-defined, hardcoded.** Same pattern as before. "Build your own persona" is a v2 idea for the deck.
- **One lens at a time.** No parallel fan-out. If the reader wants two lenses, they click two buttons.
- **Facilitator remains the coach.** Lens responses are additive context, not replacements for the synthesis loop. The facilitator still gates the commit.
- **Verify still works** but targets chat messages, not buddy cards. Appends a new "Verified:" message to the thread.
- **Don't start the dev server.** Lucy verifies visually.

---

## Out of scope

- "Build your own persona" UI.
- Lens responses persisting to the highlight (explicit user decision — they're ephemeral tools).
- Auto-suggesting a lens based on content of the description (could be a v2 magic moment).
- Multi-lens combo calls ("ask Professor AND Historian about this").
- Lens response editing or pinning.

---

## Definition of done

- `shared/types.ts` updated: `BuddyResponse` and `ConsultRequest/Response` removed; `Persona`, `LensRequest/Response`, `PersonasResponse` added; `ChatMessage.kind` includes `'lens'`.
- `server/src/lib/personas.ts` exists with the three existing personas (reframed, no MODE_LOGIC) plus 2-3 new stubs.
- `POST /api/lens` and `GET /api/personas` endpoints working.
- `/api/consult` and `/api/buddies` routes removed.
- `BuddyPanel.tsx` deleted. `LensPane.tsx` created — collapsible, shows persona button list, triggers lens calls.
- `FacilitatorChat.tsx` renders `kind: 'lens'` messages with persona header + left-border accent.
- Verify button works on lens messages — appends a new "Verified:" message to the thread.
- `PrototypeSlide.tsx`: all buddy state/handlers removed; persona/lens state/handlers added; layout updated to place `LensPane` beside/below chat.
- Facilitator synthesis prompt gets the "try a context lens" move added to the library.
- `highlights.json` persistence still works — now without `buddyResponses` (any existing data with that field hydrates fine, just ignored).
- Manual test: stage a description, click a lens button. Response lands in chat with persona header. Framing phrase present.
- Manual test: click two lenses in a row. Both land as separate chat messages, each with its own persona header.
- Manual test: click lens with no active highlight — button is disabled or shows helpful state.
- Manual test: verify a lens message. Verification lands below as a new chat message.
- Manual test: switch session. Chat clears including any lens messages. Highlights stay.
- `npm run typecheck` passes both workspaces.
- `BUILD_PLANS/STATE.md` updated — buddy system replaced with lens system.
- `BUILD_PLANS/TEST_LIST.md` updated: remove items that no longer apply (buddy distinctiveness, Mode A/B, buddy 250ms stagger, panel state flow); add new items (lens demarcation clarity, framing phrase consistency, persona button discoverability, lens pane collapse behaviour, verify-as-chat-message feel).
- Summary includes: whether the lens-in-chat flow feels natural, whether persona headers + framing phrase together read as redundant or reinforcing, whether the collapsible lens pane feels discoverable enough, whether losing persistence feels like a loss, and whether the chat thread becomes the clear centre of gravity it's meant to be.

---

## After this plan lands

- `plan-08-right-column-restructure.md` (original) is obsolete. Move it to `BUILD_PLANS/archive/`.
- Plan 09 (IYOW fixes) and Plan 10 (small UX polish) proceed as planned.
- Day 3 pitch prep — the story gets sharper. "Reader drives. When they need a lens, they pull one in. The coach is always there; the experts come when called."
