# Plan 11 — Deck Strip-Down + Final Copy + Resize-Aware Delete Button

Read `BUILD_PLANS/context.md`, `BUILD_PLANS/STATE.md`, and `BUILD_PLANS/design-patterns.md` first.

**Prerequisite:** all prototype build plans complete (00–10). This plan touches deck-level code (slide files, `slides.config.tsx`, `Toolbar.tsx`) and one prototype fix (`ReadingPane.tsx` delete-button resize).

---

## What this does

Final housekeeping before code freeze:

1. **Strip the deck to four slides only:** Title, Concept, Prototype Viewing Guide, Prototype.
2. **Rewrite the copy** on Title, Concept, and create the new Viewing Guide slide.
3. **Restructure the toolbar:** Jump to Prototype becomes a filled orange primary button in the centre. Arrows + slide counter move to the left, next to the section label. Section label always reads "CONTEXT" (unless on the prototype slide, where it reads "PROTOTYPE").
4. **Delete the orphan slide files** that no longer belong.
5. **Rolling up feature-01:** × delete buttons on highlights re-position correctly when the viewport or pane widths change. (Currently drifts because `useLayoutEffect` only runs on content changes, not resize.)

The deck matches what Lucy will talk through in the video. No slides after the Prototype. No orphan files. Highlight delete buttons stay pinned to their marks when the layout shifts.

---

## Slide copy (source of truth)

### 1. TitleSlide — rewrite copy, keep file

```
SUBHEADER  (small caps, tertiary text):    Anthropic Education Labs Take Home Assignment
TITLE      (serif, large):                 In Your Own Words
HOOK       (secondary text, medium):       AI Facilitated Feynman Technique
BYLINE     (tertiary, small):              Lucy Matchett · 2026
```

### 2. ConceptSlide — rewrite copy, keep file

```
[centred vertically and horizontally on the slide]

AKA EXPLAIN IT LIKE I'M FIVE, BUT MAKE IT AI
     [subtle horizontal divider]
AKA THE FEYNMAN METHOD, BUT MAKE IT AI
```

Visual punctuation between the two lines — a short centred divider (decorative, 120px wide border, tertiary colour). Each AKA is its own block. Same font/size/weight for both, so they feel like parallel statements.

### 3. ViewingGuideSlide — NEW FILE

```
TITLE: Prototype Viewing Guide

INTRO BULLETS (always visible):
- Desktop viewing
- Only tested in Firefox
- Reminder: this isn't an annotation tool — the "In Your Own Words" feature just lives inside one

HOW TO USE (collapsible, closed by default — chevron + label, click to expand):
- Select a session on the far left (Romeo & Juliet or Pride & Prejudice)
- Highlight a section of text you want to explain
- Write your understanding in the "In Your Own Words" pane, in your own words. Hit + when ready to review.
- Chat responds to your explanation and guides you through refinement
- Talk to chat to workshop your thoughts
- Stuck? Select a context lens on the right pane — it'll explain from a different angle or analogy to help you unstick
- Add another "In Your Own Words" description any time, hit + to stage it. Add as many as you like.
- When your explanation feels refined and comprehensive, commit — this saves it as a refined understanding
- Commit is unavailable until the chat facilitator agrees your understanding is solid. You can bypass this with the text link under the button.
- Not committing still stores your explanation, just marked as staged (shown in a different colour)
- Click any existing highlight to view its previous descriptions
```

---

## File changes

### Delete (no archive — clean repo)

```
client/src/components/slides/UserJourneySlide.tsx
client/src/components/slides/ConsiderationsSlide.tsx
client/src/components/slides/NextStepsSlide.tsx
```

### Create

```
client/src/components/slides/ViewingGuideSlide.tsx
```

### Modify

