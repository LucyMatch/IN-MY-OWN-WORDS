# Feature Plan 03 — Draggable Facilitator / Buddies Divider

**Type:** Polish / post-MVP.
**Prerequisite:** Main build track done (plans 00–06). Facilitator chat and Buddy panel both exist and are stacked vertically in the right column.

Read `BUILD_PLANS/context.md` and `BUILD_PLANS/design-patterns.md` first.

---

## What this fixes / adds

The right column currently stacks `FacilitatorChat` on top and `BuddyPanel` below, each taking equal-ish space (or whatever the flex layout gives them). Different users will want different balances — someone in heavy chat mode wants more of the Facilitator; someone cross-referencing all three buddy takes wants more of the Buddy panel.

Add a draggable horizontal divider between them. Dragging up expands the Buddy panel, dragging down expands the Facilitator. Persist the split in local component state (optionally localStorage — see Q below).

Wireframe reference: Lucy's notes on the final wireframe explicitly asked *"how hard to make height pos of this break draggable?"* — this is that feature.

---

## Approach

Use native pointer events rather than a library. The interaction is simple enough that `react-resizable-panels` or similar is overkill.

Mental model:
- A thin horizontal bar sits between the two panels.
- User pointerdowns on the bar → we capture the pointer.
- On pointermove, compute new split ratio based on pointer position relative to the right column's bounding rect.
- On pointerup, release the capture.
- State is the split ratio (0–1). Default 0.5 (equal split).

### Component changes

Currently in `PrototypeSlide`:
```tsx
<div className="border-border-soft flex w-[360px] flex-shrink-0 flex-col border-l">
  <FacilitatorChat {...} />
  <BuddyPanel {...} />
</div>
```

Extract this right column into its own component `RightColumn.tsx` (cleaner than putting drag logic inline in PrototypeSlide). It takes the same props FacilitatorChat + BuddyPanel need and renders:

```tsx
export function RightColumn(props: RightColumnProps) {
  const [splitRatio, setSplitRatio] = useState(0.5)   // 0 = all Facilitator; 1 = all Buddy
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Pointer handlers (detailed below)
  function handlePointerDown(e: React.PointerEvent) { /* ... */ }

  return (
    <div
      ref={containerRef}
      className="border-border-soft flex w-[360px] flex-shrink-0 flex-col border-l"
    >
      <div style={{ flex: `${1 - splitRatio} 1 0` }} className="min-h-0 overflow-hidden">
        <FacilitatorChat {...props.facilitator} />
      </div>
      <DividerHandle onPointerDown={handlePointerDown} isDragging={isDragging} />
      <div style={{ flex: `${splitRatio} 1 0` }} className="min-h-0 overflow-hidden">
        <BuddyPanel {...props.buddy} />
      </div>
    </div>
  )
}
```

The `flex: ${ratio} 1 0` idiom gives each pane a proportional share of the column height. `min-h-0` + `overflow-hidden` on each wrapper ensures the inner scrollable areas (FacilitatorChat's messages, BuddyPanel's cards) don't blow out of their pane.

### Pointer capture flow

```tsx
function handlePointerDown(e: React.PointerEvent) {
  e.preventDefault()
  const container = containerRef.current
  if (!container) return

  // Capture the pointer so subsequent moves come to us even outside the handle
  ;(e.target as Element).setPointerCapture(e.pointerId)
  setIsDragging(true)

  function handleMove(moveEvent: PointerEvent) {
    const rect = container.getBoundingClientRect()
    const relative = (moveEvent.clientY - rect.top) / rect.height
    // Clamp between sensible min/max — keep both panes usable
    const clamped = Math.min(0.85, Math.max(0.15, relative))
    setSplitRatio(clamped)
  }

  function handleUp(upEvent: PointerEvent) {
    ;(e.target as Element).releasePointerCapture(upEvent.pointerId)
    setIsDragging(false)
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleUp)
  }

  window.addEventListener('pointermove', handleMove)
  window.addEventListener('pointerup', handleUp)
}
```

