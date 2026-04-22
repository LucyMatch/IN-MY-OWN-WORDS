# Build Plan 3 — Prototype Slide Container

Read `BUILD_PLANS/context.md` first for project context, stack, and design tokens.

---

## Prerequisites

Plan 1 (deck shell) must be complete. Plan 2 (static slides) is ideal but not strictly required.

---

## What this builds

The structural container for the prototype — layout, panel shells, sessions data architecture, and the sessions panel UI. **No interactive functionality.** No text selection, no highlight logic, no API calls. Those are built separately, piece by piece, once wireframes are finalised.

After this plan:

- Navigating to the Prototype slide shows a three-panel layout inside the deck (toolbar still visible above)
- Left panel: collapsible sessions list, shows session titles, clicking does nothing yet
- Centre: empty reading area with placeholder text
- Right: empty buddy panel with placeholder text
- The data shape for sessions and highlights is in place

---

## Files to create

```text
client/public/sessions/pride-and-prejudice.txt    ← see text instructions below
client/public/sessions/romeo-and-juliet.txt
client/public/sessions.json
client/src/components/slides/PrototypeSlide.tsx
client/src/components/prototype/SessionsPanel.tsx
client/src/components/prototype/ReadingPane.tsx    ← shell only
client/src/components/prototype/BuddyPanel.tsx     ← shell only
```

## Files to modify

```text
client/src/slides.config.tsx    ← swap PlaceholderSlide for PrototypeSlide on the 'prototype' slide
shared/types.ts                 ← rename documentId → sessionId on Highlight
```

---

## sessions.json (`client/public/sessions.json`)

```json
[
  {
    "id": "pride-and-prejudice",
    "title": "Pride and Prejudice",
    "author": "Jane Austen",
    "filename": "pride-and-prejudice.txt"
  },
  {
    "id": "romeo-and-juliet",
    "title": "Romeo and Juliet",
    "author": "William Shakespeare",
    "filename": "romeo-and-juliet.txt"
  }
]
```

## Text files

For `pride-and-prejudice.txt`: use the opening of Chapter 1 from Pride and Prejudice (public domain). ~800 words minimum, plain paragraphs, no markdown.

For `romeo-and-juliet.txt`: use Act 1 Scene 1 from Romeo and Juliet (public domain). ~800 words minimum, plain paragraphs, minimal scene formatting.

These files exist so the sessions panel has real data to display. They will be loaded into the reading pane in a future build session.

---

## shared/types.ts — rename documentId → sessionId

On the `Highlight` type, rename the field:

```ts
export type Highlight = {
  id: string
  sessionId: string          // was documentId
  text: string
  articulation: string | null
  buddyResponses: BuddyResponse[]
  createdAt: string
}
```

---

## Session type

Add to `shared/types.ts`:

```ts
export type Session = {
  id: string
  title: string
  author: string
  filename: string
}
```

---

## PrototypeSlide (`client/src/components/slides/PrototypeSlide.tsx`)

The slide wrapper. Three-column flex layout filling the height below the toolbar.

```tsx
export function PrototypeSlide() {
  return (
    <div className="flex h-full overflow-hidden">
      <SessionsPanel />
      <ReadingPane />
      <BuddyPanel />
    </div>
  )
}
```

No state here yet. State management (active session, highlights) is added when the reading functionality is built.

---

## SessionsPanel (`client/src/components/prototype/SessionsPanel.tsx`)

A collapsible left panel that lists available sessions. Clicking a session is a no-op for now.

**Layout:**

- Expanded width: `var(--sidebar-width)` = 288px
- Collapsed width: `var(--sidebar-width-collapsed)` = 48px
- `bg-surface border-r border-border-soft h-full flex flex-col`
- CSS transition: `transition-[width] duration-200 overflow-hidden`

**Collapsed state:**

- Just a narrow strip with a `<ChevronRight>` icon button to expand, centered vertically

**Expanded state:**

- Toggle arrow (`<ChevronLeft>`) on the right edge of the panel to collapse — `text-text-tertiary`
- "Sessions" label: `text-text-tertiary text-xs uppercase tracking-widest px-4 pt-4 pb-2`
- Session list: fetched from `GET /sessions.json` on mount
  - Each row: title (`text-text-primary text-sm`) + author (`text-text-tertiary text-xs`) on two lines
  - Padding: `px-4 py-3`
  - Hover: `bg-state-hover cursor-pointer`
  - First session visually marked as active with `bg-state-pill`
  - Clicking a session: no-op for now (add a `// TODO: wire session switching` comment)
- Loading state: `text-text-tertiary text-xs px-4 py-3` "Loading..."
- Error state: `text-danger text-xs px-4 py-3` "Failed to load sessions"

**Internal state:** `isCollapsed: boolean` (starts expanded). Fetches `sessions.json` on mount with a plain `fetch('/sessions.json')`.

---

## ReadingPane — shell (`client/src/components/prototype/ReadingPane.tsx`)

An empty styled container. Placeholder only — no text loading, no selection logic.

```tsx
export function ReadingPane() {
  return (
    <div className="flex-1 overflow-y-auto scroll-area flex items-start justify-center px-10 py-10">
      <div className="max-w-2xl w-full">
        <p className="text-text-tertiary text-sm italic">
          Reading content will load here.
        </p>
      </div>
    </div>
  )
}
```

---

## BuddyPanel — shell (`client/src/components/prototype/BuddyPanel.tsx`)

An empty styled container. Placeholder only — no highlights, no API calls.

```tsx
export function BuddyPanel() {
  return (
    <div
      className="bg-surface border-l border-border-soft h-full flex items-center justify-center"
      style={{ width: '320px', flexShrink: 0 }}
    >
      <p className="text-text-tertiary text-sm text-center px-6">
        Highlight a passage to get started.
      </p>
    </div>
  )
}
```

---

## slides.config.tsx change

```tsx
import { PrototypeSlide } from '@/components/slides/PrototypeSlide'

// change the prototype entry:
{
  id: 'prototype',
  section: 'prototype',
  sectionLabel: 'Prototype',
  title: 'Prototype',
  isPrototype: true,
  component: PrototypeSlide,   // ← was PlaceholderSlide
},
```

---

## Constraints

- No interactive functionality — this is structure only
- No API calls except `GET /sessions.json` in SessionsPanel (static file fetch, not an Express route)
- The toolbar from DeckLayout must remain visible above — PrototypeSlide fills only the area below it
- The prototype slide is the only slide with internal scroll (reading pane) — all other slides remain no-scroll
- Do not start the dev server or test in a browser — Lucy will verify

---

## Out of scope

Everything interactive: text loading, selection, highlighting, articulation, buddy responses, facilitator chat, session switching. Those are future build sessions.
