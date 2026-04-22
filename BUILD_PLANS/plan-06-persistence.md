# Plan 06 — Persistence

Read `BUILD_PLANS/context.md`, `BUILD_PLANS/STATE.md`, and `BUILD_PLANS/design-patterns.md` first.

**Prerequisite:** plan-05 is done. `Highlight` now carries `ranges`, `bubbles`, `buddyResponses` (array with new ids/verifications), and the transient `commitReady`.

---

## What this builds

Highlights survive reloads. The user creates highlights, stages bubbles, commits, and if they refresh the page or reopen the app later, everything comes back — except transient UI state (active id, chat history, pane open/closed).

After this plan:

- **On app mount** — `PrototypeSlide` fetches `GET /api/highlights`, hydrates all highlights across all sessions into a single state array.
- **On every mutation** — `addHighlight`, `deleteHighlight`, `addBubble`, `updateBubble`, `deleteBubble`, `commitHighlight`, `sendConsult`, `reRunBuddy`, `verifyBuddyResponse`, `deleteBuddyResponse` (new) — posts the current highlights array to `POST /api/highlights`. Saves happen via a `useEffect` that watches `highlights`, NOT inside each setter, so each logical mutation fires exactly one save regardless of strict-mode double-invocation.
- **On session switch** — the session-switch `useEffect` stops *clearing* highlights. Instead, it filters to the active session for display and clears only session-local UI state (`activeHighlightId`, `chatHistory`).
- **`commitReady` is stripped before save.** On load, every highlight defaults to `commitReady: false`. Classifier re-runs naturally on the next synthesis turn.
- **New: delete a single buddy response** — a minus icon on each buddy card removes just that response from the highlight's `buddyResponses` array. Per your ask.
- **New: clear all highlights for a session** — a subtle "clear" affordance appears next to each session in the sessions panel on hover, with a tooltip. Clicking removes all highlights for that session (with confirmation).
- **Persistence is best-effort.** Save failures log to console but don't block the UI. Load failures reset to empty state with a console error.

**What this plan does NOT do:**

- No persistence of chat history or pane UI state.
- No per-user isolation (single-user prototype).
- No conflict resolution (last write wins — no multi-tab concerns for this demo).
- No migration logic for old data shapes (file is assumed to match current `Highlight` type; on mismatch, start fresh).

---

## Code patterns

Read `BUILD_PLANS/design-patterns.md`. Patterns that apply:

- Canonical component shape for anything new.
- `cn()` on every className.
- Data-attributes for state (e.g. `data-pending-clear` on a session row that has an active confirm-clear state).
- Raw `<button>` for the hover-revealed clear icon in the session row.

---

## Data model changes

### Update `Highlight` type comment

The existing type doesn't change. But the `commitReady` field gets an explicit comment that it's transient and stripped before persistence:

```ts
export type Highlight = {
  id: string
  sessionId: string
  ranges: HighlightRange[]
  text: string
  bubbles: Bubble[]
  buddyResponses: BuddyResponse[]
  /**
   * Transient. Stripped before save (plan-06). Defaults to false on load.
   * Re-populated by the classifier on the next synthesis turn.
   */
  commitReady: boolean
  createdAt: string
}
```

No new types needed.

---

## Server changes

### No new endpoint

The existing `POST /api/highlights` accepts the whole array as a replacement, which is what we use for per-mutation saves. For "clear all highlights in a session," the client computes `highlights.filter(h => h.sessionId !== targetSessionId)` and POSTs the filtered array. No new endpoint.

### Audit `storage.ts` read path

Check that `readHighlights()` handles a missing file gracefully (returns `[]` rather than throwing). If it doesn't, add the handling:

```ts
// server/src/lib/storage.ts
export async function readHighlights(): Promise<Highlight[]> {
  try {
    const raw = await fs.readFile(HIGHLIGHTS_FILE_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch (err) {
    // ENOENT → no file yet, fresh start. Anything else → log and return empty.
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      return []
    }
    console.error('[readHighlights]', err)
    return []
  }
}
```

Verify this in the existing storage.ts. If already handled, skip.

---

## Client-side persistence layer

### New file: `client/src/lib/persistence.ts`

Centralises the save/load logic. Keeps `PrototypeSlide` readable.

