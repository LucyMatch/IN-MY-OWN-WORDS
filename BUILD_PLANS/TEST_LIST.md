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

### Resize after placing highlights (plan-02, known limitation)
**What to test:** Place highlights. Resize the window or collapse/expand a panel. Do the × delete buttons drift?
**Why:** Known issue — `useLayoutEffect` doesn't re-run on resize.
**If it feels wrong:** `feature-01-resize-aware-delete-button.md` covers the fix. Implement if time allows.

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

## Lenses (plan-09)

### Lens demarcation clarity
**What to test:** Invoke a persona. Read the response that lands in chat. Does the combination of italic text + right-alignment + left/right accent border + persona header above read as clearly distinct from facilitator responses? Or does it blur with synthesis responses (which are also assistant-role)?
**Why:** The visual treatment is doing double duty — it signals "this is a different voice, not the coach" AND anchors the framing phrase from the model. If the combo feels over-engineered or still muddy, simplify: drop the header and rely on italics/alignment alone, or vice versa.
**If it feels wrong:** Edit `LensBubble` in `client/src/components/prototype/FacilitatorChat.tsx`. Start by toggling the header off (`{message.personaName} — a different lens`) — if the framing phrase from the model carries it, the header is redundant. If still unclear, try a left-border-only treatment (drop `border-r-2`) so it reads more like a blockquote.

### Framing phrase consistency
**What to test:** Invoke each of the three personas across several different passages. Do responses reliably open with "If I were [persona name] looking at this, I'd say…" or a close variant? Or does the model occasionally drop the phrase and dive straight into the reading?
**Why:** The framing phrase is the semantic marker that reinforces whose lens the reader is getting — it's not just politeness. The `BASE_CONSTRAINTS` in `server/src/lib/personas.ts` requires it, but models drift under long system prompts.
**If it feels wrong:** Tighten the opening instruction in `BASE_CONSTRAINTS`. Try moving it to the very last line of the system prompt (models attend more to recency) and adding a negative: "Never open without your framing phrase — the reader must know whose voice this is immediately."

### Persona button discoverability
**What to test:** Ask a fresh viewer (or pretend to be one) to try using a lens. Is the vertical pane on the far right noticed? Does the default-expanded state help or feel intrusive? Does the pane label ("Use a context lens") communicate intent?
**Why:** The pull model only works if the reader knows the option exists. A pane that blends into the layout or a label that doesn't explain what a "lens" is will go unused.
**If it feels wrong:** (a) Pane not noticed → try an accent-coloured label or a subtle icon (e.g. `Eye` from lucide-react) in the header. (b) Label unclear → rename to "Read it differently" or "Another angle." (c) Pane feels intrusive → default to collapsed (`lensPaneExpanded` initial state in `PrototypeSlide`).

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

- **× button drift on resize** → `feature-01-resize-aware-delete-button.md`
- **Staged bubble label redundancy** → `feature-02-small-fixes.md` (Fix 01)
- **Clicking a mark inside a selection** — acceptable for prototype
- **Typos triggering facilitator call on edit-save** — feature of the design, not a bug
