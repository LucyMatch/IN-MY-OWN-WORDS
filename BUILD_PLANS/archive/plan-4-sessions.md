# Build Plan 4 — Sessions: Switching & Data Isolation

Read `BUILD_PLANS/context.md` first for project context, stack, and design tokens.

---

## Prerequisites

Plans 1, 2, and 3 must all be complete. The prototype slide should be running with a stub SessionsPanel that shows the session list but does nothing when you click a session.

---

## What this builds

Wires up session switching so clicking a session in the panel actually:
1. Loads that session's text into the reading pane
2. Filters highlights to show only that session's highlights
3. Clears any in-progress selection or open modals

After this plan, Lucy can switch between "Pride and Prejudice" and "Romeo and Juliet" and each has completely isolated highlights and reading state.

---

## Files to modify

```
client/src/components/prototype/SessionsPanel.tsx  ← remove stub, wire onSelect fully
client/src/components/slides/PrototypeSlide.tsx    ← pass activeSessionId to useSession + useHighlights
client/src/hooks/useSession.ts                     ← expose setActiveSessionId / accept reactive id
client/src/hooks/useHighlights.ts                  ← verify session filtering is correct
```

No new files needed. No server changes needed.

---

## What "session switching" means end-to-end

When the user clicks a session in the panel:

1. `activeSessionId` state in `PrototypeSlide` updates
2. `useSession(activeSessionId)` re-fetches the new session's `.txt` file
3. `useHighlights(activeSessionId)` re-filters highlights from the full highlights array
4. `ReadingPane` receives new `text` and new `highlights` — re-renders
5. Any open `ArticulationModal`, `SelectionPopover`, or active selection is cleared
6. `BuddyPanel` re-renders with the new session's highlights (may be empty)
7. `FacilitatorChat`, if open, closes

The `activeSessionId` state lives in `PrototypeSlide`. It's the single source of truth. It flows down as props.

---

## SessionsPanel — full implementation

The stub from Plan 3 already renders correctly. The only change: `onSelect` was a no-op. Now it's called for real.

```ts
type SessionsPanelProps = {
  sessions: Session[]           // passed down from PrototypeSlide (loaded by useSession)
  activeSessionId: string
  onSelect: (id: string) => void
}
```

Behavioural change from Plan 3:
- Clicking a session row calls `onSelect(session.id)` — this is now wired in PrototypeSlide

Visual addition: loading indicator. When a session switch is in progress (text is loading), show a subtle spinner or muted "Loading..." text in place of the session content. `text-text-tertiary text-xs`. Don't block the panel — keep the list interactive.

No other changes to SessionsPanel visual design.

---

## PrototypeSlide wiring

The key change is that `activeSessionId` now drives both hooks:

```tsx
const [activeSessionId, setActiveSessionId] = useState(sessions[0]?.id ?? '')
const [clearKey, setClearKey] = useState(0)  // increment to reset reading pane state

const { sessions, activeSessionText, loading } = useSession(activeSessionId)
const { highlights, addHighlight, updateHighlight } = useHighlights(activeSessionId)

function handleSessionSelect(id: string) {
  if (id === activeSessionId) return
  setActiveSessionId(id)
  setClearKey(k => k + 1)  // signals ReadingPane to clear selection state
}
```

Pass `clearKey` to `ReadingPane` as a `key` prop — React will unmount/remount it, clearing all internal state (selection, open popovers) automatically. This is the simplest correct approach.

```tsx
<ReadingPane
  key={clearKey}
  text={activeSessionText}
  highlights={highlights}
  ...
/>
```

Also pass `sessions` down to `SessionsPanel`:
```tsx
<SessionsPanel
  sessions={sessions}
  activeSessionId={activeSessionId}
  onSelect={handleSessionSelect}
/>
```

---

## useHighlights — verify correctness

The filtering logic from Plan 3 should already be correct. Confirm:

```ts
// returning only highlights for the active session
const sessionHighlights = allHighlights.filter(h => h.sessionId === activeSessionId)
```

When saving, the full array (all sessions) must be sent to `POST /api/highlights`, not just the filtered subset. Confirm the save logic merges back correctly:

```ts
async function saveHighlights(updatedForSession: Highlight[]) {
  const otherSessions = allHighlights.filter(h => h.sessionId !== activeSessionId)
  const merged = [...otherSessions, ...updatedForSession]
  await fetch('/api/highlights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(merged),
  })
  setAllHighlights(merged)
}
```

If this isn't what Plan 3 implemented, fix it here.

---

## useSession — reactive to activeSessionId

Confirm `useSession` correctly re-fetches when `activeSessionId` changes. The `useEffect` dependency array must include `activeSessionId`:

```ts
useEffect(() => {
  if (!activeSession) return
  setLoading(true)
  fetch(`/sessions/${activeSession.filename}`)
    .then(r => r.text())
    .then(text => { setActiveSessionText(text); setLoading(false) })
    .catch(() => { setError('Failed to load session text'); setLoading(false) })
}, [activeSession])  // activeSession changes when activeSessionId changes
```

---

## Adding a new session in future

Document this somewhere (a comment in `sessions.json` or this file serves as the record):

1. Add `.txt` file to `client/public/sessions/`
2. Add entry to `client/public/sessions.json`

No code changes needed.

---

## Constraints

- Data isolation is client-side filtering only — all highlights from all sessions live in one JSON file on disk. This is fine for a prototype.
- Do not add per-session storage on the server — keep it simple
- FacilitatorChat should close on session switch — its conversation context belongs to the old session
- Do not start the dev server or test in a browser — Lucy will verify

---

## Out of scope

- Deleting sessions
- Reordering sessions  
- Persisting which session was last active across page reloads
- Any server-side changes
