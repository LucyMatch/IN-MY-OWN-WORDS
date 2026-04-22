# Plan 03 — Middle Pane: Bubble Flow

Read `BUILD_PLANS/context.md`, `BUILD_PLANS/STATE.md`, and `BUILD_PLANS/design-patterns.md` first.

**Prerequisite:** plan-02 is done. Highlights are created on mouseup and tracked in `PrototypeSlide` state. The `InYourOwnWordsPane` is currently a `w-0` shell.

---

## What this builds

The "In Your Own Words" pane becomes real. Users can write, stage, edit, and delete bubbles of their own understanding for an active highlight.

After this plan:

- **Active highlight concept.** Each highlight can be active; only one is active at a time. New highlights become active on creation. Clicking an existing mark in the reading pane makes it active. `activeHighlightId: string | null` lives in `PrototypeSlide`.
- **Pane auto-opens** on first highlight creation and when an existing highlight is clicked. Animates from collapsed width (60px — enough for the chevron) to 360px.
- **Pane content:** when a highlight is active, the pane shows that highlight's bubbles. When no highlight is active (but pane is expanded), shows a short instruction. A chevron on the pane header lets users manually collapse/expand.
- **When collapsed,** the pane keeps a narrow visible strip (60px wide) with the chevron so the user can always manually reopen. The pane is NEVER width zero — it always has presence on the page.
- **Bubble creation:** an empty input bubble sits at the TOP of the scrollable area with placeholder text. Pressing + stages the bubble; staged bubble appears BELOW the input; input clears for the next one.
- **Staged bubbles:** yellow background (same hue as the `--color-highlight` token). Edit (pencil) and delete (×) affordances. Edit toggles the bubble into an inline textarea; confirm (check) saves, cancel (×) reverts.
- **Commit button** fixed at the bottom of the pane (outside the scroll). Rendered but **disabled** in this plan; tooltip reads *"Facilitator response required to commit"*. Plan-04 wires the actual gating.
- **Highlight-to-bubble colour coupling.** A staged bubble's parent highlight stays yellow in the reading pane. (Committed visual state lands in plan-04 — a sage-green `--color-commit` token is added in this plan but isn't applied yet beyond the commit tick's hover colour.)

**What this plan does NOT do:**

- No Facilitator API calls. No `FacilitatorChat` component changes.
- No actual commit behaviour. The button is visually correct but inert.
- No Buddy panel changes.
- No persistence.

---

## Code patterns

Read `BUILD_PLANS/design-patterns.md` first. Patterns that apply here:

- Canonical component shape for every new component.
- `cn()` on every className.
- Raw `<button>` for bubble-internal actions (edit, delete, stage +). `Button` primitive for the commit tick at the bottom of the pane (it IS a standalone action button in the design system sense).
- Named group + `data-collapsed` on the pane root for the open/close animation — same pattern as `SessionsPanel`. Use `group/bubbles` to avoid collisions with `group/sessions`.
- Data-attributes for state-driven styling: `data-editing` on `StagedBubble` rather than conditional classes.

---

## New CSS layout variable

Add to the `:root` block in `client/src/styles/globals.css`:

```css
--bubbles-pane-width: 360px;
--bubbles-pane-width-collapsed: 60px;
```

Matches the existing pattern of `--sidebar-width` / `--sidebar-width-collapsed`.

---

## Data model evolution

### New `Bubble` type

Add to `shared/types.ts`:

```ts
/**
 * A single paraphrase-in-your-own-words for a highlight. Users can stage
 * multiple bubbles per highlight, edit, and delete them before committing.
 * The committed flag is wired in plan-04; this plan leaves it false.
 */
export type Bubble = {
  id: string
  text: string
  staged: boolean       // true once the + button has been pressed; false before
  committed: boolean    // plan-04 flips this to true on successful commit. Always false in plan-03.
  createdAt: string
}
```

### Update `Highlight` type

Replace `articulation: string | null` with `bubbles: Bubble[]`:

