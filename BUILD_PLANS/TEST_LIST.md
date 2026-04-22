# Test List — Interactions to Verify

Running list of interactions, feels, and edge cases to test once the main build (plans 00–06) is done. Not bugs; things that need a human eye to judge.

Each entry: **what to test**, **why it matters**, **what to do if it feels wrong**.

Updated as plans complete.

---

## Performance & feel

### Two-call facilitator latency (plan-04)
**What to test:** Stage a bubble. Measure perceived wait from click + → commit button unlocks (or "push again" response lands).
**Why:** Sequential facilitator → classifier call is ~3s total. Typing indicator is meant to bridge it.
**If it feels wrong:** Switch classifier to fire-and-forget. Facilitator response appears as soon as it's ready; `commitReady` updates later when classifier returns. ~10-min refactor in `PrototypeSlide.sendSynthesisTurn`.

### Yellow → green commit transition (plan-04)
**What to test:** Click commit. Watch the bubbles + highlight marks in the reading pane transition colour.
**Why:** This is THE visual payoff moment of the prototype. Needs to land.
**If it feels wrong:**
- Too slow → `transition-colors duration-300` (from current 500ms).
- Too abrupt → `duration-700`.
- Colour wrong → tune `--color-commit` in `globals.css`. Fallback is to swap for the accent orange.

### Commit-readiness classifier calibration (plan-04)
**What to test:** Write several bubble drafts of varying quality for the same highlight. Does the classifier correctly gate the bad ones and release the good ones?
**Why:** The whole commit gating mechanic hinges on the classifier's judgment being fair.
**If it feels wrong:**
- Too strict (never unlocks) → soften the system prompt in `server/src/routes/commitCheck.ts`.
- Too loose (unlocks too easily) → tighten the "default to false" instruction, add more failure examples.
- Note: "Commit anyway" link is always visible when locked, so users are never stuck — prioritise fixing false negatives over false positives.

### Pane open/close animation (plan-03)
**What to test:** Collapse and expand the In Your Own Words pane. Check the 300ms transition feels right.
**If it feels wrong:** Swap to `duration-200` (faster) or `duration-400` (slower).

### Sessions panel collapse (plan-01)
**What to test:** Same as above, for the Sessions drawer.

---

## API cost (observability, not fixing)

### Cost per highlight — approximate ceiling
**What to test:** During a representative full-flow test (new highlight → stage 2-3 bubbles → buddies run → one re-run → one verify → commit), note how many API calls fired. Roughly:
- ~2-3 Sonnet calls per bubble (facilitator + classifier per synthesis turn)
- 3 parallel Sonnet calls per first-bubble-stage (buddy consult)
- 3 parallel Sonnet calls per re-run of any one buddy (wastes 2 — flagged in plan-05)
- 1 Sonnet call per Verify click

**Why:** Lucy doesn't currently have a cost sense for the prototype. Running it once through a full recording pass gives a real number. Useful for:
- Knowing how many full demos the budget can fund.
- Deciding if the re-run waste (3 calls for 1 result) needs fixing.
- Flagging to Anthropic reviewers what's happening under the hood.

**If it's too much:** Move the classifier and buddies from Sonnet to Haiku for the demo. Most of the "thinking" is in the facilitator synthesis call — the classifier and buddies can tolerate a faster/cheaper model. Would roughly halve per-session cost.

### Re-run wastage
**What to test:** Hit re-run on a buddy card. Check server logs — three calls fire, two results are discarded.
**Why:** Known design debt from plan-05. Acceptable for prototype but should be called out if cost is a concern.
**If it becomes a problem:** Add `/api/consult/:buddyId` endpoint for single-buddy calls. ~20-min feature-plan addition.

---

## Interaction edge cases

### Click a mark inside a prior selection (plan-02/03)
**What to test:** Make a highlight. Drag a new selection that starts on or crosses the existing mark. Does activation fire correctly? Does a new highlight create cleanly?
**Why:** Flagged by Claude Code as edge-case territory. `onClick` shouldn't fire on drag-selects but `onMouseUp` will.
**If it feels wrong:** Likely need to stopPropagation on the mark's onClick when a selection is in flight.

