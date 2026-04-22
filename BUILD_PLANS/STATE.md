# STATE — In My Own Words

What's built, what's working. Updated at the end of every build session.

`context.md` = stable architecture. `STATE.md` = moving progress marker.

---

**Last updated:** 2026-04-21 (plan-08 complete)

---

## What's built and working

### Deck shell
- `DeckLayout`, `Toolbar`, `SlideNavMenu`, `DeckContext`, `PlaceholderSlide`
- Forward/back navigation between 6 slides
- "Jump to prototype" shortcut in toolbar
- Right-side slide-out nav menu with link to lucymatch.com

### Static content slides
- `TitleSlide`, `ConceptSlide`, `UserJourneySlide`, `ConsiderationsSlide`, `NextStepsSlide`
- All render; copy is still placeholder in some (Lucy to finalise separately — not blocking build)

### Prototype slide shell
- `PrototypeSlide` — layout host, fetches sessions.json and session .txt files, owns activeSessionId + highlights state
- `SessionsPanel` — collapsible left drawer, two sessions listed, session switching works
- `ReadingPane` — renders source text; supports highlight creation (mouseup) and deletion (× button)
- `InYourOwnWordsPane` — full bubble flow (see plan-03) + commit states (plan-04)
- `FacilitatorChat` — real chat component: message list, input, typing indicator, wired to /api/facilitator
- `BuddyPanel` — three buddy cards, Verify, re-run, disabled Add-a-buddy placeholder
- `client/public/sessions.json` — session manifest
- Both .txt session files confirmed present in `client/public/sessions/`

### Highlight mechanic (plan-02)
- `shared/types.ts` — `HighlightRange` type added; `Highlight` updated with `ranges: HighlightRange[]`
- `client/src/lib/highlights.ts` — pure helpers: `splitIntoParagraphs`, `computeRangesFromSelection`, `buildHighlightText`, `segmentParagraph`
- `globals.css` — `--color-highlight: oklch(0.94 0.10 95)` added to `@theme`
- Selecting text in reading pane → yellow `<mark>` on mouseup (single-paragraph and multi-paragraph)
- × button in left margin per highlight; clicking deletes the entire highlight
- Highlights persist via `/api/highlights`; survive reload and session switch

### Bubble flow (plan-03)
- `shared/types.ts` — `Bubble` type added; `Highlight.articulation` replaced with `bubbles: Bubble[]`
- `globals.css` — `--color-commit` added to `@theme`; `--bubbles-pane-width` + `--bubbles-pane-width-collapsed` added to `:root`
- `PrototypeSlide` — owns `activeHighlightId`; sets on new highlight + click; clears on delete + session switch; owns `addBubble` / `updateBubble` / `deleteBubble` handlers
- `ReadingPane` — marks are clickable to activate; active mark has orange ring via `data-active` + ring classes
- `InYourOwnWordsPane` — full rewrite: 60px collapsed strip (chevron) / 360px expanded (header + scroll area + commit footer); auto-expands on active highlight change; manual toggle via chevron; `EmptyInputBubble` + `StagedBubble` integrated
- `EmptyInputBubble` — textarea + stage (+) button; clears on stage; Cmd/Ctrl+Enter shortcut
- `StagedBubble` — yellow bubble; inline edit (pencil/check/×); delete (×); empty save = delete

### Facilitator wire-up (plan-04)
- `shared/types.ts` — `Highlight.commitReady: boolean` added; `ChatMessage.kind?: 'chat' | 'synthesis'` added; `FacilitatorRequest.synthesisContext?` added; `CommitCheckRequest` / `CommitCheckResponse` types added
- `server/src/routes/commitCheck.ts` — NEW; POST /api/commit-check; Haiku classifier; returns `{ commitReady, reason }`
- `server/src/routes/facilitator.ts` — dual system prompts (CHAT_SYSTEM_PROMPT / SYNTHESIS_SYSTEM_PROMPT); switches on `synthesisContext` presence
- `server/src/index.ts` — `commitCheckRoute` registered
- `PrototypeSlide` — owns `chatHistory` + `facilitatorLoading`; `sendChatMessage` (chat mode, no classifier); `sendSynthesisTurn` (synthesis mode, two-call sequential: facilitator then classifier); `commitHighlight`; session switch clears chat history; bubble mutations wire to synthesis
- `FacilitatorChat` — real chat: `ChatBubble` (user right/bg-user-bubble, assistant left/no-bg), synthesis user messages get "Staged:" label; `TypingIndicator` (three-dot bounce); `ChatInput` (Enter sends, Shift+Enter newline); `EmptyState`
- `InYourOwnWordsPane` — commit footer: disabled-with-"Commit anyway" link → enabled (commitReady) → "Committed" badge; hides `EmptyInputBubble` when committed; stage/edit buttons disabled during facilitator loading
- `StagedBubble` — `data-committed` flips bg-highlight → bg-commit (transition-colors duration-500); edit/delete hidden when committed; `disabled` prop for loading gate
- `ReadingPane` — marks transition yellow → green on commit (`data-committed:bg-commit`, `transition-colors duration-500`); `commitReady: false` added to new highlight creation

