# Plan 05 — Buddies Wire-Up

Read `BUILD_PLANS/context.md`, `BUILD_PLANS/STATE.md`, and `BUILD_PLANS/design-patterns.md` first. Also read `docs/ai-design.md` for the Buddy personas — the plan references specific persona fields.

**Prerequisite:** plan-04 is done. Facilitator chat is wired end-to-end, commit flow works, `commitReady` is implemented as a per-highlight transient field.

---

## What this builds

Three buddies (English Teacher, Historian, Reframer) produce parallel expert readings of the user's highlight + staged bubbles. Triggered when the user stages their first bubble. Each buddy independently decides Mode A (pure expert reading) or Mode B (gap critique + expert reading). Responses stream in as each call returns. Each response has a Verify button that fans out a self-check call and appends a verification note below the original.

After this plan:

- **Buddy personas** (English Teacher, Historian, Reframer) replace the "Buddy One/Two/Three" placeholder prompts in `server/src/lib/buddies.ts`. System prompts encode Mode A / Mode B decision logic per buddy.
- **Trigger point:** first bubble staged on a highlight → `/api/consult` fires with highlight text + all current staged bubbles. Subsequent bubbles on the same highlight do NOT re-fetch buddies.
- **`BuddyPanel` becomes a real component** with three stacked cards. Each card shows: buddy name, description, response text (or loading skeleton, or error), Verify button, and a "re-run" `+` icon.
- **Streaming in** — as each buddy's API call returns, its card transitions from loading to filled. Not true HTTP streaming; sequential `setState` calls as each promise resolves.
- **Verify** appends a verification block below the response (does NOT replace). Clearly styled as a verification, not a new buddy response.
- **Re-run per buddy** — the `+` icon on a buddy card fires a fresh call for that one buddy. Appends a new response below the existing one (does NOT replace).
- **Add a buddy** — a pane-level `+` at the bottom of the Buddies panel. Unhooked. Placeholder for future "build your own buddy" expansion. Disabled with a tooltip like "Coming soon."
- **Persistence** — buddy responses live on the `Highlight` object (already in the type). When a highlight is re-activated, its stored buddy responses render without a fresh call.

**What this plan does NOT do:**

- No persistence to disk (plan-06).
- No actual "add a buddy" flow — button is a visual placeholder.
- No buddy-to-buddy chat or cross-buddy synthesis.
- No filtering or muting buddies mid-session.

---

## Code patterns

Read `BUILD_PLANS/design-patterns.md`. Patterns that apply:

- Canonical component shape for every new component.
- `cn()` on every className.
- Raw `<button>` for card-internal actions (Verify, re-run). `Button` primitive for the pane-level "add a buddy" (standalone pill-shaped action).
- Data-attributes for state: `data-loading`, `data-error`, `data-verifying` on buddy cards.

---

## Server changes

### Rewrite the buddy personas in `server/src/lib/buddies.ts`

The current personas are placeholders. Replace with the three personas from `docs/ai-design.md`. Each system prompt includes the Mode A / Mode B decision logic.

Full replacement for `BUDDIES`:

```ts
const BASE_CONSTRAINTS = `Output format:
- 2-4 sentences total. Hard cap.
- A real take, not a summary. Expert register, plain English.
- Owned opinion, clearly yours. Never hedge with "one could argue" or "some might say" — you have a view.
- Never address the reader directly as "you." Write as if putting your reading on the page for other experts.`

const MODE_LOGIC = `Decision — Mode A vs Mode B:

You receive the passage AND the reader's staged bubbles (their attempts at articulating the passage in their own words).

- If the reader's bubbles capture the real thing the passage is doing, write Mode A: your expert reading of the passage. Ignore their articulation — it's tight, no work to do on it.
- If the reader's bubbles have a genuine gap (missing the real move, flattening two moves into one, over-generalising, presentism, etc.), write Mode B: one sentence naming the gap in plain terms, then your expert reading of the passage.

Mode B critique names the gap GENERALLY. Do not re-translate the reader's understanding through your specific lens — that's off-target. Just name what they missed, then offer your own reading.