```
client/src/slides.config.tsx                              ← Remove 3 slides + imports, add ViewingGuide, section label logic
client/src/components/slides/TitleSlide.tsx               ← New copy
client/src/components/slides/ConceptSlide.tsx             ← New copy + layout
client/src/components/deck/Toolbar.tsx                    ← Restructure: CTA centre, arrows left with section label
client/src/components/prototype/ReadingPane.tsx           ← Extract marker-position measurement into a useCallback; add ResizeObserver
```

No type changes. No shared/ changes. No server changes.

---

## Implementation notes

### `slides.config.tsx` — final state

```tsx
import { PlaceholderSlide } from '@/components/slides/PlaceholderSlide'
import { PrototypeSlide } from '@/components/slides/PrototypeSlide'
import { TitleSlide } from '@/components/slides/TitleSlide'
import { ConceptSlide } from '@/components/slides/ConceptSlide'
import { ViewingGuideSlide } from '@/components/slides/ViewingGuideSlide'

export type SlideSection = 'context' | 'prototype'

export type SlideConfig = {
  id: string
  section: SlideSection
  sectionLabel: string
  title: string
  isPrototype?: boolean
  component: React.ComponentType
}

export const SLIDES: SlideConfig[] = [
  {
    id: 'title',
    section: 'context',
    sectionLabel: 'Context',
    title: 'Title',
    component: TitleSlide,
  },
  {
    id: 'concept',
    section: 'context',
    sectionLabel: 'Context',
    title: 'Concept',
    component: ConceptSlide,
  },
  {
    id: 'viewing-guide',
    section: 'context',
    sectionLabel: 'Context',
    title: 'Prototype Viewing Guide',
    component: ViewingGuideSlide,
  },
  {
    id: 'prototype',
    section: 'prototype',
    sectionLabel: 'Prototype',
    title: 'Prototype',
    isPrototype: true,
    component: PrototypeSlide,
  },
]
```

Notes:
- `SlideSection` union narrowed from five to two (`'context' | 'prototype'`).
- Every non-prototype slide has `sectionLabel: 'Context'`; the prototype has `'Prototype'`.
- Remove imports for `UserJourneySlide`, `ConsiderationsSlide`, `NextStepsSlide`.
- `PlaceholderSlide` import stays if still used elsewhere — don't remove unless Claude Code confirms it's unreferenced.

### `TitleSlide.tsx` — new copy

```tsx
export function TitleSlide() {
  return (
    <div className="h-full w-full flex items-center justify-center overflow-y-auto">
      <div className="text-center px-16 py-12">
        <p className="text-text-tertiary text-xs uppercase tracking-widest mb-6">
          Anthropic Education Labs Take Home Assignment
        </p>
        <h1 className="font-serif text-6xl text-text-primary mb-5">In Your Own Words</h1>
        <p className="text-xl text-text-secondary mb-6">AI Facilitated Feynman Technique</p>
        <p className="text-sm text-text-tertiary">Lucy Matchett · 2026</p>
      </div>
    </div>
  )
}
```

### `ConceptSlide.tsx` — new copy + layout

```tsx
export function ConceptSlide() {
  return (
    <div className="h-full w-full flex items-center justify-center overflow-y-auto">
      <div className="text-center px-16 py-12 max-w-3xl">
        <p className="font-serif text-3xl text-text-primary uppercase tracking-wide">
          Aka explain it like I'm five, but make it AI
        </p>
        <div className="border-border-subtle mx-auto my-10 w-[120px] border-t" />
        <p className="font-serif text-3xl text-text-primary uppercase tracking-wide">
          Aka the Feynman method, but make it AI
        </p>
      </div>
    </div>
  )
}
```

Size (`text-3xl`) is readable. Bump to `text-4xl` if it feels small after ship.

### `ViewingGuideSlide.tsx` — new file