### Multi-paragraph selection ending at start of last paragraph (plan-02)
**What to test:** Select from middle of paragraph 2 to the very start of paragraph 3 (release immediately at the top).
**Why:** Produces a zero-width range in the last paragraph. Claude Code flagged this is invisible but adds a zero-width mark entry.
**If it feels wrong:** Filter zero-width ranges in `computeRangesFromSelection`.

### Resize after placing highlights *(resolved in plan-11)*

**What to test:** Place highlights. Resize the window or collapse/expand any pane (Sessions, IYOW, Lens). × delete buttons should track their marks.
**Why:** Fixed in plan-11 via `ResizeObserver` on `paragraphsRootRef.current`. `recomputeMarkerPositions` extracted as a `useCallback`; fires on both content changes (`useLayoutEffect`) and container resize (`useEffect`).
**If buttons still drift:** Check `ResizeObserver` is observing `paragraphsRootRef.current` (not the outer scroll container). If a "ResizeObserver loop" warning appears, wrap the callback in `requestAnimationFrame` as noted in the plan.

### Click outside on a mark while editing a bubble (plan-03)
**What to test:** Start editing a staged bubble, then click a mark in the reading pane before saving. What happens to the edit draft?
**Why:** Edge case — switching highlights while mid-edit.
**If it feels wrong:** May need to blur-save or warn on navigation mid-edit.

---

## State & data integrity

### Switch session mid-facilitator-call (plan-04)
**What to test:** Stage a bubble, and while the facilitator is thinking, switch sessions.
**Why:** The response might return after state has moved. Could orphan a message or crash.
**If it feels wrong:** Add an AbortController to in-flight facilitator calls, clean up on session switch.

### Mid-call highlight switch (plan-08)

**What to test:** Stage a description on highlight A. Before the facilitator response arrives, click a different highlight B. When the response lands, verify it appears on A's chat thread — NOT B's. Then click back to A and confirm the message is there; click B and confirm its chat is unaffected.
**Why:** Both `sendSynthesisTurn` and `sendChatMessage` capture `highlightId` at call time and target that specific highlight for all writes — not `activeHighlightId` at response time. This test verifies the pattern holds under real latency.

### Committed chat re-engagement (plan-08)

**What to test:** Commit a highlight (yellow → green). Click it to make it active again. Type a question in the chat input. Facilitator should respond, anchored to that passage — no synthesis-mode call fires (no new descriptions being staged), just a plain chat call.
**Why:** Committed highlights keep their chat thread open. The reader should be able to revisit and continue the conversation. Verify the input is not disabled on a committed highlight, and that the facilitator's response is contextually appropriate (no confusion from the committed state).
**If it feels wrong:** The committed flag lives on bubbles, not on the highlight itself. Nothing in `sendChatMessage` checks for committed state — by design. If the facilitator behaves oddly, check whether the synthesis context is leaking into a chat-mode call.

### Delete the active highlight (plan-03)

**What to test:** Delete the currently-active highlight via the × button. Middle pane should clear to instruction state.
**If it feels wrong:** Check `activeHighlightId` nullification in `deleteHighlight`.

### No-highlight empty state (plan-08)

**What to test:** Fresh session, no highlights — chat pane shows "Highlight a passage to start a conversation about it." and the input is hidden. Make a highlight → chat input appears. Click the active highlight mark a second time to deselect it → empty state returns.
**Why:** Chat is now highlight-scoped. There is no general chat mode — the reader must anchor questions to a passage. Verify the empty state instructs rather than confuses.
**If it feels wrong:** Copy in `FacilitatorChat.tsx` no-highlight branch. The message should feel like a prompt, not an error.

---

## Visual & aesthetic

### ConceptSlide line size at presentation display (plan-11)