### Buddy wire-up (plan-05)
- `shared/types.ts` — `BuddyResponse` updated: `id: string` (required), `verification?`, `verifying?`, `createdAt: string`; `verified?: boolean` dropped. `ConsultRequest.bubbles: string[]` replaces `articulation`.
- `server/src/lib/buddies.ts` — full persona rewrite: English Teacher, Historian, Reframer. `buildBuddyUserMessage` takes `bubbles: string[]`. Mode A/B decision logic embedded in each system prompt via shared `MODE_LOGIC` constant.
- `server/src/routes/consult.ts` — accepts `bubbles[]`, passes to `buildBuddyUserMessage`. Server generates `id`/`createdAt` for each `BuddyResponse`. Existing parallel fan-out logic unchanged.
- `PrototypeSlide` — `consultingHighlights: Set<string>` state; `sendConsult` (staggered 250ms per card); `reRunBuddy` (re-fires all, takes matching buddy); `verifyBuddyResponse` (marks `verifying: true`, appends `verification`). `addBubble` fires consult on first bubble only (guard: `bubbles.length === 0 && buddyResponses.length === 0`).
- `BuddyPanel` — full rewrite: `EmptyState`, `NotYetState`, `LoadingSkeleton` (inline + full-height), `BuddyCard` (name, response, Verify link, re-run RefreshCw icon, verification block). Disabled "Add a buddy" placeholder button. `isConsulting` drives skeleton visibility.

### Highlight-scoped chats (plan-08)
- `shared/types.ts` — `Highlight.chatHistory: ChatMessage[]` added
- `PrototypeSlide` — top-level `chatHistory` state and `chatHistoryRef` removed; session-switch effect no longer clears chat; `addHighlight` defaults `chatHistory: []`; `sendSynthesisTurn` and `sendChatMessage` read/write the specific highlight's chat (captured `highlightId`, not `activeHighlightId`) — handles mid-call highlight switch; `activeChatHistory` derived from `activeHighlight`
- `FacilitatorChat` — `hasActiveHighlight` prop added; shows "Highlight a passage to start a conversation about it." empty state with input hidden when no highlight active
- `persistence.ts` — `chatHistory: h.chatHistory ?? []` default on hydration for older saves
- `ReadingPane` — new highlight objects include `chatHistory: []`

### Persistence (plan-06)

- `client/src/lib/persistence.ts` — NEW; `loadHighlights` (GET /api/highlights, maps `commitReady: false` on hydration), `saveHighlights` (POST /api/highlights, fire-and-forget), `sanitizeForSave` (strips `commitReady`).
- `shared/types.ts` — `Highlight.commitReady` comment updated to "Transient. Stripped before save."
- `server/src/lib/storage.ts` — ENOENT handling already present; no change needed.
- `PrototypeSlide` — load-on-mount effect; save-on-change `useEffect([highlights])` with `hasHydratedRef` + `skipNextSaveRef` hydration guard; session-switch effect no longer clears highlights (only resets `activeHighlightId` + `chatHistory`); `currentSessionHighlights` memo filters by session for rendering; `highlightCountsBySession` memo for session panel counts; `deleteBuddyResponse` handler; `clearSessionHighlights` handler.
- `SessionsPanel` — new props `onClearSession` + `highlightCountsBySession`; rows restructured as container + primary-select button + optional trash button; hover-revealed `Trash2` icon (opacity-0 → opacity-100 on row hover/focus); two-click confirm flow (`pendingClearId` state, 3s auto-dismiss); confirm state renders red "Confirm?" pill.
- `BuddyPanel` — `onDeleteResponse` prop added; `BuddyCard` gains a `Minus` icon button next to RefreshCw; clicking removes that single response from the highlight.