Failure mode to avoid: manufacturing a critique to have something to say. If the reader is tight, Mode A is the honest move. Mode B only when there is real work.`

export const BUDDIES: Buddy[] = [
  {
    id: 'english-teacher',
    name: 'The English Teacher',
    description: 'Professional literature teacher. Craft, form, figurative language.',
    systemPrompt: `You are The English Teacher — a professional literature teacher reading alongside the user. You teach the text, not just interpret it.

What you bring:
- How the passage *works* as writing (structure, device, register).
- Scholarly readings the passage has supported.
- What the text is doing, not just saying.

Voice: Articulate, structured, unafraid of technical terms but you explain them. You think in craft.

Avoid:
- Plot summary.
- Assigning "the meaning" — offer a reading, don't pronounce.
- Treating the passage as a specimen rather than living writing.

${MODE_LOGIC}

${BASE_CONSTRAINTS}`,
  },
  {
    id: 'historian',
    name: 'The Historian',
    description: 'Expert in the period. Author biography, contemporary reception, social context.',
    systemPrompt: `You are The Historian — a scholar of the period this work comes from. You know the author's biography, the political and social context, the contemporary audience, the debates the text entered.

What you bring:
- What the passage would have meant to a reader at the time.
- How the author's position sits in the intellectual currents of the period.
- Correction of modern-flattening readings ("this is a 21st-century frame, but in 1813…").

Voice: Grounded, specific, period-aware. Avoid anachronism. Name actual contemporaries, debates, conventions where useful.

Avoid:
- Presentism — reading the passage through modern politics.
- Biographical reductionism ("Austen wrote this because she was unmarried" etc.).
- Pure history with no tie back to the passage itself.
- Hallucinating references. If you're not certain a person/event existed, don't cite them.

${MODE_LOGIC}

${BASE_CONSTRAINTS}`,
  },
  {
    id: 'reframer',
    name: 'The Reframer',
    description: 'Expert in visual mediums. Translates textual effect into visual technique.',
    systemPrompt: `You are The Reframer — an expert in visual mediums (film, painting, staging, photography). You translate the *effect* of the text into a visual technique that achieves the same result.

What you bring:
- A named technique (reaction shot, held close-up, chiaroscuro, deep focus, tableau, etc.).
- A brief explanation of how that technique produces the same effect as the text.
- Concrete references (directors, painters, traditions) only when they earn their place.

Voice: Concrete, visual, technique-first. Avoid art-speak. Describe what the eye sees and what it means.

Avoid:
- Name-dropping directors without tying technique to effect.
- Visual metaphor that doesn't actually map to the passage's mechanics.
- Losing the text in the translation — the medium-shift should illuminate, not replace.

${MODE_LOGIC}

${BASE_CONSTRAINTS}`,
  },
]
```

### Update `buildBuddyUserMessage` to accept multiple bubbles

The current signature takes `articulation: string | null`. Update to take an array:

```ts
export function buildBuddyUserMessage(highlight: string, bubbles: string[]): string {
  if (bubbles.length === 0) {
    return `Passage:\n"${highlight}"\n\nThe reader has not yet articulated their own understanding. Respond to the passage directly in Mode A.`
  }

  const bubbleList = bubbles.map((b, i) => `${i + 1}. ${b}`).join('\n')
  return `Passage:\n"${highlight}"\n\nThe reader's staged bubbles (attempts at articulating the passage in their own words):\n${bubbleList}\n\nDecide Mode A or Mode B per your system prompt, then respond.`
}
```

### Update `ConsultRequest` / `ConsultResponse` types

`shared/types.ts`:

```ts
export type ConsultRequest = {
  highlight: string
  bubbles: string[]          // was: articulation: string | null
}

// ConsultResponse unchanged — still returns { responses: BuddyResponse[] }
```

### Update `/api/consult` route

In `server/src/routes/consult.ts`, swap `articulation ?? null` for `bubbles ?? []`, and pass to `buildBuddyUserMessage` as an array.

```ts
const { highlight, bubbles } = (req.body ?? {}) as Partial<ConsultRequest>

if (!highlight || typeof highlight !== 'string') {
  return res.status(400).json({ error: 'Missing required field: highlight (string).' })
}