```tsx
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ViewingGuideSlide() {
  const [isGuideOpen, setIsGuideOpen] = useState(false)

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-16 py-12">
        <p className="text-text-tertiary text-xs uppercase tracking-widest mb-2">Viewing Guide</p>
        <h2 className="font-serif text-4xl text-text-primary mb-8">Prototype Viewing Guide</h2>

        <ul className="space-y-3 text-text-secondary text-base leading-relaxed mb-10 list-disc pl-5">
          <li>Desktop viewing</li>
          <li>Only tested in Firefox</li>
          <li>
            Reminder: this isn't an annotation tool — the "In Your Own Words" feature just
            lives inside one
          </li>
        </ul>

        <button
          type="button"
          onClick={() => setIsGuideOpen((v) => !v)}
          className={cn(
            'text-text-primary hover:text-accent-strong flex items-center gap-2 text-sm cursor-pointer transition-colors',
          )}
          aria-expanded={isGuideOpen}
        >
          <span className="uppercase tracking-widest text-xs">How to use</span>
          <ChevronDown
            className={cn('size-4 transition-transform', isGuideOpen && 'rotate-180')}
          />
        </button>

        {isGuideOpen && (
          <ol className="mt-6 space-y-3 text-text-secondary text-sm leading-relaxed list-decimal pl-5">
            <li>Select a session on the far left (Romeo &amp; Juliet or Pride &amp; Prejudice)</li>
            <li>Highlight a section of text you want to explain</li>
            <li>
              Write your understanding in the "In Your Own Words" pane, in your own words.
              Hit + when ready to review.
            </li>
            <li>Chat responds to your explanation and guides you through refinement</li>
            <li>Talk to chat to workshop your thoughts</li>
            <li>
              Stuck? Select a context lens on the right pane — it'll explain from a different
              angle or analogy to help you unstick
            </li>
            <li>
              Add another "In Your Own Words" description any time, hit + to stage it. Add as
              many as you like.
            </li>
            <li>
              When your explanation feels refined and comprehensive, commit — this saves it
              as a refined understanding
            </li>
            <li>
              Commit is unavailable until the chat facilitator agrees your understanding is
              solid. You can bypass this with the text link under the button.
            </li>
            <li>
              Not committing still stores your explanation, just marked as staged (shown in a
              different colour)
            </li>
            <li>Click any existing highlight to view its previous descriptions</li>
          </ol>
        )}
      </div>
    </div>
  )
}
```

### `Toolbar.tsx` — restructure

**Current layout:**
- LEFT: `In Your Own Words` brand link + `|` + section label
- CENTER (absolute): arrows + counter
- RIGHT: spacer + "Jump to prototype" (ghost text) + hamburger

**New layout:**
- LEFT: brand link + `|` + section label ("CONTEXT" or "PROTOTYPE", fixed-width) + arrows + counter
- CENTER (absolute): `Jump to Prototype` primary orange button
- RIGHT: hamburger only

**Fixed-width wrapper on section label** prevents the arrows jittering when label text switches between "CONTEXT" (7 chars) and "PROTOTYPE" (9 chars). Wrap the label in `min-w-[96px] inline-block`. Adjust to 100px or 104px if truncation happens — eyeball and tune.

