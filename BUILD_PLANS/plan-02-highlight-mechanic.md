# Plan 02 — Highlight Mechanic

Read `BUILD_PLANS/context.md`, `BUILD_PLANS/STATE.md`, and `BUILD_PLANS/design-patterns.md` first.

**Prerequisite:** plan-01 is done. `PrototypeSlide` exists and renders the four-zone layout; `ReadingPane` renders session text as paragraphs; `InYourOwnWordsPane` is a collapsed shell.

---

## What this builds

The core interaction of the prototype: **text selection → visible highlight in the reading pane → × delete button in the left margin**.

After this plan:
- User selects text in the reading pane. On mouseup, a yellow `<mark>` wraps the selection.
- Selections that span multiple paragraphs are stored as ONE highlight with multiple visual ranges (one per paragraph). The paragraph-break whitespace between marks stays unhighlighted.
- A small × button appears in the left margin beside the first range of each highlight. Clicking it deletes the entire highlight.
- Highlights live in `PrototypeSlide` state, scoped to the active session. Session switch clears them (persistence lands in plan-06).

**What this plan does NOT do:**
- No middle pane reaction. `InYourOwnWordsPane` stays collapsed — plan-03 handles the auto-open and bubble flow.
- No API calls.
- No persistence.
- No edit/expand of the highlighted range after creation.

---

## Code patterns

**Read `BUILD_PLANS/design-patterns.md` first.** Patterns that apply here:

- Canonical component shape for any new component.
- `cn()` on every className.
- Data-attributes for state-driven styling where useful (e.g. a highlight might get `data-highlight-id` for CSS targeting, though the ID is more for hit-testing).
- Raw `<button>` for the margin × delete control (it's a row-adjacent control, not a design-system button).

---

## The data model

This plan evolves `shared/types.ts`. The current `Highlight` type has `text`, `articulation`, `buddyResponses`, `createdAt`. We keep all of those. We add **ranges**.

### Add `HighlightRange` type

```ts
/**
 * One visual range of a highlight. A highlight that spans paragraphs has
 * multiple ranges, one per paragraph it touches. Offsets are relative to
 * the paragraph's text content (after paragraph splitting in ReadingPane).
 */
export type HighlightRange = {
  paragraphIndex: number
  start: number           // inclusive char offset within the paragraph
  end: number             // exclusive char offset within the paragraph
}
```

### Update `Highlight` type

```ts
export type Highlight = {
  id: string
  sessionId: string
  /**
   * Visual ranges. Length 1 for single-paragraph selections, N for multi.
   * Order reflects reading order (first range is topmost on the page).
   */
  ranges: HighlightRange[]
  /**
   * The full selected text, concatenated across ranges with \n\n between
   * paragraph boundaries. This is what we send to Facilitator/Buddies.
   */
  text: string
  articulation: string | null     // stays for now — plan-03 evolves to bubbles
  buddyResponses: BuddyResponse[]
  createdAt: string
}
```

### Why this shape

- One highlight = one logical selection, regardless of paragraph count.
- `ranges` is a pure-data description of what to render. No DOM coupling.
- Rendering is a function of `(paragraph text, ranges for that paragraph)`. Deterministic, session-switch-safe, persistence-safe.

---

## State placement

State for highlights lives in `PrototypeSlide` alongside `activeSessionId`. Session-scoped (cleared when session changes).

Add to `PrototypeSlide`:

```tsx
const [highlights, setHighlights] = useState<Highlight[]>([])

// Clear highlights when the active session changes.
useEffect(() => {
  setHighlights([])
}, [activeSessionId])

function addHighlight(h: Highlight) {
  setHighlights((prev) => [...prev, h])
}

function deleteHighlight(id: string) {
  setHighlights((prev) => prev.filter((h) => h.id !== id))
}
```

Pass `highlights`, `addHighlight`, and `deleteHighlight` to `ReadingPane` as props.

---

## Files to modify

```
shared/types.ts                                        ← add HighlightRange, update Highlight
client/src/components/slides/PrototypeSlide.tsx        ← highlights state, handlers, pass to ReadingPane
client/src/components/prototype/ReadingPane.tsx        ← selection capture, highlight rendering, × delete button
```

## Files to create

```
client/src/lib/highlights.ts        ← pure helper functions (selection → ranges, concat text, render helper)
```

---

## `client/src/lib/highlights.ts` — the helper module

Pure functions. No React, no DOM mutation. Unit-testable in isolation.

```ts
import type { Highlight, HighlightRange } from '@shared/types'

/**
 * Split text into paragraphs the same way ReadingPane does.
 * Returns the array of paragraph strings, with the chapter/scene heading
 * as block 0.
 */
export function splitIntoParagraphs(text: string): string[] {
  return text ? text.split(/\n\n+/) : []
}

/**
 * Given the list of paragraphs and the current window.getSelection(),
 * compute the HighlightRange[] for the selection.
 *
 * Returns null if the selection is empty or doesn't fall within the
 * expected paragraph elements (see `paragraphRoot` below).
 *
 * Expects each rendered paragraph to have `data-paragraph-index={i}`.
 */
export function computeRangesFromSelection(
  paragraphs: string[],
  paragraphRoot: HTMLElement,
): HighlightRange[] | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null

  const range = sel.getRangeAt(0)

  // Walk up from startContainer / endContainer to find their paragraph <p>.
  const startP = findParagraphAncestor(range.startContainer, paragraphRoot)
  const endP = findParagraphAncestor(range.endContainer, paragraphRoot)
  if (!startP || !endP) return null

  const startIdx = Number(startP.dataset.paragraphIndex)
  const endIdx = Number(endP.dataset.paragraphIndex)
  if (Number.isNaN(startIdx) || Number.isNaN(endIdx)) return null

  // Normalize (user could have selected bottom-to-top).
  const [lowIdx, highIdx] =
    startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx]

  const startOffsetInPara =
    startIdx <= endIdx
      ? offsetWithinParagraph(startP, range.startContainer, range.startOffset)
      : offsetWithinParagraph(endP, range.endContainer, range.endOffset)
  const endOffsetInPara =
    startIdx <= endIdx
      ? offsetWithinParagraph(endP, range.endContainer, range.endOffset)
      : offsetWithinParagraph(startP, range.startContainer, range.startOffset)

  const ranges: HighlightRange[] = []

  if (lowIdx === highIdx) {
    // Single paragraph
    const [s, e] =
      startOffsetInPara <= endOffsetInPara
        ? [startOffsetInPara, endOffsetInPara]
        : [endOffsetInPara, startOffsetInPara]
    if (s === e) return null
    ranges.push({ paragraphIndex: lowIdx, start: s, end: e })
  } else {
    // Multi-paragraph — first, middles (whole), last
    ranges.push({
      paragraphIndex: lowIdx,
      start: startOffsetInPara,
      end: paragraphs[lowIdx].length,
    })
    for (let i = lowIdx + 1; i < highIdx; i++) {
      ranges.push({ paragraphIndex: i, start: 0, end: paragraphs[i].length })
    }
    ranges.push({ paragraphIndex: highIdx, start: 0, end: endOffsetInPara })
  }

  return ranges
}

/**
 * Build the `text` field for a Highlight from its ranges and the paragraph
 * array. Concatenates ranges with '\n\n' between paragraph boundaries.
 */
export function buildHighlightText(
  paragraphs: string[],
  ranges: HighlightRange[],
): string {
  return ranges
    .map((r) => paragraphs[r.paragraphIndex].slice(r.start, r.end))
    .join('\n\n')
}

/**
 * Render a single paragraph's content, splitting around any ranges that
 * belong to it. Returns a flat array of React nodes: plain strings for
 * unhighlighted text, <mark> elements for highlighted.
 *
 * Exposed here so ReadingPane stays declarative. Keep this pure —
 * no event handlers, no refs. ReadingPane wires behaviour.
 */
export function segmentParagraph(
  paragraphText: string,
  rangesForParagraph: Array<HighlightRange & { highlightId: string }>,
): Array<
  | { type: 'text'; text: string }
  | { type: 'mark'; text: string; highlightId: string }
> {
  if (rangesForParagraph.length === 0) {
    return [{ type: 'text', text: paragraphText }]
  }

  // Sort by start offset. We assume ranges don't overlap within a paragraph
  // for a single highlight (they can't — each range belongs to one paragraph).
  // Cross-highlight overlap is out of scope per the design decision.
  const sorted = [...rangesForParagraph].sort((a, b) => a.start - b.start)

  const segments: Array<
    | { type: 'text'; text: string }
    | { type: 'mark'; text: string; highlightId: string }
  > = []
  let cursor = 0
  for (const r of sorted) {
    if (r.start > cursor) {
      segments.push({ type: 'text', text: paragraphText.slice(cursor, r.start) })
    }
    segments.push({
      type: 'mark',
      text: paragraphText.slice(r.start, r.end),
      highlightId: r.highlightId,
    })
    cursor = r.end
  }
  if (cursor < paragraphText.length) {
    segments.push({ type: 'text', text: paragraphText.slice(cursor) })
  }
  return segments
}

// ----- internal helpers -----

function findParagraphAncestor(
  node: Node,
  root: HTMLElement,
): HTMLElement | null {
  let n: Node | null = node
  while (n && n !== root) {
    if (
      n.nodeType === Node.ELEMENT_NODE &&
      (n as HTMLElement).dataset.paragraphIndex !== undefined
    ) {
      return n as HTMLElement
    }
    n = n.parentNode
  }
  return null
}

/**
 * Compute the character offset of (node, offset) within the paragraph
 * element's plain text content. Walks text nodes in document order.
 */
function offsetWithinParagraph(
  paragraph: HTMLElement,
  node: Node,
  offset: number,
): number {
  let total = 0
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
  let current: Node | null = walker.nextNode()
  while (current) {
    if (current === node) return total + offset
    total += current.textContent?.length ?? 0
    current = walker.nextNode()
  }
  // Fallback: if the node wasn't found (e.g. caret at end after a <mark>),
  // cap at the paragraph's full length.
  return Math.min(total, paragraph.textContent?.length ?? 0)
}
```

### Why it's shaped this way

- **Pure functions.** Can be refined / fixed without touching ReadingPane.
- **Offsets are paragraph-relative.** Matches how ReadingPane renders (one `<p>` per block).
- **`data-paragraph-index` attribute** is the anchor between DOM and data. ReadingPane sets it; the helper reads it.
- **Multi-paragraph handling** fans out in `computeRangesFromSelection` — first paragraph gets `start → paragraph end`, middles get the whole paragraph, last gets `0 → end`.
- **`segmentParagraph`** is the inverse: given ranges, produce the chunks to render.

---

## `ReadingPane` — changes

The rendering gets more complex. Instead of each paragraph being a plain `<p>{block}</p>`, each paragraph renders as a `<p>` containing a mix of text and `<mark>` elements.

### New props

```ts
type ReadingPaneProps = {
  session: Session | null
  text: string
  loading: boolean
  highlights: Highlight[]            // NEW
  onAddHighlight: (h: Highlight) => void    // NEW
  onDeleteHighlight: (id: string) => void   // NEW
}
```

### The paragraph container

The paragraphs need to live inside an element with a ref, so we can pass it as `paragraphRoot` to the helper.

```tsx
const paragraphsRootRef = useRef<HTMLDivElement>(null)
```

Wrap the paragraph mapping in a `<div ref={paragraphsRootRef}>`. The title block stays outside this ref.

### Capturing selection

On `mouseup` within the paragraph root, compute the ranges and create a highlight:

```tsx
function handleMouseUp() {
  if (!paragraphsRootRef.current) return
  const ranges = computeRangesFromSelection(paragraphs, paragraphsRootRef.current)
  if (!ranges || ranges.length === 0) return
  if (!activeSession) return   // defensive

  const newHighlight: Highlight = {
    id: crypto.randomUUID(),
    sessionId: activeSession.id,
    ranges,
    text: buildHighlightText(paragraphs, ranges),
    articulation: null,
    buddyResponses: [],
    createdAt: new Date().toISOString(),
  }
  onAddHighlight(newHighlight)

  // Clear the browser selection so the yellow takes over cleanly
  window.getSelection()?.removeAllRanges()
}
```

Attach `onMouseUp={handleMouseUp}` to the paragraphs root div (NOT the outer scroll container — we only care about selections inside the text).

**Note on `activeSession`:** `ReadingPane` doesn't receive `activeSession` directly by that name — it receives `session`. Use `session` here. Adjust accordingly.

### Rendering paragraphs with highlights

For each paragraph, find the ranges that belong to it, annotate each range with its parent highlight's id, and segment:

```tsx
// blocks is the split-paragraphs array (same as before)
const paragraphs = blocks.slice(1)      // block 0 is the chapter heading
// Note: paragraphIndex in ranges is into `blocks`, NOT `paragraphs` — check this
```

**Important decision — paragraph index basis.** The chapter/scene heading is rendered as `<h2>` and the rest as `<p>`. We need to pick which of these `paragraphIndex` counts against.

**Pick: `paragraphIndex` refers to the `blocks` array (the full split, index 0 = heading).** This way:
- `paragraphIndex = 0` selections would be on the heading (which we allow — let users highlight "CHAPTER VIII." if they really want to).
- All body paragraphs have their natural indices.
- No awkward off-by-one in the helper.

Set `data-paragraph-index={i}` on **every** block's root (heading AND paragraphs), using their index in `blocks`.

### Paragraph rendering shape

```tsx
{blocks.map((blockText, i) => {
  const rangesForThis = highlights.flatMap((h) =>
    h.ranges
      .filter((r) => r.paragraphIndex === i)
      .map((r) => ({ ...r, highlightId: h.id })),
  )
  const segments = segmentParagraph(blockText, rangesForThis)

  const isHeading = i === 0
  const Tag = isHeading ? 'h2' : 'p'
  const tagClass = isHeading
    ? 'font-serif text-text-primary mb-4 text-lg uppercase tracking-widest'
    : 'font-serif text-text-secondary mb-4 leading-relaxed whitespace-pre-line'

  return (
    <Tag key={i} data-paragraph-index={i} className={tagClass}>
      {segments.map((seg, j) =>
        seg.type === 'text' ? (
          seg.text
        ) : (
          <mark
            key={j}
            data-highlight-id={seg.highlightId}
            className="bg-highlight rounded-[2px] px-0.5"
          >
            {seg.text}
          </mark>
        ),
      )}
    </Tag>
  )
})}
```

### Highlight background colour

`bg-highlight` is not in the existing token set. Add it.

In `client/src/styles/globals.css`, inside the `@theme` block, add:
```css
--color-highlight: oklch(0.94 0.10 95);   /* soft warm yellow — matches the wireframe */
```

This makes `bg-highlight` available as a Tailwind utility. Pick the yellow that looks right against `bg-page` and doesn't fight the accent orange.

### × delete button in the left margin

One × button per highlight, positioned vertically aligned to its **first range's first paragraph**.

**Approach: absolute positioning relative to the paragraphs root.**

For each highlight, find the `<mark>` element in the DOM whose `data-highlight-id` matches and which is the *first* range (smallest `paragraphIndex`, then smallest `start`). Measure its `offsetTop` relative to the paragraphs root. Render a × button absolutely positioned at `top: offsetTop` in the margin.

Implementation:

```tsx
const [markerPositions, setMarkerPositions] = useState<
  Record<string, number>
>({})

useLayoutEffect(() => {
  if (!paragraphsRootRef.current) return
  const root = paragraphsRootRef.current
  const next: Record<string, number> = {}
  for (const h of highlights) {
    // First range is already the topmost (ranges are stored in reading order)
    const firstRange = h.ranges[0]
    if (!firstRange) continue
    const mark = root.querySelector<HTMLElement>(
      `[data-highlight-id="${h.id}"]`,
    )
    if (!mark) continue
    next[h.id] = mark.offsetTop
  }
  setMarkerPositions(next)
}, [highlights, text])
```

The paragraphs root wrapper gets `relative`, and the × buttons render as absolute-positioned children:

```tsx
<div ref={paragraphsRootRef} onMouseUp={handleMouseUp} className="relative">
  {/* paragraph blocks as above */}

  {highlights.map((h) => {
    const top = markerPositions[h.id]
    if (top === undefined) return null
    return (
      <button
        key={h.id}
        type="button"
        onClick={() => onDeleteHighlight(h.id)}
        aria-label="Delete highlight"
        className={cn(
          'text-text-tertiary hover:text-danger absolute -left-8 flex size-6 items-center justify-center rounded-full cursor-pointer transition-colors',
        )}
        style={{ top }}
      >
        <X className="size-3.5" />
      </button>
    )
  })}
</div>
```

The `-left-8` puts the × into the left margin, outside the reading column. Adjust if needed — the reading column has `px-10`, so `-left-8` lands just inside that padding, which should read as a margin control.

### Re-measuring on resize

The `useLayoutEffect` runs when `highlights` or `text` change. It does NOT re-run on window resize. That's a known limitation — if the viewport changes width, paragraph wrapping changes, and the × buttons drift.

For this prototype: acceptable. Users aren't resizing mid-session. If it becomes annoying, add a `ResizeObserver` on the paragraph root.

Document this as "known limitation, acceptable for prototype" in your summary to me when done.

---

## `PrototypeSlide` — changes

Add the highlights state and handlers as described in the State placement section. Pass them to `ReadingPane`.

```tsx
<ReadingPane
  session={activeSession}
  text={sessionText}
  loading={loadingText}
  highlights={highlights}
  onAddHighlight={addHighlight}
  onDeleteHighlight={deleteHighlight}
/>
```

---

## Constraints

- **No middle pane changes.** `InYourOwnWordsPane` stays a collapsed `w-0` shell. Auto-open is plan-03.
- **No API calls, no persistence.** Highlights live in React state only.
- **No overlapping highlights.** If a user selects text that overlaps an existing highlight, for now let it create a new highlight anyway (two marks will visually overlap and look wrong — acceptable for prototype; plan-07-stretch can reject/merge). Flag it if it's ugly during testing.
- **Don't start the dev server.** Lucy verifies visually.
- **Match `BUILD_PLANS/design-patterns.md`**.
- **Selection within the title block** (the h1/author/section separator) must NOT be capturable. Only selections inside the paragraphs root turn into highlights. This is enforced by wiring `onMouseUp` only on the paragraphs root, not the whole pane.

---

## Out of scope (for future plans)

- Middle pane auto-open + bubble flow (plan 03)
- Facilitator API wiring (plan 04)
- Buddy API wiring + Verify button (plan 05)
- Highlight persistence (plan 06)
- Overlap resolution, edit range, hover-to-preview bubble (future / stretch)

---

## Definition of done

- `shared/types.ts` has `HighlightRange` and the updated `Highlight` type (`ranges` array added, `text` field repurposed for the concatenated selected text).
- `client/src/lib/highlights.ts` exists with the four helpers above.
- `PrototypeSlide` owns `highlights` state and clears it on session change.
- `ReadingPane` accepts `highlights`, `onAddHighlight`, `onDeleteHighlight` props.
- Selecting text in the reading pane creates a visible yellow highlight on mouseup.
- Selections within one paragraph: one range, one mark.
- Selections across paragraphs: one highlight, multiple marks (one per paragraph), gap between them left unhighlighted.
- × button appears in the left margin beside the first range of each highlight. Clicking deletes the whole highlight.
- Switching sessions clears all highlights from state.
- No console errors.
- `npm run typecheck` passes for both workspaces.
- `BUILD_PLANS/STATE.md` updated — plan-02 done, plan-03 next.
- Summary includes: confirmation the × button positioning looks right at the default viewport, any visual oddness with multi-paragraph selections, whether the `bg-highlight` colour lands well against the page and text, and any behaviour that didn't match the spec.
