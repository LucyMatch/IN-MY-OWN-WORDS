# Plan 10 — Layout, Lens Auto-Expand, IYOW Fixes, Small UX Polish

Read `BUILD_PLANS/context.md`, `BUILD_PLANS/STATE.md`, and `BUILD_PLANS/design-patterns.md` first.

**Prerequisite:** plan-09 complete. The buddy system is fully replaced; `LensPane` is a vertical far-right pane; chat is full-height; chat is highlight-scoped.

---

## What this plan does

A rolling-up pass that covers layout proportions, lens auto-expand behaviour, the small In Your Own Words fixes from testing, and the outstanding small UX polish items. The spine is done after this; anything that doesn't land here moves to a feature plan.

### In scope

1. **Layout widths:** Reading = 50% of screen. In Your Own Words = 360px (fixed, matches its current expanded width). Lens = 280px expanded / 48px collapsed. Chat = whatever is left (flex-1). IYOW width does not change when Lens collapses/expands — only Chat grows/shrinks.
2. **Lens auto-expand:** collapsed on load (no highlight). Auto-expands every time `activeHighlightId` changes from `null` to a value OR from one highlight to another. User can manually collapse with the chevron; stays collapsed until the next highlight activation.
3. **IYOW empty input bubble colour:** background matches the reading pane background (warm page colour), NOT the pane's surface. So the reader can actually see it's there.
4. **IYOW empty input bubble position:** renders at the BOTTOM of the bubble list, below all staged bubbles. Reverses the current top-of-list position — this was Lucy's original intent; plan-03 got it backwards.
5. **IYOW chevron direction:** fix the flipped chevrons. When the pane is expanded, the chevron should point in the direction that collapses it (to the right, "push the pane away"). When collapsed, points in the direction that expands it (to the left, "pull the pane back").
6. **Hamburger is a toggle:** clicking the hamburger icon when the nav menu is open closes the menu. Currently only opens.
7. **Reading pane title/author/section sticky:** the block with section, title, author should stay pinned at the top of the reading pane while the body text scrolls underneath it.
8. **Sessions pane auto-collapse on interaction:** if the sessions pane is open and the user starts scrolling the reading pane OR creating a highlight OR interacting with a bubble, the pane auto-collapses. Chevron still manually toggles.

### Out of scope

- Any API or prompt changes.
- Changes to the deck (non-prototype slides).
- Drop the lens-message header (parked as a test-decide item in TEST_LIST — if the framing phrase is consistent enough, header can go in a one-line edit later).
- Verify button on lens messages (parked per plan-09 decision).

---

## Layout changes

### `PrototypeSlide.tsx` — set widths explicitly

Current layout (post plan-09):
```tsx
<div className="flex h-full overflow-hidden">
  <SessionsPanel {...} />                              {/* var widths */}
  <ReadingPane {...} />                                {/* flex-1 */}
  <InYourOwnWordsPane {...} />                         {/* var widths */}
  <div className="flex min-w-0 flex-1 flex-col">
    <FacilitatorChat {...} />
  </div>
  <LensPane {...} />                                   {/* 280px / 48px */}
</div>
```

New layout — Reading locks to 50%, others explicit:

```tsx
<div className="flex h-full overflow-hidden">
  <SessionsPanel {...} />
  <ReadingPane {...} />                                {/* flex-basis 50%, flex-shrink-0 */}
  <InYourOwnWordsPane {...} />                         {/* unchanged — 360/60px */}
  <div className="flex min-w-0 flex-1 flex-col">       {/* chat takes remaining space */}
    <FacilitatorChat {...} />
  </div>
  <LensPane {...} />                                   {/* unchanged — 280/48px */}
</div>
```

The change is concentrated in `ReadingPane`'s outer wrapper. Update the top-level className in `ReadingPane.tsx`:

```tsx
// was: <div className={cn('flex-1 overflow-y-auto')}>
// becomes:
<div className={cn('basis-1/2 flex-shrink-0 overflow-y-auto')}>
```

Why `basis-1/2 flex-shrink-0`:
- `basis-1/2` fixes the starting size to 50% of the flex container's available width.
- `flex-shrink-0` prevents Tailwind/flex from shrinking it when the other columns grow.
- `flex-1` is dropped — we don't want Reading to grow beyond 50%.