**What to test:** At the display size you'll use for the video recording, does `text-3xl` read comfortably, or does it feel small relative to the centred layout?
**If it feels wrong:** Bump both `<p>` elements in `ConceptSlide.tsx` from `text-3xl` to `text-4xl`. One-line change per element.

### Section label fixed-width calibration (plan-11)

**What to test:** Navigate between any context slide and the Prototype slide. Do the arrows (ChevronLeft / ChevronRight) stay horizontally fixed, or do they shift when the label switches between "Context" and "Prototype"?
**Why:** The label is wrapped in `min-w-[96px] inline-block` to prevent jitter. "Prototype" (9 chars) is wider than "Context" (7 chars) — if 96px is too tight, "Prototype" may push the arrows right.
**If arrows shift:** Increase `min-w-[96px]` to `min-w-[100px]` or `min-w-[104px]` in `Toolbar.tsx`. Eyeball and adjust.

### Active mark orange ring opacity (plan-03)
**What to test:** Activate a highlight. Is the 40% opacity orange ring readable without overwhelming the yellow?
**If it feels wrong:**
- Too subtle → raise to 50% or 60%.
- Too loud → drop to 30%.
- Competing with yellow → try a different colour (darker orange, inner shadow instead of ring).

### Sage green commit colour (plan-04)
**What to test:** Commit a highlight. Does the sage green `oklch(0.82 0.08 150)` sit well against the warm page (`#faf9f5`)?
**If it feels wrong:**
- Too muted → raise chroma to `0.10` or `0.12`.
- Too green → shift hue toward `140` (warmer) or `160` (cooler).
- Reads as "sick" against the warm page → try an orange tint instead (`oklch(0.82 0.10 60)`) as the back-pocket option Lucy approved.

### Commit button colour (plan-04)
**What to test:** Does the orange commit button feel right, or should it be sage green for mechanic coherence?
**Why:** Current build uses orange (standard primary). Debated during plan-04 drafting — kept orange because it reads as "action button." But the whole commit mechanic lives in sage green otherwise.
**If it feels wrong:** One-line override in `InYourOwnWordsPane.tsx` to force `bg-commit` on the commit button when enabled.

### 60px collapsed strip on middle pane (plan-03)
**What to test:** Collapse the middle pane. Does the 60px chevron strip feel right, or too wide/narrow?
**If it feels wrong:** Adjust `--bubbles-pane-width-collapsed` in `:root`. 48px matches the sessions panel; 80px gives more breathing room.

---

## Layout and polish (plan-10)

### Horizontal overflow at narrow screens
**What to test:** Sessions and Lens are now mutually exclusive, and Reading adapts (35% lens-open / 45% lens-closed), so "everything expanded" is impossible. Verify the typical layout fits at 1440px: Sessions collapsed (48px) + Reading 35% (504px) + IYOW 360px + Chat + Lens 280px = 1192px fixed, leaving Chat ~248px — tight but functional. With Lens also collapsed: Reading 45% (648px) + Sessions 48px + IYOW 360px + Chat = 1056px, Chat gets ~384px — comfortable.
**Why:** The adaptive width + mutual exclusion combination replaces the earlier "overflow as escape valve" approach. The `min-w-[300px]` guardrail on Chat is still there as a hard floor.
**If Chat still feels squeezed:** Narrow Lens from 280px to 240px in `LensPane.tsx`. One-line change to `w-[280px]`.

### Lens header vs framing phrase
**What to test:** Invoke a lens. The response now has: (a) persona header above ("The Historian — a different lens") and (b) the model's own framing phrase inside the text. Do both feel necessary, or is one redundant?
**Why:** With italics gone, the header does more load-bearing work as a visual anchor. But if the model's framing phrase is consistent, the header may be redundant noise.
**If the header feels redundant:** Remove `{message.personaName} — a different lens` from `LensBubble` in `FacilitatorChat.tsx`. One-line edit.