```ts
export type Highlight = {
  id: string
  sessionId: string
  ranges: HighlightRange[]
  text: string
  bubbles: Bubble[]     // was: articulation: string | null
  buddyResponses: BuddyResponse[]
  createdAt: string
}
```

**Don't change `ConsultRequest`.** It still has `articulation: string | null`. Plan-05 decides what gets sent (likely concatenated text from committed bubbles). Note-to-self for plan-05, not an action here.

### Update `ReadingPane` / `PrototypeSlide` consumers

- In `PrototypeSlide.handleMouseUp`, when a new highlight is created, initialise `bubbles: []` instead of `articulation: null`.

---

## New colour token

Add to `client/src/styles/globals.css`, inside the `@theme` block, near `--color-highlight`:

```css
--color-commit: oklch(0.82 0.08 150);   /* muted sage green — for committed state; tune on first sight */
```

Usage in this plan:

- The commit tick button's *hover* state uses `hover:text-commit`. The button is disabled so hover is moot, but defining it now means plan-04 doesn't touch this again.
- Not used elsewhere yet. Plan-04 applies it to the bubble/highlight on commit.

Design note: if the sage reads wrong against the warm page, try `oklch(0.78 0.10 145)` (bit more green, slightly darker). Or fall back to the accent orange. One-line change either way.

---

## State changes in `PrototypeSlide`

Add:

```tsx
const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null)
```

Wire:

- On new highlight creation, set active:
  ```tsx
  function addHighlight(h: Highlight) {
    setHighlights((prev) => [...prev, h])
    setActiveHighlightId(h.id)
  }
  ```
- On deletion of the active highlight, clear active:
  ```tsx
  function deleteHighlight(id: string) {
    setHighlights((prev) => prev.filter((h) => h.id !== id))
    setActiveHighlightId((prev) => (prev === id ? null : prev))
  }
  ```
- On session change, the existing `useEffect` clears highlights; also clear active:
  ```tsx
  useEffect(() => {
    setHighlights([])
    setActiveHighlightId(null)
  }, [activeSessionId])
  ```
- New handler: `onSetActiveHighlight(id: string | null)`. Passed to `ReadingPane` (for click-on-mark) and `InYourOwnWordsPane`.
- Bubble mutation handlers — kept in `PrototypeSlide` (single source of truth for highlight mutation):
  ```tsx
  function addBubble(highlightId: string, text: string) { /* ... */ }
  function updateBubble(highlightId: string, bubbleId: string, text: string) { /* ... */ }
  function deleteBubble(highlightId: string, bubbleId: string) { /* ... */ }
  ```
  Each is a `setHighlights((prev) => prev.map(...))` operation producing a new `Bubble[]` on the matching highlight. New bubbles from `addBubble`: `staged: true`, `committed: false`, fresh `crypto.randomUUID()`, fresh ISO `createdAt`.

Pass `activeHighlightId`, `onSetActiveHighlight`, `addBubble`, `updateBubble`, `deleteBubble` down to `InYourOwnWordsPane`. Pass `activeHighlightId` and `onSetActiveHighlight` to `ReadingPane`.

---

## `ReadingPane` — click-to-activate + active mark styling

Two additions.

### New props

```ts
activeHighlightId: string | null
onSetActiveHighlight: (id: string | null) => void
```

### Click handler on marks

Add `onClick={() => onSetActiveHighlight(h.id)}` on each `<mark>`. Two notes:

1. `onMouseUp` on the paragraphs root fires on any click in the text area. A bare click (no selection) makes `computeRangesFromSelection` return null → already a no-op. So click-on-mark will trigger activation AND the no-op mouseup. Fine.
2. Use `onClick`, NOT `onMouseDown` — clicks don't fire on drag-selects, only on true clicks. Prevents accidental activation mid-selection.

### Active mark styling

Add `data-active={h.id === activeHighlightId || undefined}` on each `<mark>`. Extend the class:

```tsx
className="bg-highlight cursor-pointer rounded-[2px] px-0.5 data-[active]:ring-2 data-[active]:ring-accent-strong/40"
```

