# Plan 10 — Layout, Lens Auto-Expand, IYOW Fixes, Small UX Polish

Read `BUILD_PLANS/context.md`, `BUILD_PLANS/STATE.md`, and `BUILD_PLANS/design-patterns.md` first.

**Prerequisite:** plan-09 complete. The buddy system is fully replaced; `LensPane` is a vertical far-right pane; chat is full-height; chat is highlight-scoped.

---

## What this plan does

A rolling-up pass that covers layout proportions, lens auto-expand behaviour, the small In Your Own Words fixes from testing, outstanding small UX polish, and two carry-over plan-09 fixes (lens response length drift and italic styling). The spine is done after this; anything that doesn't land here moves to a feature plan.

### In scope

1. **Layout widths:** Reading = 50% of screen. In Your Own Words = 360px (fixed, matches its current expanded width). Lens = 280px expanded / 48px collapsed. Chat = whatever is left (flex-1). IYOW width does not change when Lens collapses/expands — only Chat grows/shrinks.
2. **Lens auto-expand:** collapsed on load (no highlight). Auto-expands every time `activeHighlightId` changes from `null` to a value OR from one highlight to another. User can manually collapse with the chevron; stays collapsed until the next highlight activation.
3. **IYOW empty input bubble colour:** background matches the reading pane background (warm page colour), NOT the pane's surface. So the reader can actually see it's there.
4. **IYOW empty input bubble position:** renders at the BOTTOM of the bubble list, below all staged bubbles. Reverses the current top-of-list position — this was Lucy's original intent; plan-03 got it backwards.
5. **IYOW chevron direction:** fix the flipped chevrons. When the pane is expanded, the chevron should point in the direction that collapses it (to the right, "push the pane away"). When collapsed, points in the direction that expands it (to the left, "pull the pane back").
6. **Hamburger is a toggle:** clicking the hamburger icon when the nav menu is open closes the menu. Currently only opens.
7. **Reading pane title/author/section sticky:** the block with section, title, author should stay pinned at the top of the reading pane while the body text scrolls underneath it.
8. **Sessions pane auto-collapse on interaction:** if the sessions pane is open and the user starts scrolling the reading pane OR creating a highlight OR interacting with a bubble, the pane auto-collapses. Chevron still manually toggles.
9. **Lens response length — tighten back to 2-3 sentences.** Plan-09 set `maxTokens: 250` but responses are drifting long. Tighten both the prompt and the token cap.
10. **Drop italics on lens responses.** Keep persona header + right-align + accent border. Italic text is harder to read at length and the other three signals are already strong.

### Out of scope

- Changes to the deck (non-prototype slides).
- Drop the lens-message header (parked as a test-decide item in TEST_LIST — if the framing phrase is consistent enough, header can go in a one-line edit later).
- Verify button on lens messages (parked per plan-09 decision).
- Facilitator prompt changes (plan-07's prompt is holding; don't touch).
- Changes to buddy/consult code (all deleted in plan-09 anyway).

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

Sessions panel (288px/48px) and IYOW (360px/60px) are fixed-width. Chat is `flex-1` which consumes whatever's left. Lens is 280px/48px.

**Known screen-width squeeze at 1440px.** Arithmetic with everything expanded: 288 + 720 + 360 + 280 = 1648px, leaving Chat at negative width. Decision: accept the squeeze. Most real usage happens with Sessions collapsed (auto-collapse on interaction in item 8) and/or Lens collapsed when the reader isn't pulling a lens. At 1920px everything fits. Flag as a TEST_LIST item; don't add a `min-w` guardrail in this plan unless it's painful in practice.

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

Claude Code's call: flip the two icons, compare visually, keep whichever feels right. Both interpretations (chevron-points-where-pane-will-move vs chevron-points-toward-content) are internally consistent; the ask is that it matches expected behaviour at a glance.

Same principle applies to the `LensPane` chevrons — they're the mirror image of IYOW (lens is on the right, collapses rightward). Claude Code should eyeball both panes side-by-side and make sure they tell the user the same story.

---

## Lens response length + style (carry-over from plan-09)

### Fix: Tighten lens responses back to 2-3 sentences

Plan-09 set `maxTokens: 250` in `/api/lens` and `BASE_CONSTRAINTS` in `personas.ts` says "2-3 sentences after the framing phrase. Hard cap." But responses are drifting longer in practice. Two levers to pull:

**Lever 1 — lower the token cap.**

In `server/src/routes/lens.ts`:
```ts
const result = await callClaude({
  system,
  messages: [{ role: 'user', content: userMessage }],
  maxTokens: 180,   // WAS 250 — enforce 2-3 sentences structurally
})
```

180 tokens is roughly 2-3 sentences of moderate length, including the framing phrase. A response that drifts longer gets cut mid-sentence — which in turn trains the prompt (future drafts will observe the truncation and tighten).

**Lever 2 — tighten the prompt language.**