const bubbleTexts = Array.isArray(bubbles) ? bubbles : []
const userMessage = buildBuddyUserMessage(highlight, bubbleTexts)
```

Rest of the route unchanged.

### `/api/verify` route — already in place, no changes needed

`/api/verify` already accepts `{highlight, originalResponse, buddyId}` and returns `{text}`. Plan-05 just wires the client to it.

---

## Client-side data model changes

### Update `BuddyResponse` type (in `shared/types.ts`)

Current shape is minimal. Extend to support verifications and multiple runs per buddy:

```ts
export type BuddyResponse = {
  /** Unique id for this individual response (not the buddy). Multiple responses from same buddy have different ids. */
  id: string
  buddyId: string
  buddyName?: string
  text?: string
  error?: string
  /** One-off verification text. If present, renders below the response. */
  verification?: string
  /** Transient — true while the verify call is in flight. */
  verifying?: boolean
  createdAt: string
}
```

Existing `verified?: boolean` is dropped — replaced by the presence of `verification: string`.

### `Highlight.buddyResponses` stays

Already in the type. Plan-05 uses it as the persistent store for buddy responses on a highlight.

### `PrototypeSlide` state additions

```tsx
const [consultingHighlights, setConsultingHighlights] = useState<Set<string>>(new Set())
```

Tracks which highlights have a fetch in flight — prevents double-fetching if the user rapidly stages bubbles. Simpler than per-buddy loading since the pane just needs to know "is the active highlight's initial consult pending?"

---

## Trigger logic — `PrototypeSlide.addBubble`

Extend `addBubble` to also fire `/api/consult` IF this is the first bubble on the highlight and no buddy responses exist yet.

```tsx
function addBubble(highlightId: string, text: string) {
  const newBubbleId = crypto.randomUUID()
  let updatedBubbles: Bubble[] = []
  let shouldConsult = false
  let highlightText = ''

  setHighlights((prev) =>
    prev.map((h) => {
      if (h.id !== highlightId) return h
      updatedBubbles = [...h.bubbles, {
        id: newBubbleId,
        text,
        staged: true,
        committed: false,
        createdAt: new Date().toISOString(),
      }]
      highlightText = h.text
      // Consult ONLY when this is the first bubble AND there are no existing buddy responses
      shouldConsult = h.bubbles.length === 0 && h.buddyResponses.length === 0
      return {
        ...h,
        bubbles: updatedBubbles,
        commitReady: false,
      }
    })
  )

  // Always fire synthesis (plan-04 behaviour)
  void sendSynthesisTurn(highlightId, newBubbleId, highlightText, updatedBubbles)

  // Fire consult only if this is the trigger moment
  if (shouldConsult) {
    void sendConsult(highlightId, highlightText, updatedBubbles.map((b) => b.text))
  }
}
```

### `sendConsult(highlightId, highlightText, bubbleTexts)`

Fires `/api/consult`. The endpoint returns all buddies at once (server-side fan-out). For "stream in" feel, we populate them into state immediately as they arrive — but since the endpoint returns the full array, we get them all at once.

**Decision for "stream in":** we fake streaming by triggering a re-render for each buddy response with a small stagger. Alternative is to fire three separate endpoints. For simplicity and to match the existing `/api/consult` shape, go with the stagger approach:

```tsx
async function sendConsult(highlightId: string, highlightText: string, bubbleTexts: string[]) {
  setConsultingHighlights((prev) => new Set(prev).add(highlightId))

  try {
    const response = await fetch('/api/consult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ highlight: highlightText, bubbles: bubbleTexts } satisfies ConsultRequest),
    })

    if (!response.ok) {
      // Handle 501 (no key) and other errors — store an error response per buddy
      const errText = await response.text().catch(() => 'Consult failed')
      setHighlights((prev) =>
        prev.map((h) =>
          h.id === highlightId
            ? {
                ...h,
                buddyResponses: [
                  ...h.buddyResponses,
                  { id: crypto.randomUUID(), buddyId: 'unknown', error: errText, createdAt: new Date().toISOString() },
                ],
              }
            : h,
        ),
      )
      return
    }

    const data = (await response.json()) as ConsultResponse

    // Stagger the responses into state by ~250ms each for the "stream in" feel
    for (let i = 0; i < data.responses.length; i++) {
      const resp = data.responses[i]
      await new Promise((r) => setTimeout(r, i === 0 ? 0 : 250))
      setHighlights((prev) =>
        prev.map((h) =>
          h.id === highlightId
            ? {
                ...h,
                buddyResponses: [
                  ...h.buddyResponses,
                  {
                    id: crypto.randomUUID(),
                    buddyId: resp.buddyId,
                    buddyName: resp.buddyName,
                    text: resp.text,
                    error: resp.error,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : h,
        ),
      )
    }
  } finally {
    setConsultingHighlights((prev) => {
      const next = new Set(prev)
      next.delete(highlightId)
      return next
    })
  }
}
```

### `reRunBuddy(highlightId, buddyId)`

Fetches a single buddy's fresh take. Since `/api/consult` runs all three, we'd need either a new endpoint or to fetch all and filter. For prototype scope, re-fire `/api/consult` and append just the matching buddy's response:

```tsx
async function reRunBuddy(highlightId: string, buddyId: string) {
  const h = highlights.find((x) => x.id === highlightId)
  if (!h) return

  const bubbleTexts = h.bubbles.map((b) => b.text)

  try {
    const response = await fetch('/api/consult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ highlight: h.text, bubbles: bubbleTexts } satisfies ConsultRequest),
    })
    if (!response.ok) return
    const data = (await response.json()) as ConsultResponse
    const matching = data.responses.find((r) => r.buddyId === buddyId)
    if (!matching) return

    setHighlights((prev) =>
      prev.map((x) =>
        x.id === highlightId
          ? {
              ...x,
              buddyResponses: [
                ...x.buddyResponses,
                {
                  id: crypto.randomUUID(),
                  buddyId: matching.buddyId,
                  buddyName: matching.buddyName,
                  text: matching.text,
                  error: matching.error,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : x,
      ),
    )
  } catch {
    // Silent fail for re-run; user can click again
  }
}
```

**Cost note:** this re-runs all three buddies server-side but only uses one. Wasteful but simple. If Lucy needs to save API spend, plan-07 or feature plan can add a `/api/consult/:buddyId` single-buddy endpoint.

### `verifyBuddyResponse(highlightId, responseId)`

```tsx
async function verifyBuddyResponse(highlightId: string, responseId: string) {
  const h = highlights.find((x) => x.id === highlightId)
  if (!h) return
  const resp = h.buddyResponses.find((r) => r.id === responseId)
  if (!resp || !resp.text) return

  // Mark verifying
  setHighlights((prev) =>
    prev.map((x) =>
      x.id === highlightId
        ? {
            ...x,
            buddyResponses: x.buddyResponses.map((r) =>
              r.id === responseId ? { ...r, verifying: true } : r,
            ),
          }
        : x,
    ),
  )

  try {
    const response = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        highlight: h.text,
        originalResponse: resp.text,
        buddyId: resp.buddyId,
      } satisfies VerifyRequest),
    })

    if (!response.ok) return
    const data = (await response.json()) as VerifyResponse

    setHighlights((prev) =>
      prev.map((x) =>
        x.id === highlightId
          ? {
              ...x,
              buddyResponses: x.buddyResponses.map((r) =>
                r.id === responseId ? { ...r, verification: data.text, verifying: false } : r,
              ),
            }
          : x,
      ),
    )
  } catch {
    setHighlights((prev) =>
      prev.map((x) =>
        x.id === highlightId
          ? {
              ...x,
              buddyResponses: x.buddyResponses.map((r) =>
                r.id === responseId ? { ...r, verifying: false } : r,
              ),
            }
          : x,
      ),
    )
  }
}
```

Pass all three handlers (`reRunBuddy`, `verifyBuddyResponse`) + `consultingHighlights` down to `BuddyPanel`.

---

## `BuddyPanel` — full rewrite

Current: empty placeholder. Rewrite as a real component showing the active highlight's buddy responses.

### Props

```ts
type BuddyPanelProps = {
  activeHighlight: Highlight | null
  isConsulting: boolean
  onVerify: (highlightId: string, responseId: string) => void
  onReRun: (highlightId: string, buddyId: string) => void
}
```

### Layout

```tsx
<div className="border-border-soft flex min-h-0 flex-1 flex-col border-t">
  {/* Header */}
  <div className="border-border-subtle flex items-center border-b px-4 pb-2 pt-4">
    <p className="text-text-tertiary text-xs uppercase tracking-widest">Buddies</p>
  </div>

  {/* Body */}
  <div className="scroll-area flex-1 overflow-y-auto px-4 py-3">
    {!activeHighlight ? (
      <EmptyState />
    ) : activeHighlight.buddyResponses.length === 0 && isConsulting ? (
      <LoadingSkeleton />
    ) : activeHighlight.buddyResponses.length === 0 ? (
      <NotYetState />
    ) : (
      <>
        {activeHighlight.buddyResponses.map((resp) => (
          <BuddyCard
            key={resp.id}
            response={resp}
            onVerify={() => onVerify(activeHighlight.id, resp.id)}
            onReRun={() => onReRun(activeHighlight.id, resp.buddyId)}
          />
        ))}
        {isConsulting && <LoadingSkeleton inline />}
      </>
    )}
  </div>

  {/* Footer — add buddy placeholder */}
  <div className="border-border-subtle border-t p-3">
    <Button
      variant="ghost"
      disabled
      title="Coming soon"
      className="w-full gap-2"
    >
      <Plus className="size-4" />
      Add a buddy
    </Button>
  </div>