The active mark gets a subtle orange ring — "this is the highlight the middle pane is showing." At 40% opacity it signals without overwhelming.

---

## `InYourOwnWordsPane` — full rewrite

Current: inert `w-0` div. Gets rewritten end-to-end.

### Props

```ts
type InYourOwnWordsPaneProps = {
  highlights: Highlight[]
  activeHighlightId: string | null
  onSetActiveHighlight: (id: string | null) => void
  onAddBubble: (highlightId: string, text: string) => void
  onUpdateBubble: (highlightId: string, bubbleId: string, text: string) => void
  onDeleteBubble: (highlightId: string, bubbleId: string) => void
}
```

### Internal state

```tsx
const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(false)
```

The user's manual override. The displayed state is a function of `isManuallyCollapsed` plus whether a highlight is active:

- If `isManuallyCollapsed === true` → collapsed (narrow strip).
- Else if `activeHighlightId !== null` → expanded with active highlight's bubbles.
- Else (no highlights yet, or active was cleared) → expanded with instruction text.

The pane is ALWAYS rendered. It's never width-zero. The default state is expanded. When the user manually collapses, it becomes a 60px strip with a chevron.

**Auto-expand on new active highlight:** when `activeHighlightId` changes from one non-null value to another (or from null to non-null), reset `isManuallyCollapsed` to false so the pane opens to show the new bubbles:

```tsx
useEffect(() => {
  if (activeHighlightId !== null) {
    setIsManuallyCollapsed(false)
  }
}, [activeHighlightId])
```

### Root layout

```tsx
<aside
  data-collapsed={isManuallyCollapsed || undefined}
  className={cn(
    'group/bubbles bg-surface border-border-soft flex h-full flex-shrink-0 flex-col overflow-hidden border-l transition-[width] duration-300',
    'w-[var(--bubbles-pane-width)] data-[collapsed]:w-[var(--bubbles-pane-width-collapsed)]',
  )}
>
  {/* collapsed-only chevron strip */}
  {/* expanded-only content */}
</aside>
```

### Collapsed-only strip

Shows only when the pane is collapsed. Narrow — just wide enough for the chevron to sit comfortably. Click to expand.

```tsx
<div className="hidden flex-col items-center pt-3 group-data-[collapsed]/bubbles:flex">
  <Button
    variant="ghost"
    size="icon"
    onClick={() => setIsManuallyCollapsed(false)}
    aria-label="Expand In Your Own Words pane"
  >
    <ChevronLeft className="size-4" />
  </Button>
</div>
```

(Chevron points LEFT when collapsed, indicating "push the pane open to the left.")

**Note for a later polish pass (not this plan):** this strip is where the staged/commit dots would live — per the wireframe — to indicate there's content inside. For now it's just the chevron. If the strip feels too empty during verification, we'll add a vertical "IN YOUR OWN WORDS" label or bubble-count dots in a small follow-up.

### Expanded-only content

Hidden when collapsed via `group-data-[collapsed]/bubbles:hidden`:

```tsx
<div className="flex h-full flex-col group-data-[collapsed]/bubbles:hidden">
  {/* Header */}
  {/* Scroll area */}
  {/* Commit footer */}
</div>
```

#### Header

```tsx
<div className="border-border-subtle flex items-center justify-between border-b px-4 py-3">
  <p className="text-text-tertiary text-xs uppercase tracking-widest">In Your Own Words</p>
  <Button
    variant="ghost"
    size="icon"
    onClick={() => setIsManuallyCollapsed(true)}
    aria-label="Collapse pane"
  >
    <ChevronRight className="size-4" />
  </Button>
</div>
```

Chevron points RIGHT when expanded, signalling "push the pane closed to the right."

#### Scroll area

```tsx
<div className="scroll-area flex-1 overflow-y-auto px-4 py-4">
  {activeHighlight ? (
    <>
      <EmptyInputBubble onStage={(text) => onAddBubble(activeHighlight.id, text)} />
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
</div>
```

