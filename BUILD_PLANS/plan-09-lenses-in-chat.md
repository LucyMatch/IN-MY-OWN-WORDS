# Plan 09 — Lenses in Chat (Buddy System Replacement)

Read `BUILD_PLANS/context.md`, `BUILD_PLANS/STATE.md`, `BUILD_PLANS/design-patterns.md`, and `docs/ux-considerations.md` first.

**Prerequisite:** plan-08 complete. Chat is now highlight-scoped (`chatHistory` lives on `Highlight`). Context bleed gone. Facilitator pushes reliably.

**Note:** an earlier draft of this plan existed as `plan-08-alt-lenses-in-chat.md`. That draft assumed session-scoped chat + collapsible-below-chat layout. This plan supersedes it. Archive the alt draft after this plan lands.

---

## The design change

**From:** three buddies (English Teacher, Historian, Reframer) run in parallel when the first description is staged. Responses live in a stacked Buddy panel — three persistent cards, each with Verify + re-run + delete. Push model. Takes half the right column, forcing the Facilitator chat into a cramped top half.

**To:** a vertical far-right pane — "Use a context lens" — containing one button per persona. Click a button → API call fires → response lands in the Facilitator chat, visually demarcated as a lens response. Pull model. On-demand, one at a time. **Chat pane gets full vertical height** because it's alone in its column now.

**Why:**
- The current buddy panel obstructs the core mechanic. Parallel cards blur the personas and steal vertical space from the chat.
- Pull model matches how lens-shifts actually get used — when the reader is stuck.
- Chat-as-single-thread is a cleaner cognitive model: everything about a passage lives in one conversation.
- Mode A/B leak problem disappears (no Mode A/B logic left).
- Scales to 6+ personas without UI explosion.

---

## Layout change

**Before plan-09 (current):**
```
┌─ SESSIONS ─┬─ READING ─┬─ IN YOUR OWN WORDS ─┬─ CHAT + BUDDIES ─┐
│            │           │                     │  Chat (top half) │
│            │           │                     │                  │
│            │           │                     │  Buddies (bot    │
│            │           │                     │   half, stacked) │
└────────────┴───────────┴─────────────────────┴──────────────────┘
```

**After plan-09:**
```
┌─ SESSIONS ─┬─ READING ─┬─ IN YOUR OWN WORDS ─┬─ CHAT ─┬─ LENS ─┐
│            │           │                     │        │        │
│            │           │                     │  Full  │ Vert.  │
│            │           │                     │  ht    │ far-   │
│            │           │                     │  chat  │ right  │
└────────────┴───────────┴─────────────────────┴────────┴────────┘
```

Chat is finally full-height. Lens is a dedicated vertical pane on the far right, collapsible with a chevron like the other panes. Width when expanded: ~280px. When collapsed: 48px (matches sessions panel collapsed width).

---

## Data model changes

### `shared/types.ts`

**Remove:**
- `BuddyResponse` type — gone.
- `Highlight.buddyResponses` field — gone.
- `ConsultRequest` / `ConsultResponse` types — gone.

**Add:**
```ts
export type Persona = {
  id: string
  name: string          // "The English Teacher"
  subtitle: string      // short descriptor, e.g. "Craft, form, figurative language"
  buttonLabel: string   // e.g. "say it again but different"
}

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
  personaId: string
}

export type PersonasResponse = {
  personas: Persona[]
}
```

**Update `ChatMessage`:**
```ts
export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  kind?: 'chat' | 'synthesis' | 'lens'   // 'lens' is new
  personaId?: string    // only present on 'lens' messages
  personaName?: string  // for display without server lookup
}
```

---

## Server changes

### Rename: `server/src/lib/buddies.ts` → `server/src/lib/personas.ts`

The three existing personas move over. Key differences:

1. **Drop `MODE_LOGIC` entirely.** No more A/B decision.
2. **Add framing-phrase requirement:** every response opens with "If I were [persona name] looking at this, I'd say…" or close variant. This is the semantic marker that reinforces the persona voice — separate from the UI visual treatment.
3. **Voice guidance preserved.**
4. **Export `Persona[]` for the roster endpoint** (public-facing shape — no system prompt).