Sessions panel (288px/48px) and IYOW (360px/60px) are fixed-width. Chat is `flex-1` which consumes whatever's left. Lens is 280px/48px. Arithmetic on a 1440px screen with everything expanded:

```
Sessions: 288
Reading:  720  (50%)
IYOW:     360
Chat:     ~88-92 (whatever's left after 288 + 720 + 360 + 280 = 1648; negative means squeeze)
Lens:     280
```

Wait — that arithmetic shows Chat will be squeezed below zero at 1440px. This matters. Let me flag honestly: at narrower screens, Chat will be tight or disappear.

**Real-world check:** most modern laptops are 1440px or 1920px wide. At 1440px with everything expanded, the math above shows Chat gets squeezed. At 1920px we have comfortable room (1920 - 1648 = 272px for chat).

**Decision for plan:** keep Reading at 50% and accept that at narrower screens, the user will need to collapse Sessions, Lens, or IYOW to read chat comfortably. This is consistent with how the Chat pane has always worked — it expects to share space. The auto-collapse-on-interaction for Sessions (item 8) and the Lens chevron help here.

**Alternative to consider:** use `basis-1/2` only when there's room, with a `min-w-[480px]` or similar on Chat to protect it. Adding complexity. Skip unless testing shows the squeeze is painful.

---

## Lens auto-expand

### `PrototypeSlide.tsx` — add effect

Currently:
```tsx
const [lensPaneExpanded, setLensPaneExpanded] = useState(true)
```

Change the default to `false`, add an effect:

```tsx
const [lensPaneExpanded, setLensPaneExpanded] = useState(false)

// Auto-expand lens whenever a highlight is activated (including switching highlights).
// User can manually collapse via chevron; stays collapsed until the next activation.
useEffect(() => {
  if (activeHighlightId !== null) {
    setLensPaneExpanded(true)
  }
}, [activeHighlightId])
```

Note: this mirrors the `InYourOwnWordsPane`'s auto-expand pattern (the `isManuallyCollapsed` reset on `activeHighlightId` change, lines 32-36 of `InYourOwnWordsPane.tsx`). Same pattern, applied externally here instead of internally.

One subtle bit: the existing IYOW pane uses `isManuallyCollapsed` state INSIDE the component, reset by its own effect. We're using `lensPaneExpanded` state in `PrototypeSlide` and passing it down. That's because `PrototypeSlide` needs to know the expanded state to wire it up alongside `activeHighlightId`. Fine — just different pattern for different reasons.

**Deselect case:** when a highlight becomes inactive (user deletes it, or session switches and `activeHighlightId` goes to null), the lens pane stays in whatever state it was in. We don't auto-collapse. That's a deliberate non-choice — if the user had the pane open, keep it open; they'll see the "Highlight a passage to use a lens" state inside. If they had it collapsed, stay collapsed.

---

## IYOW fixes

### Fix 1: Empty input bubble background colour

In `EmptyInputBubble.tsx`, the bubble background should match the reading pane's background (`bg-page`, the warm cream colour) rather than the surface white. Goal: visible contrast against the `InYourOwnWordsPane` container which is `bg-surface`.

Currently the empty input bubble likely uses `bg-surface` or no explicit background (transparent, letting the pane show through). Change to `bg-page`:

```tsx
// In EmptyInputBubble — outer wrapper className:
// add: 'bg-page'
```

Claude Code should check the current class and splice in the token. If there's no existing background utility, add `bg-page` to the outer container.

**Visual check:** the empty bubble becomes the same warm cream as the reading area, which clearly signals "this is where you write" because it looks like a writing surface, distinct from the pane chrome.

### Fix 2: Empty input bubble position — move to bottom

Currently in `InYourOwnWordsPane.tsx`:

```tsx
{activeHighlight ? (
  <>
    {!isCommitted && (
      <EmptyInputBubble ... />          {/* AT TOP */}
    )}
    {activeHighlight.bubbles.map(...)}  {/* staged bubbles */}
  </>
) : ...}
```

Change to:

```tsx
{activeHighlight ? (
  <>
    {activeHighlight.bubbles.map(...)}  {/* staged bubbles first */}
    {!isCommitted && (
      <EmptyInputBubble ... />          {/* AT BOTTOM */}
    )}
  </>
) : ...}
```