```ts
import type { Highlight } from '@shared/types'

/** Strip transient fields before persisting. */
function sanitizeForSave(highlights: Highlight[]): Highlight[] {
  return highlights.map((h) => ({
    ...h,
    commitReady: false, // stripped/reset before save
  }))
}

/** Load highlights from the server. Returns empty array on any failure. */
export async function loadHighlights(): Promise<Highlight[]> {
  try {
    const response = await fetch('/api/highlights')
    if (!response.ok) {
      console.error('[persistence] load failed with status', response.status)
      return []
    }
    const data = (await response.json()) as Highlight[]
    // Ensure commitReady defaults to false on hydration
    return data.map((h) => ({ ...h, commitReady: false }))
  } catch (err) {
    console.error('[persistence] load error', err)
    return []
  }
}

/**
 * Save highlights to the server. Fire-and-forget — logs on failure but
 * does not surface to the UI. This is per-mutation saving, so any failed
 * save will retry naturally on the next mutation.
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
```

**Why fire-and-forget on save:** at prototype scale, this is safer than awaiting. If the save is slow or hangs, the UI stays responsive. If the save fails, the next mutation will save the correct state anyway. The only way to lose data is to close the tab before the last save completes — acceptable risk for single-user local prototype.

**Why sanitize:** `commitReady` is transient. Saving it would mean a committed-ready state could persist across reload even if the user has since added new bubbles that invalidate it.

---

## `PrototypeSlide` changes

### Remove "clear highlights on session switch" from useEffect

The existing effect does:
```tsx
useEffect(() => {
  setHighlights([])
  setActiveHighlightId(null)
  setChatHistory([])
}, [activeSessionId])
```

Change to:
```tsx
useEffect(() => {
  // Highlights are NOT cleared on session switch — they're scoped by filter at render time.
  // Only UI state that is meaningful within one session gets reset.
  setActiveHighlightId(null)
  setChatHistory([])
}, [activeSessionId])
```

### Add load-on-mount with a hydration guard ref

Load runs once on mount. We need to distinguish "we just loaded from the server" from "the user just mutated something" so the save-effect doesn't fire a save on hydration.

```tsx
const hasHydratedRef = useRef(false)
const [highlights, setHighlights] = useState<Highlight[]>([])

useEffect(() => {
  void (async () => {
    const loaded = await loadHighlights()
    setHighlights(loaded)
    hasHydratedRef.current = true
  })()
}, [])
```

`hasHydratedRef` starts false. When the initial load completes and highlights are set, it flips to true. The save-effect (below) checks this ref before saving.

### Save via useEffect watching `highlights`

Instead of calling `saveHighlights` inside each setter (which risks double-fires under strict mode), react to state changes:

```tsx
useEffect(() => {
  if (!hasHydratedRef.current) {
    // Initial mount or mid-hydration. Don't save.
    return
  }
  saveHighlights(highlights)
}, [highlights])
```

Single source of truth for when we save: whenever `highlights` changes AFTER hydration has completed. Strict-mode double-invocation of setters still produces one final committed state, which triggers one effect run, which triggers one save.

**Why the ref, not state:** we don't want `hasHydratedRef` to trigger re-renders. It's a coordination flag, not UI state.

**Edge case:** if an initial load completes with non-empty highlights AND the user immediately mutates before the effect has a chance to run, the save-effect will fire the first mutation normally. Ref-based guard is correct.

### No more wrapper — direct `setHighlights` in mutation handlers

Because the save is now in a `useEffect`, every mutation handler can call `setHighlights` directly as before. No `updateHighlights` wrapper.

This simplifies the handlers and means plan-05's existing code (which uses `setHighlights((prev) => prev.map(...))` patterns) needs no refactor beyond the two new handlers below.

### Derive session-scoped highlights for rendering

```tsx
const currentSessionHighlights = useMemo(
  () => highlights.filter((h) => h.sessionId === activeSessionId),
  [highlights, activeSessionId],
)
```

Pass `currentSessionHighlights` to `ReadingPane`, `BuddyPanel`, and `InYourOwnWordsPane`. These components already receive `highlights: Highlight[]` — they just now receive a filtered subset.

### Highlight counts by session (for the clear-confirm copy)

```tsx
const highlightCountsBySession = useMemo(() => {
  const counts: Record<string, number> = {}
  for (const h of highlights) {
    counts[h.sessionId] = (counts[h.sessionId] ?? 0) + 1
  }
  return counts
}, [highlights])
```

Pass to `SessionsPanel`.

### New handler: `deleteBuddyResponse`

Per your Q6 ask — ability to delete a single buddy response.

```tsx
function deleteBuddyResponse(highlightId: string, responseId: string) {
  setHighlights((prev) =>
    prev.map((h) =>
      h.id === highlightId
        ? {
            ...h,
            buddyResponses: h.buddyResponses.filter((r) => r.id !== responseId),
          }
        : h,
    ),
  )
}
```

Pass down to `BuddyPanel`.

### New handler: `clearSessionHighlights`