### Sessions auto-collapse feel
**What to test:** Open the prototype with Sessions expanded. Start reading (scroll), then create a highlight. Does the Sessions pane collapse smoothly and feel assistive — or does it feel like something disappeared unexpectedly?
**Why:** The auto-collapse triggers on the first meaningful interaction. If the pane vanishes before the user has oriented, it could feel jarring. The re-expand path (chevron in the 48px strip) needs to be discoverable enough.
**If it feels too aggressive:** Consider adding a short delay (e.g. 500ms debounce) before collapsing, or only trigger on highlight creation (not on scroll). Edit `autoCollapseSessions` in `PrototypeSlide.tsx`.
**If re-expand is not discoverable:** Add a tooltip to the collapsed strip chevron, or widen the strip.

### Sessions/Lens mutual exclusion feel
**What to test:** Open Sessions (chevron in the collapsed strip). Lens should snap shut. Then open Lens (chevron). Sessions should snap shut. Also test: create a highlight — Lens opens AND Sessions collapses simultaneously. Does the mutual exclusion feel like a considered layout decision, or does a panel closing unexpectedly feel like a glitch?
**Why:** The mutual exclusion is designed to prevent the layout from squeezing Chat between two expanded side panels. But it's implicit — there's no tooltip or label explaining why the other pane closed.
**If it feels jarring:** Consider a very short CSS transition on the closing pane (it already has `transition-[width] duration-200`) — the collapse is animated, which should soften it. If still confusing, add a tooltip to each pane's chevron button explaining the relationship.

### Chat input auto-grow
**What to test:** Type a short message (one line) — textarea stays one row. Keep typing past the line wrap — textarea expands. Continue until it hits approximately 6 lines (~160px) — textarea stops growing and gets its own internal scroll. Delete back to one line — textarea shrinks back down. Shift+Enter still inserts a newline without sending.
**Why:** `useLayoutEffect` resets height to `auto` then sets it to `Math.min(scrollHeight, 160)` on every value change. The reset-then-set pattern is what makes shrinking work — without it, height only grows.
**If the grow/shrink feels jumpy:** The `useLayoutEffect` fires synchronously before paint, so it should be imperceptible. If there's a flash, check whether something is double-rendering the component.

### 50px bottom breathing room
**What to test:** Check the commit button (in IYOW) and the chat input (in FacilitatorChat) both sit noticeably above the bottom of their panes rather than flush with the edge. Does 50px feel like comfortable breathing room, or too much empty space below the controls?
**Why:** `pb-[50px]` on the footer containers. The `pb-4` on `DeckLayout`'s `<main>` adds another 16px of clearance from the screen bottom.
**If 50px feels excessive:** Dial back to `pb-8` (32px) or `pb-6` (24px) — one-line change each in `InYourOwnWordsPane.tsx` and `FacilitatorChat.tsx`.

### Sticky title visual artefacts
**What to test:** Slowly scroll the reading pane. Does the title block stay cleanly pinned, with body text sliding underneath it? Any flicker, peek-through above the header, or jump at the point where sticky kicks in?
**Why:** The `-mt-10 pt-10` trick on the sticky block cancels the parent's `py-10` top padding. If the values don't match, there will be a gap at the top of the scroll container where the warm page background shows through.
**If text peeks above the sticky header:** Adjust `-mt-10 pt-10` to a larger value (e.g. `-mt-12 pt-12`) to extend the sticky background further upward.

### Lens response length after tightening
**What to test:** Invoke each of the three personas across different passages. Count sentences in the response. Are responses consistently 2-3 sentences total (framing phrase counts)?
**Why:** `maxTokens` dropped from 250 to 180 and `BASE_CONSTRAINTS` now says "2-3 sentences TOTAL, including the framing phrase." If responses still drift, the next lever is a hard truncation marker or moving the constraint to the very last line of each system prompt.
**If responses still drift long:** Move `BASE_CONSTRAINTS` to be the final block in each persona's `systemPrompt` (after the Avoid list) — models attend more to recency. Also consider: "If you exceed 3 sentences, stop mid-sentence rather than adding a fourth."

---

## Lenses (plan-09)