</div>
```

### `BuddyCard` subcomponent (inline or own file — your call)

```tsx
function BuddyCard({
  response,
  onVerify,
  onReRun,
}: {
  response: BuddyResponse
  onVerify: () => void
  onReRun: () => void
}) {
  return (
    <div
      data-error={!!response.error || undefined}
      className={cn(
        'bg-surface shadow-input mb-3 flex flex-col rounded-xl px-3 py-3',
      )}
    >
      {/* Buddy name */}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-text-primary text-xs font-medium">{response.buddyName ?? response.buddyId}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onReRun}
            aria-label="Re-run this buddy"
            className="text-text-tertiary hover:text-text-primary flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Response body */}
      {response.error ? (
        <p className="text-danger text-sm">Error: {response.error}</p>
      ) : (
        <>
          <p className="text-text-primary text-sm leading-snug whitespace-pre-line">{response.text}</p>

          {response.verification && (
            <div className="border-border-subtle mt-3 rounded-md border-l-2 px-3 py-2">
              <p className="text-text-tertiary mb-1 text-xs uppercase tracking-widest">Verification</p>
              <p className="text-text-secondary text-sm leading-snug whitespace-pre-line">{response.verification}</p>
            </div>
          )}

          {/* Verify button */}
          {!response.verification && !response.verifying && (
            <button
              type="button"
              onClick={onVerify}
              className="text-text-tertiary hover:text-text-primary mt-2 self-start cursor-pointer text-xs underline-offset-2 hover:underline"
            >
              Verify
            </button>
          )}
          {response.verifying && (
            <p className="text-text-tertiary mt-2 text-xs">Verifying…</p>
          )}
        </>
      )}
    </div>
  )
}
```

**Re-run icon choice:** `RefreshCw` from lucide-react signals "get a fresh take" more clearly than `+`. Your spec said "+" but also said "or we need to change the icon." Going with the refresh icon. If you prefer the `+`, one-line swap.

### Empty / loading / not-yet states

```tsx
function EmptyState() {
  return (
    <div className="text-text-tertiary flex h-full flex-col items-center justify-center px-6 text-center text-sm">
      <p>Buddies will appear here once you've highlighted a passage and staged a bubble.</p>
    </div>
  )
}