This reverses the order so the empty input sits at the bottom — matching how the reader's newest thought (the one they're writing) lives below the older staged ones, which is the natural "where am I now" position.

### Fix 3: Chevron direction

Current in `InYourOwnWordsPane.tsx`:
- Expanded → shows `ChevronRight` (collapse button).
- Collapsed → shows `ChevronLeft` (expand button).

This is BACKWARDS for left-to-right scanning. The convention is:
- Expanded → chevron points LEFT (showing "I can push this pane to the left / collapse it leftward"... wait, actually this is unclear; let me re-examine).

Tailwind code currently:
```tsx
// Expanded state, collapse button:
<ChevronRight className="size-4" />   // collapse button — points right, meaning "push this to the right to close"

// Collapsed state, expand button:
<ChevronLeft className="size-4" />    // expand button — points left, meaning "open back to the left"
```

Lucy's ask: "chevron is flipped it points out when its expanded and in when it's collapse it should be reversed."

"Points out when expanded" = right (it's pointing away from the reader toward the right edge). Lucy wants it pointing IN (toward the reader / toward the content). "In when collapsed it should be reversed" = also wrong direction.

Corrected:
- **Expanded** → chevron points LEFT (`<ChevronLeft />`), meaning "you can collapse me back to the left."
- **Collapsed** → chevron points RIGHT (`<ChevronRight />`), meaning "open me back out to the right."

Swap the two icons in `InYourOwnWordsPane.tsx`:

```tsx
// Collapsed strip button:
<ChevronLeft className="size-4" />    // was ChevronLeft — now ChevronRight
// expanded header collapse button:
<ChevronRight className="size-4" />   // was ChevronRight — now ChevronLeft
```

Double-check by eyeballing the result: the chevron should always point in the direction the pane would MOVE if clicked. Expanded + click → pane moves rightward (collapsing rightward) → chevron points right? Or chevron points "where the content currently is"?

**The clearest mental model:** chevrons are arrows. An expanded pane's chevron points in the direction the content will go when collapsed. An expanded IYOW pane collapses BY SHRINKING ITS WIDTH AWAY FROM THE READER — which is rightward from the reader's position (toward the right of the pane). So expanded → right-pointing chevron.

**But Lucy said it looked flipped.** So either the current implementation is genuinely wrong, OR the mental model is "the chevron points toward the content I want to reveal/see." In which case:
- Expanded (bubbles visible) → chevron says "I could hide me" → points rightward (away from content).
- Collapsed (bubbles hidden) → chevron says "show me the bubbles" → points leftward (toward where the content will reappear).

**Claude Code's call:** flip the two icons, compare, keep whichever feels right. Both interpretations are internally consistent; the ask is that it matches expected behaviour. Just swap and verify visually.

Same principle applies to the **`LensPane` chevrons** — they're the mirror image of IYOW (lens is on the right, collapses rightward). Claude Code should eyeball both panes side-by-side and make sure they tell the user the same story.

---

## Small UX polish

### Hamburger menu is a toggle

The deck's toolbar has a hamburger that opens the slide nav menu. Currently opens only. Find the hamburger button in `Toolbar.tsx` (or wherever lives); wire the onClick to toggle based on current menu state instead of always opening.

```tsx
// If state lives in Toolbar:
<button onClick={() => setMenuOpen((v) => !v)}>

// If state lives elsewhere (DeckContext or similar), invert through that path.
```

Claude Code should grep for the nav menu state owner and wire the toggle correctly.

### Reading pane title/author/section sticky

Currently in `ReadingPane.tsx`, the header block (section label, title, author, divider) sits inside the scrollable container and scrolls away with the body. Make it sticky so it stays visible as the reader scrolls through the passage.

Approach:
- The outer wrapper is already `overflow-y-auto` — it's the scroll container.
- Wrap the title block in a `sticky top-0 bg-page z-10` container so it sticks to the top of the scroll area.
- Background colour must match the reading area so the text below scrolls underneath cleanly.

```tsx
<div className="mx-auto max-w-2xl px-10 py-10">
  {session && (
    <div className="sticky top-0 z-10 bg-page pb-6 pt-10 -mt-10">   {/* wrapper sticky bit */}
      <p className="text-text-tertiary text-xs uppercase tracking-widest">{session.section}</p>
      <h1 className="font-serif text-text-primary mt-1 text-2xl">{session.title}</h1>
      <p className="text-text-secondary mt-1 text-sm">{session.author}</p>
      <div className="border-border-subtle mb-0 mt-4 border-b" />
    </div>
  )}
  {/* body */}
</div>
```

The `-mt-10 pt-10` trick extends the sticky background upward to cover the page's top padding so the text doesn't "peek out" above the sticky header when scrolled. Adjust padding values to match whatever the current spacing is.

Visual check: scroll the reading pane. Title stays pinned. Body text scrolls under it smoothly, no visual artefacts.

### Sessions pane auto-collapse on interaction

Sessions pane collapses when the user starts actively working. Triggers:
- User scrolls the reading pane.
- User creates a new highlight (mousedown in reading pane counts).
- User interacts with a bubble (clicks the textarea, etc.).

Simplest implementation: lift `isCollapsed` state from `SessionsPanel` to `PrototypeSlide`, expose a `setSessionsCollapsed` prop or shared setter, and call `setSessionsCollapsed(true)` from the three interaction points.

Actually — cleaner: the three interactions all already happen on components that `PrototypeSlide` owns handlers for. We can:

1. Lift `isSessionsCollapsed` state to `PrototypeSlide`:
   ```tsx
   const [isSessionsCollapsed, setIsSessionsCollapsed] = useState(false)
   ```

2. Pass it into `SessionsPanel` as a prop:
   ```tsx
   <SessionsPanel
     isCollapsed={isSessionsCollapsed}
     onToggleCollapsed={() => setIsSessionsCollapsed((v) => !v)}
     ...
   />
   ```

3. In `SessionsPanel`, replace local state with the prop; use `onToggleCollapsed` for the chevron.

4. In `PrototypeSlide`, add a helper:
   ```tsx
   function autoCollapseSessions() {
     setIsSessionsCollapsed((prev) => (prev ? prev : true))
   }
   ```

5. Wire into the three interactions:
   - **Reading pane scroll** — pass `onScroll={autoCollapseSessions}` to the ReadingPane, or add it there internally (probably cleaner to add `onUserEngage` prop).
   - **Highlight creation** — call `autoCollapseSessions()` inside `addHighlight`.
   - **Bubble interaction** — call `autoCollapseSessions()` inside `addBubble` and `updateBubble`.

Alternative simpler approach: pass a single `onUserEngage` prop to ReadingPane, IYOW, and fire it from there. But the helper-at-PrototypeSlide-level is fine — we're already holding all the handlers.

**Debounce consideration:** the scroll handler could fire dozens of times per scroll. We only need to fire once (to collapse). Wrap in a one-shot ref pattern:

```tsx
function handleReadingPaneScroll() {
  autoCollapseSessions()   // idempotent — only flips state if currently expanded
}
```

The `prev ? prev : true` inside `autoCollapseSessions` is idempotent — setting to `true` when already `true` doesn't trigger a re-render in React. No debounce needed.

---

## Files to modify

```
client/src/components/slides/PrototypeSlide.tsx           ← Layout widths (indirect via ReadingPane), lens auto-expand effect, lift isSessionsCollapsed, add autoCollapseSessions helper, wire into addHighlight/addBubble/updateBubble
client/src/components/prototype/ReadingPane.tsx          ← basis-1/2 flex-shrink-0 outer wrapper; sticky title block with bg-page; onScroll prop for auto-collapse
client/src/components/prototype/InYourOwnWordsPane.tsx   ← Swap empty input bubble to bottom of list; swap chevron icons
client/src/components/prototype/EmptyInputBubble.tsx     ← bg-page on outer wrapper
client/src/components/prototype/SessionsPanel.tsx        ← Accept isCollapsed + onToggleCollapsed as props instead of internal state
client/src/components/prototype/LensPane.tsx             ← Verify chevron direction matches IYOW's (symmetry check); no behaviour change beyond that
client/src/components/deck/Toolbar.tsx (or wherever the hamburger lives)  ← Toggle behaviour for the menu open/close
```

No new files. No server changes. No type changes.

---

## Constraints

- **Reading pane is exactly 50%.** Not flex-1. `basis-1/2 flex-shrink-0`.
- **IYOW width is unchanged.** Still 360px expanded / 60px collapsed. Lens collapse must not affect it.
- **Lens auto-expand fires only when `activeHighlightId` CHANGES.** Not on every render. useEffect dependency array.
- **Empty input bubble position:** BOTTOM of the list, not top.
- **Chevron direction:** match the user's mental model — when in doubt, flip, compare, keep whichever is clearer. Both panes use consistent direction.
- **Hamburger is a toggle:** both open and close.
- **Sticky title:** text must scroll cleanly under it, no peek-through.
- **Sessions auto-collapse is one-way:** user interaction → collapse. Does NOT auto-expand. User must chevron to reopen.
- **Screen width squeeze:** if chat feels too narrow at 1440px, flag in TEST_LIST — don't attempt to fix in this plan.
- **Match `BUILD_PLANS/design-patterns.md`.**
- **Don't start the dev server.** Lucy verifies visually.

---

## Out of scope

- Drop the lens-message header (test-decide; one-line edit later if the framing phrase is enough).
- Verify button on lens messages (parked per plan-09 decision).
- Chat minimum width guardrail (add if squeeze is painful; flag in TEST_LIST).
- Session pane auto-expand (never — only user chevron opens it back).
- Middle-pane auto-collapse on interaction (no; IYOW is the work surface, shouldn't auto-hide).
- Reading pane internal anchors or bookmarks (future feature).
- Highlight-level "jump to" from committed highlights summary (future feature).

---

## Definition of done

- **Layout:**
  - Reading pane takes exactly 50% of the available width.
  - IYOW is 360px expanded / 60px collapsed, unchanged on lens toggle.
  - Lens is 280px expanded / 48px collapsed.
  - Chat takes remaining space via `flex-1`. Collapsing lens makes chat visibly wider; collapsing IYOW makes IYOW thinner (not wider — its fixed width).
  - Sessions still 288px expanded / 48px collapsed.
- **Lens auto-expand:**
  - On page load with no highlight: lens is collapsed.
  - Click a highlight: lens expands.
  - Manually collapse via chevron: lens stays collapsed.
  - Click a different highlight: lens re-expands (manual collapse state reset).
  - Deselect highlight (delete, session switch): lens stays in current state (no auto-change).
- **IYOW fixes:**
  - Empty input bubble clearly visible against the surface (warm cream colour, different from pane chrome).
  - Empty input bubble renders at the BOTTOM of the bubble list.
  - Chevron direction feels correct — Lucy can tell at a glance what will happen when clicked. Both IYOW and Lens panes use consistent direction logic.
- **Hamburger toggles** the nav menu open/closed.
- **Reading pane title/author/section** stays pinned at the top while the body scrolls underneath, with no visual artefacts.
- **Sessions pane auto-collapses** when the user:
  - Scrolls the reading pane.
  - Creates a new highlight.
  - Interacts with a bubble (add, edit).
  - Sessions pane does NOT auto-expand under any circumstances.
- `npm run typecheck` passes both workspaces.
- `BUILD_PLANS/STATE.md` updated — plan-10 done.
- `BUILD_PLANS/TEST_LIST.md` updated:
  - ADD: "Chat width at 1440px" — does the chat get squeezed uncomfortably? If so, add a `min-w-[320px]` guardrail in a feature plan.
  - ADD: "Lens header vs framing phrase" — with the layout fixed and testing underway, decide whether the lens-message header is redundant with the model's framing phrase. If yes, drop header in a one-line `LensBubble` edit.
  - ADD: "Sessions auto-collapse feel" — does the auto-collapse feel assistive or disruptive? Is the re-expand via chevron discoverable enough?
  - ADD: "Sticky title visual artefacts" — on slow-scroll, does text peek above the sticky header? If so, adjust the -mt-10 pt-10 extension.
  - REMOVE (or mark resolved): any items previously flagged for chevron direction, empty input position, empty input colour.
- Summary includes: whether the width math was painful at realistic screen sizes (if Chat felt squeezed, flag it), whether the chevron direction swap felt right (or if it needed flipping again), whether any auto-collapse behaviour felt too aggressive, and whether the sticky reading-pane title landed cleanly.