### Lens demarcation clarity *(italic dropped in plan-10 — re-verify)*
**What to test:** Invoke a persona. Read the response in chat. Does the combination of right-alignment + left/right accent border + persona header above read as clearly distinct from facilitator responses — without italics?
**Why:** Plan-10 dropped `italic` from `LensBubble`. The remaining three signals (right-align, accent border, persona header) now carry all the demarcation load. Verify they're still enough. Also see "Lens header vs framing phrase" in the plan-10 section above — if the framing phrase is consistent, the header may be redundant.
**If it feels muddy:** Try `font-medium` on the lens bubble `<p>` as a non-italic differentiator. Or restore `italic` if the readability tradeoff was wrong. Edit `LensBubble` in `client/src/components/prototype/FacilitatorChat.tsx`.

### Framing phrase consistency
**What to test:** Invoke each of the three personas across several different passages. Do responses reliably open with "If I were [persona name] looking at this, I'd say…" or a close variant? Or does the model occasionally drop the phrase and dive straight into the reading?
**Why:** The framing phrase is the semantic marker that reinforces whose lens the reader is getting — it's not just politeness. The `BASE_CONSTRAINTS` in `server/src/lib/personas.ts` requires it, but models drift under long system prompts.
**If it feels wrong:** Tighten the opening instruction in `BASE_CONSTRAINTS`. Try moving it to the very last line of the system prompt (models attend more to recency) and adding a negative: "Never open without your framing phrase — the reader must know whose voice this is immediately."

### Persona button discoverability *(default changed to collapsed in plan-10 — re-verify)*
**What to test:** Create a highlight — the lens pane should auto-expand. Is the auto-expand noticeable enough to signal the lenses are now available? Does the 48px collapsed strip (before any highlight) register as "something is there"?
**Why:** Plan-10 changed `lensPaneExpanded` default to `false`. The lens pane now starts collapsed and auto-expands on first highlight activation. This trades immediate visibility for a cleaner initial layout. Verify the auto-expand moment reads as intentional (something appearing in response to the highlight), not as a UI glitch.
**If the auto-expand feels unnoticed:** Consider a subtle animation or a brief label flash when expanding. Or revert to default-expanded if the collapsed-first approach loses too many users.
**If the 48px strip is confusing before a highlight:** Add a `title` tooltip to the collapsed strip chevron ("Context lenses — highlight a passage to use").

### Chat full-height feel
**What to test:** Use the prototype with the new layout. Does the chat finally have room to breathe? Compare against a memory of the old split (chat cramped in the top half, buddies below). Does the conversation feel like the primary thread, with the lens as a supplement?
**Why:** This is THE visual unlock of plan-09 — the whole point of replacing the buddy panel. If the chat still feels cramped, check whether something is constraining the `flex-1` chat wrapper or whether the lens pane's 280px width is taking too much.
**If it feels wrong:** (a) Chat still cramped → check the `div` wrapping `FacilitatorChat` has `flex min-w-0 flex-1 flex-col` and nothing is overriding it. (b) Lens pane feels too wide → reduce from `w-[280px]` to `w-[240px]` in `LensPane.tsx`. (c) Both panes feel wrong → try collapsing the lens pane by default and see if chat-only feels better as the baseline.

---

## Persistence (plan-06)

### Save rhythm — is it noticeable?

**What to test:** Create a highlight, stage a bubble, commit it. Watch the network tab. Do POSTs appear immediately after each mutation (add highlight, add bubble, commit), or is there a visible lag/flicker in the UI while the save is in-flight?
**Why:** Saves are fire-and-forget (no `await`), so they should be invisible to the user. Any lag means something is blocking the render cycle.
**If it feels wrong:** The save should have zero UI impact. If there's lag, check whether something is accidentally `await`ing `saveHighlights` — it should be `void fetch(...)`.

### Reload test — full round-trip