`activeHighlight` is derived: `highlights.find((h) => h.id === activeHighlightId) ?? null`.

**Stack order:** empty input bubble at the very top. Staged bubbles stack BELOW it in insertion order (oldest just below the input, newest at the bottom). This is the native order of the `bubbles` array — no reversing.

#### Commit footer

Fixed at the bottom, outside the scroll:

```tsx
<div className="border-border-subtle border-t px-4 py-3">
  <Button
    variant="primary"
    disabled
    title="Facilitator response required to commit"
    className="w-full gap-2"
  >
    <Check className="size-4" />
    Commit
  </Button>
</div>
```

`title` is the native browser tooltip — fine for now. Base UI has a tooltip primitive we could swap in later; not worth the scope here.

`Check` is from `lucide-react`.

### `EmptyInputBubble` component

New component file: `client/src/components/prototype/EmptyInputBubble.tsx`.

A textarea styled as a bubble, with placeholder text and a + button bottom-right.

```tsx
import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

type EmptyInputBubbleProps = {
  onStage: (text: string) => void
}

export function EmptyInputBubble({ onStage }: EmptyInputBubbleProps) {
  const [value, setValue] = useState('')
  const canStage = value.trim().length > 0

  function handleStage() {
    if (!canStage) return
    onStage(value.trim())
    setValue('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleStage()
    }
  }

  return (
    <div className="bg-surface shadow-input mb-3 flex flex-col rounded-xl">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="In your own words…"
        rows={3}
        className="text-text-primary placeholder:text-text-tertiary resize-none border-none bg-transparent px-3 py-3 text-sm leading-snug outline-none"
      />
      <div className="flex justify-end p-2">
        <button
          type="button"
          onClick={handleStage}
          disabled={!canStage}
          aria-label="Stage this bubble"
          className={cn(
            'text-text-tertiary hover:bg-highlight hover:text-text-primary flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  )
}
```

Note the hover: `hover:bg-highlight` — the + button's hover matches the staged-bubble colour. Visual through-line between "I'm about to stage" and "this is what staged looks like."

### `StagedBubble` component

New component file: `client/src/components/prototype/StagedBubble.tsx`.

A filled bubble in `bg-highlight` yellow. Edit (pencil) and delete (×) buttons. Edit toggles inline editing state.

```tsx
import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Bubble } from '@shared/types'

type StagedBubbleProps = {
  bubble: Bubble
  onUpdate: (text: string) => void
  onDelete: () => void
}

export function StagedBubble({ bubble, onUpdate, onDelete }: StagedBubbleProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(bubble.text)

  function handleSave() {
    const trimmed = draft.trim()
    if (trimmed.length === 0) {
      // Empty save = delete
      onDelete()
      return
    }
    onUpdate(trimmed)
    setIsEditing(false)
  }

  function handleCancel() {
    setDraft(bubble.text)
    setIsEditing(false)
  }

  return (
    <div
      data-editing={isEditing || undefined}
      className={cn('bg-highlight mb-3 flex flex-col rounded-xl px-3 py-2')}
    >
      {isEditing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          autoFocus
          className="text-text-primary placeholder:text-text-tertiary resize-none border-none bg-transparent text-sm leading-snug outline-none"
        />
      ) : (
        <p className="text-text-primary text-sm leading-snug">{bubble.text}</p>
      )}
      <div className="mt-1 flex justify-end gap-1">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Cancel edit"
              className="text-text-tertiary hover:text-text-primary flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors"
            >
              <X className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={handleSave}
              aria-label="Save edit"
              className="text-text-tertiary hover:text-text-primary flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors"
            >
              <Check className="size-3.5" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              aria-label="Edit bubble"
              className="text-text-tertiary hover:text-text-primary flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete bubble"
              className="text-text-tertiary hover:text-danger flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
```

### `InstructionText` — no-active-highlight state

When the pane is expanded but no highlight is active, show instructional text in place of the bubble list. Can be inline inside `InYourOwnWordsPane.tsx`, no separate component needed:

