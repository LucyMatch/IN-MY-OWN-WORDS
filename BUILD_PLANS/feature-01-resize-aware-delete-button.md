# Feature Plan 01 — Resize-Aware Delete Button

**Type:** Polish / post-MVP.
**Prerequisite:** Main build track done (plans 00–09). The highlight mechanic (plan-02) is in place and has not been materially changed by subsequent plans.

Read `BUILD_PLANS/context.md` and `BUILD_PLANS/design-patterns.md` first.

---

## What this fixes

Currently the × delete button next to each highlight is positioned using `useLayoutEffect` that runs when `highlights` or `text` change. It does NOT re-run on viewport resize.

Observed behaviour: the `<mark>` elements stay in the correct position because they're inline in the paragraph flow, but the × buttons drift — their `top` was measured once and frozen.

Goal: × buttons track their highlight's first mark as the viewport width changes.

---

## Approach

Add a `ResizeObserver` on the paragraphs root container. When the container resizes (which happens whenever the viewport changes width or the surrounding panes change size), re-measure all × button positions.

### Why ResizeObserver and not window resize

A window resize event fires on any window change, even ones that don't affect the paragraphs pane. The paragraphs root can also change width when:
- The sessions panel collapses or expands.
- The bubbles pane collapses or expands.
- The lens pane collapses or expands (new in plan-09).
- Any other layout shift that wasn't a window resize.

`ResizeObserver` is the right primitive — it fires when the observed element's size changes, whatever the cause.

### How it fits with the existing useLayoutEffect

Extract the measurement logic into a named function (e.g. `recomputeMarkerPositions`). Both the effect AND the resize observer call it.

```tsx
const recomputeMarkerPositions = useCallback(() => {
  if (!paragraphsRootRef.current) return
  const root = paragraphsRootRef.current
  const next: Record<string, number> = {}
  for (const h of highlights) {
    const firstRange = h.ranges[0]
    if (!firstRange) continue
    const mark = root.querySelector<HTMLElement>(
      `[data-highlight-id="${h.id}"]`,
    )
    if (!mark) continue
    next[h.id] = mark.offsetTop
  }
  setMarkerPositions(next)
}, [highlights])

useLayoutEffect(() => {
  recomputeMarkerPositions()
}, [recomputeMarkerPositions, text])

useEffect(() => {
  if (!paragraphsRootRef.current) return
  const observer = new ResizeObserver(() => {
    recomputeMarkerPositions()
  })
  observer.observe(paragraphsRootRef.current)
  return () => observer.disconnect()
}, [recomputeMarkerPositions])
```

### Performance notes

- `ResizeObserver` is cheap. No need to throttle unless profiling shows otherwise.
- `offsetTop` reads are cheap per element. For 10+ highlights on the page, still well under a millisecond total.
- The `setMarkerPositions` call only triggers a re-render if the positions object is genuinely different. React shallow-compares by reference though, so every call creates a new object and re-renders. If that causes visible jank, add an equality check in `recomputeMarkerPositions` — compare each key/value against the previous `markerPositions` and return early if unchanged.

---

## Files touched

```
client/src/components/prototype/ReadingPane.tsx   ← add ResizeObserver, extract recomputeMarkerPositions
```

No new files, no type changes, no dependencies.

---

## Definition of done

- Resizing the browser window causes × buttons to re-align with their highlights.
- Collapsing or expanding the sessions panel causes × buttons to re-align.
- Collapsing or expanding the bubbles pane causes × buttons to re-align.
- Collapsing or expanding the lens pane causes × buttons to re-align.
- No console warnings about `ResizeObserver` loop limits (if they appear, wrap the callback in a `requestAnimationFrame`).
- No visible jank — buttons move smoothly with the content, not in jarring snaps.
- Typecheck passes both workspaces.
- `BUILD_PLANS/STATE.md` known-issues section has the resize-drift item removed.
