# Plan 01 — Prototype Shell and Sessions

Read `BUILD_PLANS/context.md`, `BUILD_PLANS/STATE.md`, and `BUILD_PLANS/design-patterns.md` first.

**Prerequisite:** plan-00-prep must be done (renames + lock-file regen). If `shared/types.ts` still has `documentId` or no `Session` type, stop and run plan-00 first.

---

## What this builds

The structural container for the prototype slide — layout, panel shells, session data, and the reading pane rendering real source text. **Static content only.** No interaction, no text selection, no API calls.

After this plan:
- Navigating to the Prototype slide shows the intended layout inside the deck (toolbar still visible above)
- **Sessions drawer** (left): collapsible, lists the two available sessions, clicking a session switches which text is shown in the reading pane
- **Reading pane** (centre-left): renders the active session's text with title/author/chapter header. This is the only element with internal scroll.
- **In Your Own Words pane** (middle): empty placeholder, collapsed by default (width: 0). Auto-open is wired in plan-03.
- **Right column**: empty stacked containers — FacilitatorChat on top, BuddyPanel below

The data shape for sessions is in place. No highlights, no bubbles, no API wiring — those land in plans 02+.

---

## Code patterns

**Read `BUILD_PLANS/design-patterns.md` before writing any new component.** It's the canonical reference — do not re-derive patterns from scratch.

Specific patterns from that doc that apply in this plan:

- **Canonical component shape** — every new component in this plan follows it.
- **Raw `<button>` for session rows** — not the `Button` primitive (row-style, not pill-style).
- **Data-attribute for active state** on session rows: `data-active={session.id === activeSessionId || undefined}` + `data-[active]:bg-state-pill` (instead of conditional classes).
- **Named group + `data-collapsed`** on the `SessionsPanel` root for the collapse animation: `group/sessions ... data-[collapsed]:w-[var(--sidebar-width-collapsed)]`, and the session list hides via `group-data-[collapsed]/sessions:hidden`.
- **`Button` primitive** (`variant="ghost" size="icon"`) for the chevron collapse/expand toggles.
- **`cn()` on every className**.

If anything below conflicts with `design-patterns.md`, the doc wins.

---

## Files to create

```
client/public/sessions.json
client/public/sessions/pride-and-prejudice.txt    ← Lucy places manually (see below)
client/public/sessions/romeo-and-juliet.txt       ← Lucy places manually (see below)
client/src/components/slides/PrototypeSlide.tsx
client/src/components/prototype/SessionsPanel.tsx
client/src/components/prototype/ReadingPane.tsx
client/src/components/prototype/InYourOwnWordsPane.tsx   ← shell only
client/src/components/prototype/FacilitatorChat.tsx      ← shell only
client/src/components/prototype/BuddyPanel.tsx           ← shell only
```

## Files to modify

```
client/src/slides.config.tsx    ← swap PlaceholderSlide for PrototypeSlide on the 'prototype' slide
```

---

## Session data

### `client/public/sessions.json`

```json
[
  {
    "id": "pride-and-prejudice",
    "title": "Pride and Prejudice",
    "author": "Jane Austen",
    "section": "Chapter 8",
    "filename": "pride-and-prejudice.txt"
  },
  {
    "id": "romeo-and-juliet",
    "title": "Romeo and Juliet",
    "author": "William Shakespeare",
    "section": "Act 3, Scene 1",
    "filename": "romeo-and-juliet.txt"
  }
]
```

### Session text files

The two `.txt` files live OUTSIDE this repo and are not accessible to Claude Code. Lucy is placing them manually at:

- `client/public/sessions/pride-and-prejudice.txt`
- `client/public/sessions/romeo-and-juliet.txt`

Before running the rest of this plan, verify both files exist at those paths. If they don't, stop and ask Lucy — do not fabricate the content.

**Paragraph shape to expect:** both files use double-newline between paragraphs. The ReadingPane renders one `<p>` per `\n\n`-split block. The chapter/scene heading (`CHAPTER VIII.`, `ACT III. SCENE I.`) is the first block; split it out and render as an `<h2>` rather than a paragraph (see ReadingPane spec below).

---

## PrototypeSlide — the layout host

`client/src/components/slides/PrototypeSlide.tsx`

Holds the `activeSessionId` state. Fetches `/sessions.json` on mount. Passes the session list and active id down. Passes the active session's text down to `ReadingPane`.