```tsx
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useDeck } from '@/context/DeckContext'

export function Toolbar() {
  const { activeIndex, slides, goTo, goNext, goPrev, goToPrototype, isNavMenuOpen, setNavMenuOpen } = useDeck()

  const currentSlide = slides[activeIndex]
  const isFirst = activeIndex === 0
  const isLast = activeIndex === slides.length - 1
  const isOnPrototype = currentSlide.isPrototype === true

  return (
    <header
      className="relative flex w-full items-center border-b border-border-soft bg-surface px-4 shrink-0"
      style={{ height: 'var(--header-height)' }}
    >
      {/* Left zone — brand, section label (fixed-width), arrows + counter */}
      <div className="flex-1 flex items-center gap-2">
        <button
          onClick={() => goTo(0)}
          className="font-serif text-text-primary text-sm font-medium hover:opacity-70 transition-opacity cursor-pointer"
          aria-label="Go to home slide"
        >
          In Your Own Words
        </button>
        <span className="text-text-tertiary text-xs select-none">|</span>
        <span className="text-text-tertiary text-xs uppercase tracking-wide min-w-[96px] inline-block">
          {currentSlide.sectionLabel}
        </span>
        <div className="flex items-center gap-2 ml-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={goPrev}
            disabled={isFirst}
            aria-label="Previous slide"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-text-tertiary text-xs tabular-nums w-8 text-center">
            {activeIndex + 1} / {slides.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={goNext}
            disabled={isLast}
            aria-label="Next slide"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Center zone — Jump to Prototype CTA */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <Button
          variant="primary"
          size="sm"
          onClick={goToPrototype}
          disabled={isOnPrototype}
        >
          Jump to Prototype
        </Button>
      </div>

      {/* Right zone — hamburger */}
      <div className="flex-1 flex items-center justify-end">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setNavMenuOpen(!isNavMenuOpen)}
          aria-label={isNavMenuOpen ? 'Close slide menu' : 'Open slide menu'}
        >
          <Menu className="size-4" />
        </Button>
      </div>
    </header>
  )
}
```

Key: `variant="primary"` maps to `bg-accent-strong text-white hover:opacity-90` in `Button.tsx` — confirmed. Same orange as the Commit button. No className override needed.

### `ReadingPane.tsx` — resize-aware delete button (rolling up feature-01)

**The problem:** the × delete button next to each highlight is positioned with a `useLayoutEffect` that runs only when `highlights` or `text` change. When the viewport resizes, or when a pane collapses/expands (sessions, IYOW, lens), the `<mark>` elements reflow but the × buttons stay frozen at their old `offsetTop` — they drift out of alignment.

**The fix:** extract the measurement logic into a `useCallback` so both the existing `useLayoutEffect` and a new `ResizeObserver` can call it. The observer fires whenever the reading pane's container resizes for any reason (window resize, pane collapse/expand, font reflow).

Current code (relevant excerpt):

```tsx
const [markerPositions, setMarkerPositions] = useState<Record<string, number>>({})

useLayoutEffect(() => {
  if (!paragraphsRootRef.current) return
  const root = paragraphsRootRef.current
  const next: Record<string, number> = {}
  for (const h of highlights) {
    const firstRange = h.ranges[0]
    if (!firstRange) continue
    const mark = root.querySelector<HTMLElement>(`[data-highlight-id="${h.id}"]`)
    if (!mark) continue
    next[h.id] = mark.offsetTop
  }
  setMarkerPositions(next)
}, [highlights, text])
```

**New pattern:**

```tsx
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
// ... other imports unchanged

const [markerPositions, setMarkerPositions] = useState<Record<string, number>>({})

const recomputeMarkerPositions = useCallback(() => {
  if (!paragraphsRootRef.current) return
  const root = paragraphsRootRef.current
  const next: Record<string, number> = {}
  for (const h of highlights) {
    const firstRange = h.ranges[0]
    if (!firstRange) continue
    const mark = root.querySelector<HTMLElement>(`[data-highlight-id="${h.id}"]`)
    if (!mark) continue
    next[h.id] = mark.offsetTop
  }
  setMarkerPositions(next)
}, [highlights])

// Existing content-change trigger
useLayoutEffect(() => {
  recomputeMarkerPositions()
}, [recomputeMarkerPositions, text])

// NEW: resize-change trigger
useEffect(() => {
  if (!paragraphsRootRef.current) return
  const observer = new ResizeObserver(() => {
    recomputeMarkerPositions()
  })
  observer.observe(paragraphsRootRef.current)
  return () => observer.disconnect()
}, [recomputeMarkerPositions])
```

**Why ResizeObserver and not `window.addEventListener('resize')`:**
- The reading pane can change width WITHOUT the window resizing — when Sessions, IYOW, or Lens panes collapse/expand.
- `ResizeObserver` fires whenever the observed element's size changes, from any cause. Right primitive for this.

**Performance:** `ResizeObserver` is cheap. `offsetTop` reads are sub-millisecond even for 10+ highlights. No throttle needed.