function NotYetState() {
  return (
    <div className="text-text-tertiary flex h-full flex-col items-center justify-center px-6 text-center text-sm">
      <p>Stage your first bubble to call in the buddies.</p>
    </div>
  )
}

function LoadingSkeleton({ inline = false }: { inline?: boolean }) {
  return (
    <div className={cn('flex gap-2 py-2', !inline && 'h-full items-center justify-center')}>
      <span className="text-text-tertiary text-sm">Buddies are reading</span>
      <span className="animate-bounce text-text-tertiary" style={{ animationDelay: '0ms' }}>•</span>
      <span className="animate-bounce text-text-tertiary" style={{ animationDelay: '150ms' }}>•</span>
      <span className="animate-bounce text-text-tertiary" style={{ animationDelay: '300ms' }}>•</span>
    </div>
  )
}
```

---

## Files to create

None strictly — `BuddyPanel.tsx` exists as a shell from plan-01 and gets rewritten. `BuddyCard` lives inline.

## Files to modify

```
shared/types.ts                                         ← Update BuddyResponse (add id, verification, verifying), update ConsultRequest (bubbles[] not articulation)
server/src/lib/buddies.ts                               ← Rewrite BUDDIES with real personas, update buildBuddyUserMessage signature
server/src/routes/consult.ts                            ← Accept bubbles[], pass to buildBuddyUserMessage
client/src/components/slides/PrototypeSlide.tsx         ← consultingHighlights state, sendConsult, reRunBuddy, verifyBuddyResponse; wire addBubble to trigger consult on first bubble
client/src/components/prototype/BuddyPanel.tsx          ← Full rewrite (stacked cards, verify, re-run, add-buddy placeholder)
```

---

## Constraints

- **Trigger is first-bubble-staged, no re-trigger on subsequent bubbles** on the same highlight. User gets one set of buddies per highlight (plus manual re-runs).
- **Stagger the "stream in"** — 250ms between each buddy's state update. Not real streaming, but reads as progressive arrival.
- **Verify appends, not replaces.** Original stays visible.
- **Re-run appends.** A new response card from the same buddy shows below the original. No replace.
- **Buddy responses persist on the Highlight object.** Re-activating a highlight shows its stored responses without a fresh call.
- **No classifier cost.** Buddies decide A/B in their own system prompts — no upstream classifier.
- **Don't start the dev server.** Lucy verifies visually.
- **Match `BUILD_PLANS/design-patterns.md`.**

---

## Out of scope

- Persistence to disk (plan 06).
- Single-buddy endpoint (re-run currently re-fetches all three, uses one — wasteful but simple).
- Actual "add a buddy" flow — placeholder only.
- Buddy filtering, muting, reordering.
- Cross-buddy synthesis or coordination.
- Streaming HTTP responses (parked — feature plan if latency feels bad).

---

## Definition of done

- `shared/types.ts` updated: `BuddyResponse` has `id`, `verification?`, `verifying?`. `ConsultRequest.bubbles: string[]` replaces `articulation`.
- `server/src/lib/buddies.ts` — three real personas with Mode A/B logic embedded in system prompts. `buildBuddyUserMessage` takes `bubbles: string[]`.
- `server/src/routes/consult.ts` — accepts and passes `bubbles`. Existing parallel fan-out logic unchanged.
- `PrototypeSlide` fires `/api/consult` when the first bubble is staged on a highlight with no existing buddy responses. Subsequent bubbles on the same highlight don't re-fire.
- `BuddyPanel` shows three stacked cards, each with buddy name, response text, Verify link, re-run icon.
- Responses staircase in (250ms stagger between cards appearing).
- Clicking Verify on a card fires `/api/verify`, shows "Verifying…" loader, then appends a verification block below the original response.
- Clicking re-run on a card fires a fresh `/api/consult`, appends only that buddy's new response below the existing card.
- Pane-level "Add a buddy" button renders disabled with a "Coming soon" tooltip.
- When an active highlight has stored `buddyResponses`, re-activating it shows them without a fresh call.
- When the highlight has no active bubbles (either fresh highlight or user deleted all bubbles), the NotYetState shows. Panel correctly handles the flow: new highlight (NotYetState) → first bubble staged (LoadingSkeleton + consult fires) → responses stream in → subsequent activity doesn't retrigger.
- If `ANTHROPIC_API_KEY` is missing, server 501s; client renders the error inline in the panel.
- No console errors.
- `npm run typecheck` passes for both workspaces.
- `BUILD_PLANS/STATE.md` updated — plan-05 done, plan-06 next.
- `BUILD_PLANS/TEST_LIST.md` updated with new items specific to plan-05 (verify response quality feels right, re-run produces a meaningfully different take, Mode A/B decisions feel fair across buddies, 250ms stagger reads as "arriving" not "broken").
- Summary includes: whether buddies' responses felt distinct (English Teacher vs Historian vs Reframer should NOT sound the same); whether Mode A vs Mode B decisions seemed fair in manual testing; whether the stagger reads as intentional; whether the Verify output felt useful or redundant; whether re-run produced genuinely different responses or same-shape variations.