```tsx
import { useEffect, useState } from 'react'
import type { Session } from '@shared/types'
import { SessionsPanel } from '@/components/prototype/SessionsPanel'
import { ReadingPane } from '@/components/prototype/ReadingPane'
import { InYourOwnWordsPane } from '@/components/prototype/InYourOwnWordsPane'
import { FacilitatorChat } from '@/components/prototype/FacilitatorChat'
import { BuddyPanel } from '@/components/prototype/BuddyPanel'

export function PrototypeSlide() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('')
  const [sessionText, setSessionText] = useState<string>('')
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingText, setLoadingText] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch session manifest once on mount
  useEffect(() => {
    fetch('/sessions.json')
      .then((r) => r.json())
      .then((data: Session[]) => {
        setSessions(data)
        if (data.length > 0) setActiveSessionId(data[0].id)
        setLoadingSessions(false)
      })
      .catch(() => {
        setError('Failed to load sessions')
        setLoadingSessions(false)
      })
  }, [])

  // Fetch the active session's text whenever it changes
  useEffect(() => {
    const session = sessions.find((s) => s.id === activeSessionId)
    if (!session) return
    setLoadingText(true)
    fetch(`/sessions/${session.filename}`)
      .then((r) => r.text())
      .then((text) => {
        setSessionText(text)
        setLoadingText(false)
      })
      .catch(() => {
        setError(`Failed to load ${session.filename}`)
        setLoadingText(false)
      })
  }, [sessions, activeSessionId])

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null

  return (
    <div className="flex h-full overflow-hidden">
      <SessionsPanel
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={setActiveSessionId}
        loading={loadingSessions}
        error={error}
      />
      <ReadingPane session={activeSession} text={sessionText} loading={loadingText} />
      <InYourOwnWordsPane />
      <div className="border-border-soft flex w-[360px] flex-shrink-0 flex-col border-l">
        <FacilitatorChat />
        <BuddyPanel />
      </div>
    </div>
  )
}
```

**Why state lives here:** `activeSessionId` will eventually drive highlight filtering, facilitator context, and buddy roster. Keeping it at the slide root gives a single source of truth without needing a second context.

---

## SessionsPanel

`client/src/components/prototype/SessionsPanel.tsx`

Collapsible left drawer. Clicking a session **works** (not a no-op — calls `onSelect`).

### Props
```ts
type SessionsPanelProps = {
  sessions: Session[]
  activeSessionId: string
  onSelect: (id: string) => void
  loading: boolean
  error: string | null
}
```

### Layout — root element
- Semantic `<nav>`
- Classes include: `group/sessions`, `bg-surface`, `border-r`, `border-border-soft`, `flex`, `h-full`, `flex-shrink-0`, `flex-col`, `w-[var(--sidebar-width)]`, `transition-[width]`, `duration-200`, `overflow-hidden`, `data-[collapsed]:w-[var(--sidebar-width-collapsed)]`
- `data-collapsed={isCollapsed || undefined}`

### Internal state
`const [isCollapsed, setIsCollapsed] = useState(false)` — starts expanded.

### Collapsed-only affordance
A container that shows ONLY when the nav is collapsed. Use the pattern `hidden group-data-[collapsed]/sessions:flex` so it flips in based on the nav's data-attribute.

Inside:
- `<ChevronRight>` inside a `Button variant="ghost" size="icon"`, vertically centered
- `onClick` sets `setIsCollapsed(false)` to expand

### Expanded-only affordance
A container that shows ONLY when the nav is expanded. Use `group-data-[collapsed]/sessions:hidden`.

Inside:
- Top row: `<ChevronLeft>` collapse button (`Button variant="ghost" size="icon"`) aligned to the right, with `onClick` setting `setIsCollapsed(true)`
- "Sessions" label: `text-text-tertiary px-4 pt-4 pb-2 text-xs uppercase tracking-widest`
- Session list:
  - Each row: raw `<button>` with two text lines
    - Title: `text-text-primary text-sm`
    - Author: `text-text-tertiary text-xs`
  - Row classes (via `cn()`): `flex w-full flex-col gap-0.5 px-4 py-3 text-left cursor-pointer hover:bg-state-hover data-[active]:bg-state-pill`
  - `data-active={session.id === activeSessionId || undefined}` on the button
  - `onClick={() => onSelect(session.id)}`
- Loading state: `text-text-tertiary px-4 py-3 text-xs` "Loading sessions…"
- Error state: `text-danger px-4 py-3 text-xs` renders the `error` prop

---

## ReadingPane

`client/src/components/prototype/ReadingPane.tsx`

### Props
```ts
type ReadingPaneProps = {
  session: Session | null
  text: string
  loading: boolean
}
```

### Layout
- `flex-1 overflow-y-auto` (the only scrollable element in the prototype)
- Inner container: `max-w-2xl mx-auto px-10 py-10`
- Serif body copy, generous line-height

### Content
- **Title block** (above the text):
  - Section label (`text-text-tertiary text-xs uppercase tracking-widest`) → `session.section`
  - Title (`font-serif text-text-primary text-2xl`) → `session.title`
  - Author (`text-text-secondary text-sm`) → `session.author`
  - Small separator (`border-b border-border-subtle mt-4 mb-6`)
