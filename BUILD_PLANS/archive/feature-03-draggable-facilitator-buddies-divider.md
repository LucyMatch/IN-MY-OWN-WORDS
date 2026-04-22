# ARCHIVED — Feature Plan 03 — Draggable Facilitator / Buddies Divider

**Status:** Obsolete. Archived on 2026-04-22 as part of plan-09 housekeeping.

**Why archived:** Plan-09 (lenses-in-chat) removed the Buddy panel entirely and restructured the right column. There are no longer two stacked panels that share a column, so there is nothing to put a divider between. The Facilitator chat gets full vertical height; the Lens pane is its own vertical column to the far right with its own chevron-collapse behaviour.

---

## Original plan preserved below for reference

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

(Full plan text preserved here if ever needed — the approach was sound, it just no longer maps to the current layout.)