In `server/src/lib/personas.ts`, update `BASE_CONSTRAINTS`:

```ts
const BASE_CONSTRAINTS = `Output format:
- Open with a framing phrase: "If I were [your persona name] looking at this, I'd say…" or very close variant. This tells the reader whose lens they're getting.
- 2-3 sentences TOTAL, including the framing phrase. Hard cap. Never more. Compress aggressively.
- A real take, not a summary. Expert register, plain English.
- Owned opinion, clearly yours. Never hedge with "one could argue" — you have a view.
- Never address the reader as "you."
- Speak from your lens. Don't try to sound balanced or neutral — the reader came to you for YOUR angle.`
```

Key changes:
- "2-3 sentences TOTAL, including the framing phrase" — previously the framing phrase was implied to be on top of the 2-3 sentences. Tightening so the total is 2-3.
- "Compress aggressively" — explicit instruction to prefer density over completeness.

### Fix: Drop italic styling on lens responses

In `FacilitatorChat.tsx`, the lens-message render currently (from plan-09):

```tsx
<p className="text-text-primary whitespace-pre-line text-right text-sm italic leading-relaxed">
  {message.content}
</p>
```

Drop the `italic` class:

```tsx
<p className="text-text-primary whitespace-pre-line text-right text-sm leading-relaxed">
  {message.content}
</p>
```

Keep: persona header, right-align (`text-right` + `items-end` on the wrapper), and left+right accent border on the bubble. Those three signals are enough. Italic text was harder to read at length and redundant with the other cues.

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
   - **Reading pane scroll** — pass `onScroll={autoCollapseSessions}` to the ReadingPane.
   - **Highlight creation** — call `autoCollapseSessions()` inside `addHighlight`.
   - **Bubble interaction** — call `autoCollapseSessions()` inside `addBubble` and `updateBubble`.

**Debounce consideration:** the scroll handler could fire dozens of times per scroll. The `prev ? prev : true` inside `autoCollapseSessions` is idempotent — setting to `true` when already `true` doesn't trigger a re-render in React. No debounce needed.

---

## Files to modify

```
client/src/components/slides/PrototypeSlide.tsx           ← Layout widths (indirect via ReadingPane), lens auto-expand effect, lift isSessionsCollapsed, add autoCollapseSessions helper, wire into addHighlight/addBubble/updateBubble
client/src/components/prototype/ReadingPane.tsx          ← basis-1/2 flex-shrink-0 outer wrapper; sticky title block with bg-page; onScroll prop for auto-collapse
client/src/components/prototype/InYourOwnWordsPane.tsx   ← Swap empty input bubble to bottom of list; swap chevron icons
client/src/components/prototype/EmptyInputBubble.tsx     ← bg-page on outer wrapper
client/src/components/prototype/SessionsPanel.tsx        ← Accept isCollapsed + onToggleCollapsed as props instead of internal state
client/src/components/prototype/LensPane.tsx             ← Verify chevron direction matches IYOW's (symmetry check); no behaviour change beyond that
client/src/components/prototype/FacilitatorChat.tsx      ← Drop `italic` class on lens-message <p>
client/src/components/deck/Toolbar.tsx (or wherever the hamburger lives)  ← Toggle behaviour for the menu open/close
server/src/routes/lens.ts                                 ← maxTokens: 180 (was 250)
server/src/lib/personas.ts                                ← BASE_CONSTRAINTS tightened: "2-3 sentences TOTAL, including the framing phrase", "Compress aggressively"
```

No new files. No type changes.

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
- **Lens response length:** 2-3 sentences TOTAL. Framing phrase counts as part of that total, not bonus.
- **No italic on lens messages.** Keep header, right-align, accent border — those three carry the demarcation.
- **Don't touch the facilitator prompt** — plan-07's prompt is holding; changing it risks re-introducing the validation-machine failure.
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
- Facilitator prompt changes.

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
- **Lens response length + style:**
  - `server/src/routes/lens.ts` uses `maxTokens: 180`.
  - `server/src/lib/personas.ts` `BASE_CONSTRAINTS` says "2-3 sentences TOTAL, including the framing phrase" and "Compress aggressively."
  - Manual test: click a lens, count sentences. 2-3 total. If drifting longer, tighten prompt further in a feature-plan pass.
  - Lens messages in the chat render WITHOUT italics. Header + right-align + left/right accent border remain.
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
  - ADD: "Lens response length after tightening" — did the 180-token cap + tightened prompt hold? If responses still drift long, escalate: add truncation markers or tighten further.
  - REMOVE (or mark resolved): any items previously flagged for chevron direction, empty input position, empty input colour, lens response length, italic lens styling.
- Summary includes: whether the width math was painful at realistic screen sizes (if Chat felt squeezed, flag it), whether the chevron direction swap felt right (or if it needed flipping again), whether any auto-collapse behaviour felt too aggressive, whether the sticky reading-pane title landed cleanly, and whether lens responses came out tighter after the prompt + token changes.