### `DividerHandle` subcomponent

A thin visual bar that's a generous click target. When hovered or being dragged, it shows a darker indicator.

```tsx
function DividerHandle({
  onPointerDown,
  isDragging,
}: {
  onPointerDown: (e: React.PointerEvent) => void
  isDragging: boolean
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      data-dragging={isDragging || undefined}
      className={cn(
        'group/divider relative h-1 flex-shrink-0 cursor-row-resize',
        'bg-border-soft hover:bg-border-subtle data-[dragging]:bg-accent-strong/40',
        'transition-colors',
      )}
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize Facilitator and Buddies panels"
    >
      {/* Generous invisible hit area so the user doesn't have to nail the 1px bar */}
      <div className="absolute inset-x-0 -inset-y-2" />
    </div>
  )
}
```

The `inset-x-0 -inset-y-2` trick gives a 20px-tall invisible hit area centred on the 1px visible bar — much easier to grab than a literal 1px target.

---

## Open design question — persist the split?

Three options:

- **(a) Session-only.** Split ratio lives in component state, resets on reload. Simple, matches how chat history resets.
- **(b) localStorage.** Remembers the user's preferred split across reloads. A few lines of code.
- **(c) Persist on the highlights file.** Adds a "preferences" section to the JSON file. Overkill.

Recommend **(b) — localStorage**. It's user preference, not session data. Save on every change (debounced 300ms). Load on mount.

```tsx
const STORAGE_KEY = 'iyow:rightColumnSplit'
const DEFAULT_RATIO = 0.5

const [splitRatio, setSplitRatio] = useState<number>(() => {
  if (typeof window === 'undefined') return DEFAULT_RATIO
  const stored = window.localStorage.getItem(STORAGE_KEY)
  const parsed = stored ? parseFloat(stored) : NaN
  return Number.isFinite(parsed) && parsed > 0 && parsed < 1 ? parsed : DEFAULT_RATIO
})

useEffect(() => {
  const handle = setTimeout(() => {
    window.localStorage.setItem(STORAGE_KEY, splitRatio.toString())
  }, 300)
  return () => clearTimeout(handle)
}, [splitRatio])
```

Debounce prevents thrashing localStorage on every pointermove.

---

## Files touched

```
client/src/components/prototype/RightColumn.tsx    ← NEW — extracts the right column, owns divider state
client/src/components/slides/PrototypeSlide.tsx    ← use <RightColumn> instead of the inline flex div
```

No other changes. `FacilitatorChat` and `BuddyPanel` don't need to know about the divider — they just need to respect their container's height.

---

## Constraints

- **Minimum pane size:** clamp ratio between 0.15 and 0.85 so both panes always have usable content.
- **Double-click to reset:** optional but nice. Double-clicking the divider resets to 0.5. One extra line.
- **Touch support:** `pointerdown`/`pointermove`/`pointerup` work for touch, mouse, and pen automatically. No separate handlers needed.
- **No layout shift on first drag.** The transition from flex-default to controlled-ratio should be seamless — start the ratio at 0.5, which matches the default flex behaviour.
- **Accessibility:** keyboard resize (arrow keys when the divider is focused) is nice-to-have. Add if time permits, skip otherwise — the feature is mouse/touch-first.

---

## Definition of done

- `RightColumn.tsx` exists and is used by `PrototypeSlide`.
- Dragging the divider up and down smoothly resizes the two panes.
- Minimum sizes (15% / 85%) respected.
- Split ratio persists across reloads via localStorage.
- On reload with no stored ratio, defaults to 50/50.
- Divider has a hover state and a dragging state visually.
- Invisible hit area makes grabbing easy.
- No console errors, no layout jitter.
- Typecheck passes both workspaces.
- `BUILD_PLANS/STATE.md` known-issues section: remove any reference to "stacked only, no resize."
- Optional: double-click to reset, keyboard resize with arrows.