```tsx
<div className="text-text-tertiary flex h-full flex-col items-center justify-center px-6 text-center text-sm">
  <p>Highlight some text to work on an understanding, or click an existing highlight to revisit it.</p>
</div>
```

Copy is placeholder — Lucy will tighten it. Shape is what matters.

---

## Files to create

```
client/src/components/prototype/EmptyInputBubble.tsx
client/src/components/prototype/StagedBubble.tsx
```

## Files to modify

```
shared/types.ts                                         ← add Bubble type, update Highlight.bubbles
client/src/styles/globals.css                           ← add --color-commit, --bubbles-pane-width, --bubbles-pane-width-collapsed
client/src/components/slides/PrototypeSlide.tsx         ← activeHighlightId state, bubble handlers, prop drilling
client/src/components/prototype/ReadingPane.tsx         ← click-to-activate on marks, active ring styling, new props
client/src/components/prototype/InYourOwnWordsPane.tsx  ← full rewrite: header, scroll area, commit footer, integrates EmptyInputBubble + StagedBubble
```

---

## Constraints

- **No Facilitator API calls.** Plan-04 wires that.
- **No persistence.** Plan-06 wires that.
- **Commit button is disabled and inert.** Tooltip only.
- **Pane is never width zero.** Always at least 60px (collapsed strip). User must always see a chevron to expand.
- **Match `BUILD_PLANS/design-patterns.md`** — use `cn()`, data-attributes for state, named groups for collapse.
- **Reading pane is still the primary scroll** — plus the middle pane's bubble list. Two scrollable regions total.
- **Don't start the dev server.** Lucy verifies visually.

---

## Out of scope

- Facilitator wire-up (plan 04)
- Actual commit behaviour, committed visual state on bubble + highlight (plan 04)
- Buddy wire-up (plan 05)
- Persistence (plan 06)
- Staged/commit dots on the collapsed strip (nice-to-have, parked)
- Overlap resolution for highlights (parked)
- Bubble drag-to-reorder (not planned)
- Rich text in bubbles (not planned)

---

## Definition of done

- `shared/types.ts` has the new `Bubble` type; `Highlight.bubbles: Bubble[]` replaces `articulation`.
- `client/src/styles/globals.css` has `--color-commit` in `@theme`, and `--bubbles-pane-width` + `--bubbles-pane-width-collapsed` in `:root`.
- `PrototypeSlide` owns `activeHighlightId`, resets it on session switch and on delete of the active highlight, passes all new props down.
- `ReadingPane` marks are clickable to activate; active mark has the subtle orange ring.
- `InYourOwnWordsPane`:
  - Always rendered with non-zero width. Collapsed = 60px strip with chevron. Expanded = 360px with full content.
  - Auto-expands when `activeHighlightId` changes to a non-null value.
  - Manual collapse/expand via the chevron works.
  - When expanded with an active highlight: empty input at top, staged bubbles stack below in insertion order.
  - When expanded with no active highlight: shows instruction text.
- Adding a bubble: type → + → bubble stages below input, input clears.
- Editing a staged bubble: pencil → inline textarea → check saves, × cancels. Empty save deletes.
- Deleting a staged bubble: × removes it from the highlight's bubbles array.
- Commit footer renders the disabled button with native tooltip *"Facilitator response required to commit"*.
- Session switch clears highlights AND active highlight id. Pane collapses to its narrow strip (manual state persists, but since nothing's highlighted anymore, instruction text shows when expanded).
- No console errors.
- `npm run typecheck` passes for both workspaces.
- `BUILD_PLANS/STATE.md` updated — plan-03 done, plan-04 next.
- Summary includes: whether the 60px collapsed strip feels right (or needs more like 48px / 80px); whether the open/close animation at 300ms feels right; whether the bubble stack order (oldest-nearest-input, newest-at-bottom) reads naturally; whether the active-mark ring is readable without being overbearing; any interaction oddness around clicking a mark that's inside a prior selection.