**What to test:** Create a highlight → stage 2 bubbles → commit → wait for buddy responses → hard reload (`Ctrl+R`). Verify: highlights come back; bubbles are present with correct committed state; buddy responses are present; `commitReady` is `false` (commit button is in disabled/"Commit anyway" state, not green); chat history is present and intact (synthesis turns visible, not cleared).
**Why:** This is the core DoD test. Any missing field or wrong shape means the serialisation is dropping something.
**If data is wrong:** Check the network tab — does the GET /api/highlights response match what was POSTed? If they differ, the shape mismatch is in `sanitizeForSave` or a stale `highlights.json` from before plan-06.

### Session switch — highlights preserved

**What to test:** Add highlights to session A. Switch to session B — no highlights should be visible. Switch back to A — highlights should still be there (not cleared).
**Why:** Before plan-06 the switch effect called `setHighlights([])`. After, it only resets UI state. A regression here would silently delete in-progress work.

### Clear session — two-click confirm flow

**What to test:** Hover over a session row that has highlights. Trash icon should appear (opacity-0 → visible). Click it — confirm pill ("Confirm?") should appear with red background. Click again — highlights disappear. Reload — highlights still gone (persisted clear).
**Why:** The two-click flow is the only safety against accidental clear. Also check: (a) the 3-second auto-dismiss works (click trash, wait 3s without confirming — confirm state disappears); (b) clicking away resets state; (c) tooltip reads "Clear N highlight(s)" with the correct count.
**If the confirm feels too fast/slow:** Adjust the 3-second timeout in `SessionsPanel.handleClearClick`.

### Trash icon discoverability

**What to test:** Is the hover-revealed trash icon discoverable enough, or does it feel like a hidden affordance that users would miss?
**Why:** Hover-reveal trades discoverability for clean default state. For a demo context (low repeat-use, high observation), always-visible might actually be better.
**If it's not discoverable enough:** Change `opacity-0 group-hover/row:opacity-100` to just `opacity-60` (always visible, dimmed) in `SessionsPanel`. One-line change.

### Delete buddy response — Minus icon