For the Q8 "clear highlights for a session" affordance in the sessions panel.

```tsx
function clearSessionHighlights(sessionId: string) {
  setHighlights((prev) => prev.filter((h) => h.sessionId !== sessionId))
  if (sessionId === activeSessionId) {
    setActiveHighlightId(null)
  }
}
```

Pass to `SessionsPanel`.

---

## `BuddyPanel` — add delete-response button

Add a minus icon next to the re-run icon on each buddy card. Clicking fires `onDeleteResponse`.

Update props:
```ts
onDeleteResponse: (highlightId: string, responseId: string) => void
```

In the `BuddyCard` header, extend the action group:

```tsx
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
    <button
      type="button"
      onClick={onDeleteResponse}
      aria-label="Delete this response"
      className="text-text-tertiary hover:text-danger flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors"
    >
      <Minus className="size-3.5" />
    </button>
  </div>
</div>
```

`Minus` from `lucide-react`.

---

## `SessionsPanel` — add hover-revealed clear affordance

Each session row in the expanded panel gets a "clear highlights" affordance revealed on hover.

### Updated props

```ts
type SessionsPanelProps = {
  sessions: Session[]
  activeSessionId: string
  onSelect: (id: string) => void
  onClearSession: (id: string) => void    // NEW
  loading: boolean
  error: string | null
  highlightCountsBySession: Record<string, number>   // NEW — for the confirm copy
}
```

The `highlightCountsBySession` prop lets the confirm read "Clear 4 highlights?" instead of a generic "Clear?" — useful context. Computed in `PrototypeSlide` as shown above.

### Layout inside the session row

Current: raw `<button>` with title + author, active state via `data-active`.

New: the row becomes a container with TWO `<button>` children — the primary select button and a conditional trash button. The active-state data-attribute and shared hover styles move onto the container. Noting upfront: this is a structural drift from the starter's `SidebarChatItem` (single-button row), justified because two distinct click targets are needed (select vs delete).

```tsx
<div
  key={session.id}
  data-active={session.id === activeSessionId || undefined}
  className={cn(
    'group/row relative flex items-center',
    'hover:bg-state-hover data-[active]:bg-state-pill',
  )}
>
  <button
    type="button"
    onClick={() => onSelect(session.id)}
    className="flex flex-1 flex-col gap-0.5 px-4 py-3 text-left cursor-pointer"
  >
    <span className="text-text-primary text-sm">{session.title}</span>
    <span className="text-text-tertiary text-xs">{session.author}</span>
  </button>

  {(highlightCountsBySession[session.id] ?? 0) > 0 && (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        handleClearClick(session.id)
      }}
      title={`Clear ${highlightCountsBySession[session.id]} highlights`}
      aria-label={`Clear highlights for ${session.title}`}
      className={cn(
        'text-text-tertiary hover:text-danger mr-3 flex size-6 cursor-pointer items-center justify-center rounded-full transition-opacity',
        'opacity-0 group-hover/row:opacity-100 focus:opacity-100',
      )}
    >
      <Trash2 className="size-3.5" />
    </button>
  )}
</div>
```

**Accessibility note:** `focus:opacity-100` means keyboard users tabbing through also see the trash icon. Good.

### Confirm flow

On first click of the trash icon, show an inline confirm instead of acting immediately. Local state in `SessionsPanel`:

```tsx
const [pendingClearId, setPendingClearId] = useState<string | null>(null)

function handleClearClick(sessionId: string) {
  if (pendingClearId === sessionId) {
    onClearSession(sessionId)
    setPendingClearId(null)
  } else {
    setPendingClearId(sessionId)
    // Auto-timeout after 3s so the confirm state doesn't linger
    setTimeout(() => {
      setPendingClearId((prev) => (prev === sessionId ? null : prev))
    }, 3000)
  }
}
```

When `pendingClearId === session.id`, change the trash button to a confirm state — red background, white icon, text label "Confirm?":

```tsx
{pendingClearId === session.id ? (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation()
      onClearSession(session.id)
      setPendingClearId(null)
    }}
    className="bg-danger text-surface mr-3 flex h-6 items-center gap-1 rounded-full px-2 text-xs cursor-pointer"
  >
    <Trash2 className="size-3" />
    <span>Confirm?</span>
  </button>
) : (
  /* the hover-only trash button as above */
)}
```

Two-click destructive action: first click reveals the confirm, second click executes. The 3-second auto-dismiss prevents the confirm state from sticking around.

---

## Files to create

```
client/src/lib/persistence.ts      ← loadHighlights, saveHighlights, sanitizeForSave
```

## Files to modify