```ts
// server/src/lib/personas.ts

export type PersonaDefinition = {
  id: string
  name: string
  subtitle: string
  buttonLabel: string
  systemPrompt: string
}

const BASE_CONSTRAINTS = `Output format:
- Open with a framing phrase: "If I were [your persona name] looking at this, I'd say…" or very close variant. This tells the reader whose lens they're getting.
- 2-3 sentences after the framing phrase. Hard cap.
- A real take, not a summary. Expert register, plain English.
- Owned opinion, clearly yours. Never hedge with "one could argue" — you have a view.
- Never address the reader as "you."
- Speak from your lens. Don't try to sound balanced or neutral — the reader came to you for YOUR angle.`

export const PERSONAS: PersonaDefinition[] = [
  {
    id: 'english-teacher',
    name: 'The English Teacher',
    subtitle: 'Craft, form, figurative language',
    buttonLabel: 'say it again but different',
    systemPrompt: `You are The English Teacher — a professional literature teacher. You think in craft.

What you bring:
- How the passage *works* as writing (structure, device, register).
- Scholarly readings the passage has supported.
- What the text is doing, not just saying.

Voice: Articulate, structured, unafraid of technical terms but explain them.

Avoid:
- Plot summary.
- Assigning "the meaning" — offer a reading, don't pronounce.

${BASE_CONSTRAINTS}`,
  },
  {
    id: 'historian',
    name: 'The Historian',
    subtitle: 'Period, biography, contemporary reception',
    buttonLabel: 'say it again but different',
    systemPrompt: `You are The Historian — a scholar of the period this work comes from. You know the author's biography, political and social context, contemporary audience.

What you bring:
- What the passage would have meant to a reader at the time.
- How the author's position sits in the intellectual currents of the period.
- Correction of modern-flattening readings.

Voice: Grounded, specific, period-aware. Avoid anachronism.

Avoid:
- Presentism.
- Biographical reductionism.
- Hallucinating references. If you're not certain a person/event existed, don't cite them.

${BASE_CONSTRAINTS}`,
  },
  {
    id: 'reframer',
    name: 'The Reframer',
    subtitle: 'Visual mediums, film, painting',
    buttonLabel: 'say it again but different',
    systemPrompt: `You are The Reframer — an expert in visual mediums (film, painting, staging, photography). You translate the *effect* of the text into a visual technique that achieves the same result.

What you bring:
- A named technique (reaction shot, held close-up, chiaroscuro, deep focus, tableau).
- A brief explanation of how that technique produces the same effect as the text.

Voice: Concrete, visual, technique-first. Avoid art-speak. Describe what the eye sees and what it means.

Avoid:
- Name-dropping without tying technique to effect.
- Visual metaphor that doesn't actually map to the passage's mechanics.

${BASE_CONSTRAINTS}`,
  },
]

/** Public-safe persona shape (no system prompts). Sent to the client. */
export function getPersonaRoster(): Array<{
  id: string
  name: string
  subtitle: string
  buttonLabel: string
}> {
  return PERSONAS.map(({ id, name, subtitle, buttonLabel }) => ({ id, name, subtitle, buttonLabel }))
}
```

Note: old `buildBuddyUserMessage` is gone — lens routing builds its own user message (see below).

### New: `server/src/routes/lens.ts`

```ts
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

  const descriptionBlock = descriptions && descriptions.length > 0
    ? `\n\nThe reader's current descriptions of the passage:\n${descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`
    : ''

  // Pass only the last 4 chat turns — recency awareness, don't overwhelm.
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

  const body: LensResponse = { text: result.text, personaName: persona.name, personaId: persona.id }
  res.json(body)
})
```

### New: `server/src/routes/personas.ts`

```ts
import { Router } from 'express'
import { getPersonaRoster } from '../lib/personas.js'
import type { PersonasResponse } from '@shared/types'

export const personasRoute = Router()