**If a `ResizeObserver` loop warning appears in the console** (can happen if the callback triggers another layout that fires the observer again), wrap the callback in `requestAnimationFrame`:

```tsx
const observer = new ResizeObserver(() => {
  requestAnimationFrame(() => recomputeMarkerPositions())
})
```

Only add the rAF wrap if the warning actually appears. Don't pre-optimise.

---

## Constraints

- **Keep it simple.** No new dependencies. No animation library.
- **Copy is the source of truth** — don't paraphrase.
- **Chevron-collapse default on Viewing Guide:** CLOSED.
- **Section label is ALWAYS "Context" or "Prototype"** — no other variants.
- **Fixed-width section-label wrapper** — arrows must not shift horizontally.
- **CTA button is `variant="primary"`** — confirmed from `Button.tsx`. No override needed.
- **ResizeObserver cleanup on unmount** via the effect return — don't leak observers.
- **Don't start the dev server.** Lucy verifies visually.

---

## Out of scope

- Any other prototype logic changes.
- Design system changes.
- DeckContext refactor.
- Keyboard shortcuts.
- Animation on the Viewing Guide collapse.
- Slide transitions.
- Archiving `feature-01-resize-aware-delete-button.md` — leave it in BUILD_PLANS/ but STATE.md should note it's resolved as part of plan-11.

---

## Definition of done

- `slides.config.tsx` exports exactly four slides: Title, Concept, Viewing Guide, Prototype. In that order.
- All three non-prototype slides have `sectionLabel: 'Context'`.
- The prototype slide has `sectionLabel: 'Prototype'`.
- `UserJourneySlide.tsx`, `ConsiderationsSlide.tsx`, `NextStepsSlide.tsx` files are deleted.
- `ViewingGuideSlide.tsx` exists with working expand/collapse, default closed.
- `TitleSlide.tsx` and `ConceptSlide.tsx` show new copy, no placeholder text.
- Toolbar layout:
  - LEFT: brand link | CONTEXT/PROTOTYPE (fixed-width) + arrows + counter
  - CENTER: filled orange "Jump to Prototype" CTA
  - RIGHT: hamburger only
- Toolbar arrows do NOT shift horizontally when moving between slides.
- `ReadingPane.tsx`:
  - `recomputeMarkerPositions` extracted as a `useCallback`.
  - Existing `useLayoutEffect` uses the callback.
  - New `useEffect` sets up a `ResizeObserver` on `paragraphsRootRef.current`, calls the callback on resize, cleans up on unmount.
  - Resizing the browser window → × buttons track their highlights.
  - Collapsing/expanding any pane (Sessions, IYOW, Lens) → × buttons track their highlights.
  - No `ResizeObserver` loop warnings in console.
- `npm run typecheck` passes both workspaces.
- The slide counter shows `1 / 4` on Title and `4 / 4` on Prototype.
- Nav menu lists exactly four items.
- `BUILD_PLANS/STATE.md` updated — plan-11 done, deck finalised, feature-01 resolved.
- `BUILD_PLANS/TEST_LIST.md` updated:
  - ADD: "ConceptSlide line size at presentation display" — if text-3xl looks small, bump to text-4xl.
  - ADD: "Section label fixed-width calibration" — verify 96px is enough for "PROTOTYPE" without truncation.
  - REMOVE / mark resolved: any × button drift items — addressed by the ResizeObserver.
- Summary includes:
  - Whether the three file deletions surfaced any orphan imports.
  - Whether `variant="primary"` produced the filled orange button as expected.
  - Whether the arrows stayed put when switching between Context and Prototype slides.
  - Whether the chevron rotation on the Viewing Guide collapse looks right.
  - Whether the × delete buttons correctly track their highlights when the viewport resizes and when panes collapse/expand.
  - Whether any `ResizeObserver` loop warnings appeared in console (and if so, whether the rAF wrap was applied).