```
shared/types.ts                                         ← (comment-only) mark Highlight.commitReady as transient/stripped
server/src/lib/storage.ts                               ← (if needed) graceful ENOENT handling on readHighlights
client/src/components/slides/PrototypeSlide.tsx         ← load on mount, hasHydratedRef, save-on-change useEffect, filter by session for render, new handlers (deleteBuddyResponse, clearSessionHighlights), highlightCountsBySession memo, remove "clear highlights on session switch"
client/src/components/prototype/SessionsPanel.tsx       ← hover-revealed trash icon, confirm flow, highlight counts, new props
client/src/components/prototype/BuddyPanel.tsx          ← minus icon on each buddy card, onDeleteResponse prop plumbing
```

---

## Constraints

- **Transient state is stripped before save.** `commitReady` is the main one. If others become transient later, update `sanitizeForSave`.
- **Save fires via `useEffect([highlights])`, not inline in setters.** Hydration guard ref prevents saving on initial load.
- **Saves are fire-and-forget.** UI doesn't block on them. Failures log only.
- **Chat history is NOT persisted.** Only highlights + their nested bubbles + buddy responses.
- **Session is inferred from the filter, not the store.** `highlights` is a flat array; session scope is a render-time derivation.
- **Clear action is per-session, not global.** No "clear everything" button.
- **No optimistic rollback.** If a save fails, state stays as-is. Next mutation will save the correct state.
- **Don't start the dev server.** Lucy verifies visually.

---

## Out of scope

- Single-buddy consult endpoint (noted in TEST_LIST cost section).
- Chat history persistence.
- Undo / history for the clear action (confirm is the safety).
- Schema validation with Zod on the server.
- Multi-tab/multi-user concurrency.
- Migration logic for old data shapes.
- Optimistic locking or debounced saves.

---

## Definition of done

- `client/src/lib/persistence.ts` exists with `loadHighlights`, `saveHighlights`, and `sanitizeForSave`.
- `storage.ts`'s `readHighlights` returns `[]` gracefully when the file doesn't exist.
- `PrototypeSlide`:
  - Loads highlights on mount.
  - Has a `hasHydratedRef` that flips to `true` after load completes.
  - Has a `useEffect([highlights])` that calls `saveHighlights(highlights)` only when `hasHydratedRef.current === true`.
  - Does NOT clear highlights on session switch — only `activeHighlightId` and `chatHistory`.
  - Renders with session-filtered highlights (`currentSessionHighlights` via `useMemo`).
  - Has `deleteBuddyResponse` and `clearSessionHighlights` handlers.
  - Computes and passes `highlightCountsBySession` to `SessionsPanel`.
- `SessionsPanel`:
  - Row becomes a container with a primary select button + optional trash button.
  - Trash button shows only when that session has highlights AND on row hover or focus.
  - Tooltip reads e.g. "Clear 4 highlights".
  - First click shows a red "Confirm?" state; second click fires clear. 3s auto-dismiss.
- `BuddyPanel`:
  - Each `BuddyCard` has a Minus icon next to the RefreshCw icon.
  - Clicking fires `onDeleteResponse` which removes that single response from the highlight.
- Reload-after-mutation test passes: create a highlight → stage bubbles → commit → reload page → highlights come back with all bubbles and buddy responses intact; `commitReady` is false; chat history is empty.
- Session switch test passes: create highlights on session A → switch to session B → no highlights visible → switch back to A → highlights still there.
- Clear session test passes: clear session A's highlights → they disappear → reload page → they're still gone.
- Delete buddy response test passes: click Minus on a buddy card → response removed → reload → still removed.
- Hydration doesn't trigger a save: on initial mount with existing data in `highlights.json`, confirm (via server logs or network tab) that no POST fires during the load itself — only on subsequent mutations.
- If `GET /api/highlights` returns 500 or unreachable, app starts with empty highlights (no crash). Console logs the error.
- No console errors during normal flow (saves are expected to log only on failure).
- `npm run typecheck` passes for both workspaces.
- `BUILD_PLANS/STATE.md` updated — plan-06 done. Known issues section notes any observed behaviour.
- `BUILD_PLANS/TEST_LIST.md` updated with any plan-06 verification items (e.g. "does the confirm flow feel right, or should it be a modal instead").
- Summary includes: whether the per-mutation save rhythm is noticeable (any flicker, lag), whether the confirm flow on clear feels right (3s auto-dismiss correct, or should it be 5s?), whether the hover-revealed trash icon is discoverable enough or needs to be always visible, whether hydration on mount reveals any shape mismatches from earlier saves, and confirmation that no save fires during initial hydration.