- **Body paragraphs:**
  - Split `text` on `/\n\n+/` to get blocks
  - The **first** block (e.g. `CHAPTER VIII.` or `ACT III. SCENE I.`) renders as:
    `<h2 className="font-serif text-text-primary mb-4 text-lg uppercase tracking-widest">`
  - All remaining blocks render as:
    `<p className="font-serif text-text-secondary mb-4 leading-relaxed whitespace-pre-line">`
  - `whitespace-pre-line` preserves single newlines inside a paragraph (important for the Shakespeare text — each line of verse is its own line break)

### States
- If `loading`: render `text-text-tertiary text-sm` "Loading…" in place of the body
- If `!session`: render `text-text-tertiary text-sm` "No session selected"
- If `text` is empty and not loading: render `text-text-tertiary text-sm` "No text available"

---

## InYourOwnWordsPane — shell only

`client/src/components/prototype/InYourOwnWordsPane.tsx`

**Collapsed by default** per the locked behaviour. This plan ships it collapsed and leaves it that way — plan-03 wires up the auto-open.

```tsx
export function InYourOwnWordsPane() {
  // Collapsed by default. Auto-opens on first highlight — wired in plan-03.
  return <div className="border-border-soft h-full w-0 flex-shrink-0 overflow-hidden border-l" />
}
```

That's the whole component. Intentionally inert.

---

## FacilitatorChat — shell only

`client/src/components/prototype/FacilitatorChat.tsx`

Lives in the top half of the right-column stack. Empty placeholder.

### Layout
- Root classes: `flex min-h-0 flex-1 flex-col`
- Header: `<div>` with `text-text-tertiary border-border-subtle border-b px-4 pb-2 pt-4 text-xs uppercase tracking-widest` containing "Facilitator"
- Body: `<div>` with `text-text-tertiary flex flex-1 items-center justify-center px-6 text-center text-sm` containing "The facilitator will respond when you commit a thought."

No input field yet — that's plan-04.

---

## BuddyPanel — shell only

`client/src/components/prototype/BuddyPanel.tsx`

Lives in the bottom half of the right-column stack. Empty placeholder.

### Layout
- Root classes: `border-border-soft flex min-h-0 flex-1 flex-col border-t`
- Header: `<div>` with `text-text-tertiary border-border-subtle border-b px-4 pb-2 pt-4 text-xs uppercase tracking-widest` containing "Buddies"
- Body: `<div>` with `text-text-tertiary flex flex-1 items-center justify-center px-6 text-center text-sm` containing "Highlight a passage to hear from your buddies."

No roster, no API call yet — that's plan-05.

---

## slides.config.tsx change

Single edit — swap `PlaceholderSlide` for `PrototypeSlide` on the 'prototype' entry:

```tsx
import { PrototypeSlide } from '@/components/slides/PrototypeSlide'

// in the SLIDES array, the prototype entry becomes:
{
  id: 'prototype',
  section: 'prototype',
  sectionLabel: 'Prototype',
  title: 'Prototype',
  isPrototype: true,
  component: PrototypeSlide,   // ← was PlaceholderSlide
},
```

Leave `PlaceholderSlide` imported (still used on other slides until plan-02 onward).

---

## Constraints

- **No highlight logic, no bubbles, no API calls** — only the static structure, session data, and reading content
- **Match `BUILD_PLANS/design-patterns.md`** — read it before writing any component
- The toolbar from `DeckLayout` must remain visible above; `PrototypeSlide` fills only the area below it
- **Reading pane is the only element with internal scroll** — no other panel should scroll
- Session switching should feel instant (the text is small and static). No loading spinner for the text unless it genuinely takes noticeable time
- Do not start the dev server or test in a browser — Lucy will verify visually

---

## Out of scope (for future plans)

- Text selection / highlighting (plan 02)
- Bubble flow, middle pane auto-open, commit mechanic (plan 03)
- Facilitator API wiring (plan 04)
- Buddy API wiring + Verify button (plan 05)
- Highlight persistence to `/api/highlights` (plan 06)
- Draggable divider between Facilitator and Buddies (plan 07, stretch)

---

## Definition of done

- All files listed above exist with the behaviour described
- `npm run typecheck` passes for both workspaces
- Running `npm run dev` and navigating to the Prototype slide shows:
  - Sessions drawer on left with two entries, first one active
  - Reading pane showing Pride and Prejudice Chapter 8 with title block
  - Clicking "Romeo and Juliet" in the drawer swaps the reading pane content to Act 3 Scene 1
  - Empty Facilitator and Buddies placeholders on the right
  - Collapsing the sessions drawer animates it down to the narrow strip and the chevron flips
  - No console errors
- `BUILD_PLANS/STATE.md` updated to reflect plan-01 as done and plan-02 as next