personasRoute.get('/personas', (_req, res) => {
  const body: PersonasResponse = { personas: getPersonaRoster() }
  res.json(body)
})
```

### Delete: `server/src/routes/consult.ts`

Gone. `/api/consult` and `/api/buddies` no longer exist.

### Update: `server/src/index.ts`

Remove `consultRoute`, add `lensRoute` and `personasRoute`.

---

## Client changes

### Delete: `BuddyPanel.tsx`

All of it. Entire file.

### New: `LensPane.tsx`

Vertical pane, far right of the layout. Collapsible with chevron — same collapse vocabulary as the existing panes.

**Props:**
```ts
type LensPaneProps = {
  personas: Persona[]
  hasActiveHighlight: boolean
  onInvokeLens: (personaId: string) => void
  invokingPersonaId: string | null   // which persona is currently loading (if any)
  expanded: boolean
  onToggleExpanded: () => void
}
```

**Structure (mirrors `InYourOwnWordsPane`):**
```tsx
export function LensPane({
  personas,
  hasActiveHighlight,
  onInvokeLens,
  invokingPersonaId,
  expanded,
  onToggleExpanded,
}: LensPaneProps) {
  if (!expanded) {
    return (
      <div className="border-border-soft bg-background flex w-12 flex-shrink-0 flex-col items-center border-l py-3">
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-label="Open context lens panel"
          className="text-text-tertiary hover:text-text-primary flex size-6 cursor-pointer items-center justify-center transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="border-border-soft bg-background flex w-[280px] flex-shrink-0 flex-col border-l">
      <div className="border-border-subtle flex items-center justify-between border-b px-4 pb-2 pt-4">
        <p className="text-text-tertiary text-xs uppercase tracking-widest">Use a context lens</p>
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-label="Collapse context lens panel"
          className="text-text-tertiary hover:text-text-primary flex size-6 cursor-pointer items-center justify-center transition-colors"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="scroll-area flex-1 overflow-y-auto px-3 py-3">
        {!hasActiveHighlight ? (
          <p className="text-text-tertiary px-2 py-4 text-center text-sm">
            Highlight a passage to use a lens.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {personas.map((persona) => (
              <PersonaButton
                key={persona.id}
                persona={persona}
                loading={invokingPersonaId === persona.id}
                disabled={invokingPersonaId !== null}
                onClick={() => onInvokeLens(persona.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PersonaButton({
  persona,
  loading,
  disabled,
  onClick,
}: {
  persona: Persona
  loading: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'bg-surface shadow-input flex w-full flex-col items-start gap-1 rounded-xl px-3 py-3 text-left transition-opacity',
        'hover:shadow-input-hover',
        'disabled:cursor-not-allowed disabled:opacity-50',
        !disabled && 'cursor-pointer',
      )}
    >
      <span className="text-text-primary text-sm font-medium">{persona.name}</span>
      <span className="text-text-tertiary text-xs">{persona.subtitle}</span>
      <span className="text-text-secondary mt-1 text-xs italic">
        {loading ? 'thinking…' : `→ ${persona.buttonLabel}`}
      </span>
    </button>
  )
}
```

Icons: `ChevronLeft`, `ChevronRight` from `lucide-react`.

### Update: `FacilitatorChat.tsx` — render lens messages

Lens messages get visual treatment: **italic, right-aligned, left+right accent border, persona header above.**

Add a branch in the message render:

```tsx
if (message.kind === 'lens') {
  return (
    <div key={idx} className="my-4 flex flex-col items-end">
      <p className="text-text-tertiary mb-1 text-[10px] uppercase tracking-widest">
        {message.personaName} — a different lens
      </p>
      <div
        className={cn(
          'border-accent-strong/40 bg-surface rounded-xl border-l-2 border-r-2 px-4 py-3',
          'max-w-[85%]',
        )}
      >
        <p className="text-text-primary whitespace-pre-line text-right text-sm italic leading-relaxed">
          {message.content}
        </p>
      </div>
    </div>
  )
}
```

Key classes:
- `flex flex-col items-end` — right-align the whole block.
- `border-l-2 border-r-2` — accent border on both sides.
- `border-accent-strong/40` — subtle tint.
- `text-right text-sm italic` — italics + right-aligned text within the bubble.
- Persona header in small-caps label above.

The "If I were The Historian…" framing comes from the model, not the UI wrapper. Between the persona label and the framing phrase, the reader has double confirmation of whose voice they're reading. If they feel redundant during testing, we can drop the header and keep just the framing — but start with both.

**No Verify button on lens messages.** Dropped per scope — parked as feature plan.

### Update: `PrototypeSlide.tsx`

**Remove:**
- `consultingHighlights` state and every use of it.
- `sendConsult`, `reRunBuddy`, `verifyBuddyResponse`, `deleteBuddyResponse` functions.
- The `addBubble` side-effect that fires `sendConsult` on first-bubble-staged.
- `BuddyPanel` import and usage.

**Add:**
- `personas: Persona[]` state, loaded from `/api/personas` on mount.
- `invokingPersonaId: string | null` state — tracks which persona is currently in-flight. `null` means none.
- `lensPaneExpanded: boolean` state. Default `true` (open). No persistence for now — opens fresh each session.
- Persona fetch on mount:

```tsx
useEffect(() => {
  fetch('/api/personas')
    .then((r) => r.json())
    .then((data: PersonasResponse) => setPersonas(data.personas))
    .catch((err) => console.error('[personas] load error', err))
}, [])
```

- `invokeLens(personaId: string)` handler:

```tsx
async function invokeLens(personaId: string) {
  if (!activeHighlightId) return
  const activeHighlight = highlights.find((h) => h.id === activeHighlightId)
  if (!activeHighlight) return

  const highlightId = activeHighlight.id  // capture for safe mid-call highlight switch
  const persona = personas.find((p) => p.id === personaId)
  if (!persona) return

  setInvokingPersonaId(personaId)

  try {
    const body: LensRequest = {
      personaId,
      highlight: activeHighlight.text,
      descriptions: activeHighlight.bubbles.map((b) => b.text),
      session: activeSession
        ? { title: activeSession.title, author: activeSession.author, section: activeSession.section }
        : undefined,
      chatHistory: activeHighlight.chatHistory,
    }

    const res = await fetch('/api/lens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errMsg = res.status === 501
        ? 'Lens unavailable — API key not configured.'
        : 'Lens call failed. Please try again.'
      // Append error to the specific highlight's chat
      setHighlights((prev) =>
        prev.map((h) =>
          h.id === highlightId
            ? { ...h, chatHistory: [...h.chatHistory, { role: 'assistant', content: errMsg, kind: 'chat' }] }
            : h,
        ),
      )
      return
    }

    const data = (await res.json()) as LensResponse
    const lensMessage: ChatMessage = {
      role: 'assistant',
      content: data.text,
      kind: 'lens',
      personaId: data.personaId,
      personaName: data.personaName,
    }

    setHighlights((prev) =>
      prev.map((h) =>
        h.id === highlightId
          ? { ...h, chatHistory: [...h.chatHistory, lensMessage] }
          : h,
      ),
    )
  } catch {
    setHighlights((prev) =>
      prev.map((h) =>
        h.id === highlightId
          ? { ...h, chatHistory: [...h.chatHistory, { role: 'assistant', content: 'Something went wrong.', kind: 'chat' }] }
          : h,
      ),
    )
  } finally {
    setInvokingPersonaId(null)
  }
}
```

The same mid-call-safety pattern as plan-08: capture `highlightId` at call time, target that specific highlight's chat on return. Reader can switch highlights mid-call; lens response lands on the correct highlight.

**Layout update:**

```tsx
return (
  <div className="flex h-full overflow-hidden">
    <SessionsPanel {...} />
    <ReadingPane {...} />
    <InYourOwnWordsPane {...} />
    <div className="flex min-w-0 flex-1 flex-col">
      <FacilitatorChat
        messages={activeChatHistory}
        loading={facilitatorLoading}
        onSend={sendChatMessage}
        hasActiveHighlight={activeHighlightId !== null}
      />
    </div>
    <LensPane
      personas={personas}
      hasActiveHighlight={activeHighlightId !== null}
      onInvokeLens={invokeLens}
      invokingPersonaId={invokingPersonaId}
      expanded={lensPaneExpanded}
      onToggleExpanded={() => setLensPaneExpanded((v) => !v)}
    />
  </div>
)
```

Chat wrapper is now `flex-1` with no fixed width — it takes whatever space is left between `InYourOwnWordsPane` and `LensPane`. `min-w-0` prevents flex children from forcing overflow.

### Update: `client/src/lib/persistence.ts`

Drop the `buddyResponses` field handling — no longer exists on `Highlight`. The sanitize function now just strips `commitReady`:

```ts
function sanitizeForSave(highlights: Highlight[]): Highlight[] {
  return highlights.map((h) => ({
    ...h,
    commitReady: false,
  }))
}
```

On load, `buddyResponses` from old `highlights.json` files is simply ignored — TypeScript will drop it when casting to the new shape. If you want to be explicit about stripping it during hydration:

```ts
return data.map((h: any) => {
  const { buddyResponses, ...rest } = h  // drop old field if present
  return {
    ...rest,
    commitReady: false,
    chatHistory: rest.chatHistory ?? [],
  }
})
```

Defensive cleanup. One extra line, no risk.

### Update: `server/src/routes/facilitator.ts` — add lens nudge

Add to the `SYNTHESIS_SYSTEM_PROMPT` move library:

```
- "If you're stuck finding the next angle, try a context lens — there's a list to the right of the chat. Pick one."
```

Only fires when reader is genuinely stuck (repeated vague descriptions, explicit "I don't know what to say next" messages). Don't nudge gratuitously.

---

## Files to create

```
server/src/lib/personas.ts                              ← Renamed from buddies.ts. MODE_LOGIC removed, framing phrase requirement added, Persona type exposed.
server/src/routes/lens.ts                               ← NEW — POST /api/lens
server/src/routes/personas.ts                           ← NEW — GET /api/personas (roster)
client/src/components/prototype/LensPane.tsx           ← NEW — vertical far-right pane with persona buttons
```

## Files to modify

```
shared/types.ts                                         ← Drop BuddyResponse, Highlight.buddyResponses, ConsultRequest/Response. Add Persona, LensRequest, LensResponse, PersonasResponse. ChatMessage.kind += 'lens', + personaId/personaName fields.
server/src/index.ts                                     ← Remove consultRoute, add lensRoute + personasRoute.
server/src/routes/facilitator.ts                        ← Add the "try a lens" move to synthesis system prompt library.
client/src/components/slides/PrototypeSlide.tsx         ← Remove all buddy logic. Add personas/invokingPersonaId/lensPaneExpanded state. Add invokeLens handler. Layout: chat is flex-1, LensPane is right-most.
client/src/components/prototype/FacilitatorChat.tsx     ← Render kind:'lens' messages: italic + right-aligned + persona header + left/right accent border.
client/src/lib/persistence.ts                           ← Drop buddyResponses handling. Optionally strip stale field during hydration.
```

## Files to delete

```
client/src/components/prototype/BuddyPanel.tsx          ← Gone.
server/src/routes/consult.ts                            ← Gone.
server/src/lib/buddies.ts                               ← Renamed to personas.ts (so deleted by move).
```

## Files to archive

```
BUILD_PLANS/plan-08-alt-lenses-in-chat.md               ← Superseded by this plan. Move to BUILD_PLANS/archive/.
```

---

## Constraints

- **No persistence of lens responses** in the sense of a dedicated store — but because they land in a highlight's `chatHistory` (which plan-08 persists), they DO survive reloads as chat messages. That's a happy accident of plan-08's design. Treat them as chat, not as artifacts.
- **Personas are server-defined, hardcoded.** Three personas for now — English Teacher, Historian, Reframer. "Build your own persona" is deck material.
- **One lens at a time.** No parallel fan-out. `invokingPersonaId` flag gates concurrent clicks.
- **Facilitator remains the coach.** Lens responses are additive context, not replacements for the synthesis loop.
- **No Verify button on lens messages.** Parked as feature plan.
- **Chat pane goes full-height** — THE visual unlock of this plan. Don't compromise.
- **LensPane default state: expanded.** Chevron collapses it. No localStorage persistence for now.
- **Match `BUILD_PLANS/design-patterns.md`.**
- **Don't start the dev server.** Lucy verifies visually.

---

## Out of scope

- "Build your own persona" UI.
- Auto-suggesting a lens based on description content.
- Multi-lens combo calls.
- Lens response editing or pinning.
- Verify button on lens messages (future feature plan).
- LensPane expand/collapse persisted to localStorage (future polish).
- Auto-open logic for LensPane ("open automatically when user is stuck") — you mentioned wanting this later; parked.

---

## Definition of done

- `shared/types.ts` updated: `BuddyResponse` and `ConsultRequest/Response` removed; `Persona`, `LensRequest/Response`, `PersonasResponse` added; `ChatMessage.kind` includes `'lens'`; `personaId`/`personaName` fields added.
- `server/src/lib/personas.ts` exists with the three personas (no MODE_LOGIC), framing-phrase requirement in BASE_CONSTRAINTS, `getPersonaRoster` helper exported.
- `POST /api/lens` and `GET /api/personas` endpoints working.
- `/api/consult` route removed. `server/src/lib/buddies.ts` deleted (or moved to personas.ts).
- `BuddyPanel.tsx` deleted. `LensPane.tsx` created as vertical far-right pane, collapsible with chevron, default expanded.
- `FacilitatorChat.tsx` renders `kind: 'lens'` messages with italic text, right-aligned, left+right accent border, persona header above.
- `PrototypeSlide.tsx`: all buddy state/handlers removed. Personas/lens state/handlers added. Layout: sessions | reading | IYOW | chat (flex-1, full height) | lens pane.
- Facilitator synthesis prompt has the "try a context lens" move added.
- `highlights.json` persistence still works — old saves with `buddyResponses` hydrate cleanly (field dropped).
- Manual test: stage a description, click a persona button. Response lands in chat, right-aligned + italic + persona header + framing phrase. Chat auto-scrolls if at bottom.
- Manual test: click a persona button with no highlight active. Pane shows "Highlight a passage to use a lens." instead of buttons.
- Manual test: click two personas sequentially. Second button disabled during first call. Both responses land in chat as separate lens messages.
- Manual test: switch highlight mid-call. Response lands on the original highlight's chat, not the new active one (mid-call safety).
- Manual test: reload the app. Lens messages persist in the highlight's chat (they're chat messages, so plan-08's persistence carries them).
- Manual test: collapse the lens pane via chevron. Width collapses to 48px, chat expands to fill. Expand via chevron, pane returns to 280px.
- Manual test: delete a highlight. Its chat (including any lens messages) goes with it.
- Manual test: facilitator occasionally nudges toward lens when reader is clearly stuck (repeated vague descriptions).
- `npm run typecheck` passes both workspaces.
- `BUILD_PLANS/STATE.md` updated — plan-09 done, buddy system fully replaced.
- `BUILD_PLANS/plan-08-alt-lenses-in-chat.md` moved to `BUILD_PLANS/archive/`.
- `BUILD_PLANS/TEST_LIST.md` updated:
  - REMOVE: buddy distinctiveness, Mode A/B decisions, 250ms stagger, panel state flow, Verify output, re-run variation, delete buddy response, buddy-related Error state.
  - ADD: "Lens demarcation clarity" — does the italic + right-align + header read as distinct from facilitator responses, or do they blur? If blur, drop the header and rely on italics/align alone, or vice versa.
  - ADD: "Framing phrase consistency" — do lens responses reliably open with "If I were [persona]…"? If the model drops the phrase, tighten the system prompt.
  - ADD: "Persona button discoverability" — is the vertical pane noticed? Does the default-expanded state help or feel intrusive? Test by asking a fresh viewer to try a lens.
  - ADD: "Chat full-height feel" — the payoff. Does the chat finally breathe?
- Summary includes: whether the refactor landed cleanly, whether the italic+right-aligned+header+framing-phrase combo is clear or redundant, whether the vertical pane feels right on the far right, whether full-height chat delivers the expected payoff, and whether any old-shape `highlights.json` data caused hydration issues.