### Server (built, not end-to-end tested)
- `GET  /api/health` — returns `{ ok, hasApiKey }`
- `POST /api/consult` — fans buddy calls in parallel, returns array of responses
- `GET  /api/buddies` — buddy roster
- `POST /api/facilitator` — multi-turn chat (chat + synthesis modes)
- `POST /api/commit-check` — Haiku classifier for commit-readiness
- `POST /api/verify` — re-check a buddy response
- `GET  /api/highlights` — reads `server/data/highlights.json`
- `POST /api/highlights` — writes `server/data/highlights.json`

### Decisions locked (see `docs/ux-considerations.md`, `docs/ai-design.md`)
- Core mechanic: paraphrase-to-commit
- Facilitator gates the commit (soft gate — "Commit anyway" override)
- 3 hardcoded buddies: English Teacher, Historian, Reframer
- Buddies use Mode A / Mode B logic
- "Verify this" button per buddy response
- Session-scoped state (chat context, highlights belong to a session)
- Middle pane (In Your Own Words): collapsed by default, auto-opens on first highlight
- Right column: Facilitator chat on top, Buddies stacked below (not side-by-side)
- No PDF ingestion in app — hardcoded .txt sessions only
- No streaming — loading indicators do the work
- Committed bubbles are read-only; to redo, delete the whole highlight

---

## What's NOT built yet

- Nothing on the main build track. Plan 06 is the last core plan.

---

## What's next

**Plan 00** ✓ — `plan-00-prep.md` — done.

**Plan 01** ✓ — `plan-01-prototype-shell-and-sessions.md` — done.

**Plan 02** ✓ — `plan-02-highlight-mechanic.md` — done.

**Plan 03** ✓ — `plan-03-bubble-flow.md` — done.

**Plan 04** ✓ — `plan-04-facilitator-wireup.md` — done. Facilitator wired; two-call synthesis flow; commit states; yellow→green transition.

**Plan 05** ✓ — `plan-05-buddies-wireup.md` — done. Real personas with Mode A/B logic; consult fires on first bubble staged; staggered card arrival; Verify + re-run; disabled Add-a-buddy placeholder.

**Plan 06** ✓ — `plan-06-persistence.md` — done. Highlights survive reload and session switch; `commitReady` stripped on save; hydration guard prevents spurious POST on initial load; per-session clear with confirm flow; delete-one buddy response (Minus icon).

**Plan 08** ✓ — `plan-08-highlight-scoped-chats.md` — done. Chat moved from session-scoped top-level state to per-highlight `chatHistory` field. Every write targets the captured `highlightId`, not `activeHighlightId` — mid-call highlight switch handled. Chat persists via existing save effect. `FacilitatorChat` shows empty state with input hidden when no highlight active. Committed highlights keep chat open.

After plan-06 the main build track is complete. Post-MVP work lives in feature plans (see BUILD_PLANS/feature-*.md):
- `feature-01-resize-aware-delete-button.md` — × button tracks highlight on viewport resize
- `feature-02-small-fixes.md` — rolling bucket for one-liner polish fixes
- `feature-03-draggable-facilitator-buddies-divider.md` — draggable divider between Facilitator chat and Buddy panel in the right column

Day 3 work (deck, voiceover, screen recordings) is the priority after plan-06. Feature plans run only if time remains after pitch prep.

---

## Known issues / debt

- No end-to-end server test — first real Anthropic API call is plan-04's facilitator; needs manual verification with API key.
- Classifier (commit-check) prompt conservatism not yet calibrated against real user responses — may need tuning after manual testing.
- `EmptyInputBubble` and `StagedBubble` `disabled` state does not prevent the user from typing in the textarea (only the submit buttons are gated). Acceptable for prototype.

---

## Open questions parked for later

- A/B mode classifier: one upstream cheap call, or let each buddy decide? (Plan 05 territory — see `docs/ai-design.md`.)
- When a highlight is deleted, do its bubbles + Facilitator exchanges also delete, or move into a "trash" view? (Plan 02 / 03 territory — deferred.)
- Scroll-to-bottom in FacilitatorChat: not implemented. Long conversations will require manual scroll. Acceptable for prototype; add as a feature plan if needed.