**What to test:** Click the Minus icon on a buddy card. The card should disappear immediately. Reload — the card should still be gone.
**Why:** Verifies the `deleteBuddyResponse` handler → save loop works end-to-end. Also check the Minus icon is visually distinct from the RefreshCw icon (they're adjacent) and doesn't hover-red on the wrong button.

### Hydration guard — no spurious POST on initial load

**What to test:** Open the app with an existing `highlights.json`. Open the network tab. Observe: one GET /api/highlights fires. Confirm no POST /api/highlights fires immediately after (only on subsequent user mutations).
**Why:** `skipNextSaveRef` is set just before `setHighlights(loaded)` to flag the hydration render to the save-effect. If the guard breaks, the app redundantly writes the same data back on every page load (harmless but noisy, and a sign the guard logic has drifted).
**If a POST fires on load:** Check that `skipNextSaveRef.current = true` is set BEFORE `setHighlights(loaded)` in PrototypeSlide's load effect. If strict mode is causing double-invocation confusion, check in a production build (`npm run build && npm run preview`).

### Load failure — graceful empty state

**What to test:** Stop the server, then open the app. The prototype slide should load with zero highlights and no crash. Check the browser console — `[persistence] load error` should appear but no unhandled exception.
**Why:** The `loadHighlights` function catches all errors and returns `[]`. A crash here means the catch path isn't working.

### Stale highlights.json — old shape
**What to test:** If `server/data/highlights.json` exists from a version before the current type (e.g. still has `articulation` field, missing `bubbles`), what happens on load?
**Why:** `loadHighlights` does a shallow `commitReady: false` map but no validation. Old-shape data silently hydrates and `undefined` values may surface in the UI.
**If things look broken after a shape change:** Delete `server/data/highlights.json` and start fresh. This is the documented reset — intentional, not a bug.

### Multi-mutation rapid-fire
**What to test:** Stage 3 bubbles in rapid succession (before each buddy response arrives). Reload. Are all three bubbles persisted?
**Why:** The save effect only runs on the *final* committed state after a render. Rapid-fire mutations should coalesce into one save, not race.
**If bubbles are missing:** The save-effect is probably not observing `highlights` correctly. Check the dep array and `skipNextSaveRef` logic.

---

## Implementation notes (don't regress these)

### Two-ref approach in the save effect (plan-06)
The plan-06 implementation uses **two refs** (`hasHydratedRef` + `skipNextSaveRef`), not one. This is deliberate — Claude Code caught a subtle bug in the original one-ref sketch: a plain ref flip after `setHighlights(loaded)` would arrive AFTER the save effect had already run against the hydrated state, firing a redundant save on load. The `skipNextSaveRef` is set synchronously BEFORE `setHighlights(loaded)`, so the guard is reliable regardless of React's effect scheduling.

Future refactors should preserve this pattern. If a future plan simplifies back to one ref, verify no spurious POST fires on hydration (test above).

---

## Demo-critical moments

These are the moments that sell the pitch. They must work on the first try during recording.

- [ ] Session loads, reading pane renders cleanly
- [ ] Select text → yellow highlight appears on mouseup
- [ ] Middle pane auto-opens with active highlight
- [ ] Type in empty input bubble, click +, staged bubble appears (yellow)
- [ ] Facilitator response appears in chat with typing indicator
- [ ] "Commit anyway" link visible while locked
- [ ] Stage another bubble based on facilitator push → classifier eventually unlocks commit
- [ ] Click commit → bubbles AND highlight marks transition yellow → sage green
- [ ] Committed state is read-only, empty input disappears, "Committed" badge shows
- [ ] Switch sessions → session A's highlights stay intact, session B shows empty pane
- [ ] Reload mid-demo → highlights, bubbles, committed state, and buddy responses all come back
- [ ] Clear a session's highlights via the trash icon + confirm flow

---

## Plan-07 additions

### Facilitator session context leak (plan-07)

**What to test:** With P&P Ch 8 loaded, ask "what time period was this written in?" with nothing highlighted. Facilitator should answer with the Regency period / 1813 context without quoting the session metadata verbatim.
**Why:** Session context is injected into the system prompt — the model should use it as background knowledge, not recite it. If the response says "According to the session context: Title: Pride and Prejudice..." that's a leak.
**If it feels wrong:** Reword the session metadata block in `facilitator.ts` from a labelled key-value list to a more prose-like framing so the model treats it as background, not a data source to quote.

### Auto-scroll jerk (plan-07)

**What to test:** Scroll up in the chat to read an earlier message. Trigger a new facilitator response. Verify you are NOT yanked down. Then scroll back to the bottom and trigger another response — verify you ARE scrolled down automatically.
**Why:** The 80px threshold in `atBottomRef` is an estimate. If the user reports being yanked while reading, it needs tightening. If auto-scroll stops working at the bottom, the threshold may need widening.
**If it feels wrong:** Adjust the `< 80` threshold in `FacilitatorChat.handleScroll`. Try `< 40` (tighter) if users are being yanked; try `< 120` (wider) if scroll-to-bottom feels unreliable.

### Commit-gating friction check (plan-07)

**What to test:** After real use, judge whether the classifier gate is doing real work or just adding taps. If the user is constantly hitting "Commit anyway" on work that is genuinely good, the `commitCheck.ts` prompt needs to soften. If commits are landing too easily without synthesis, tighten it.
**Why:** The UX doc flagged this as a friction-for-friction's-sake risk. The gate should feel like a collaborator, not a gatekeeper.
**If too strict:** Soften the "default to false" instruction or add examples of tight-but-worthy descriptions in `server/src/routes/commitCheck.ts`.
**If too loose:** Add a step that checks specifically whether the description is still echoing the passage's phrasing.

---

## Parked issues (being handled elsewhere)

- **× button drift on resize** → resolved in plan-11 (ResizeObserver in `ReadingPane.tsx`)
- **Staged bubble label redundancy** → `feature-02-small-fixes.md` (Fix 01)
- **Clicking a mark inside a selection** — acceptable for prototype
- **Typos triggering facilitator call on edit-save** — feature of the design, not a bug
