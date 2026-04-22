# Plan 07 — Facilitator Loop Fix + Language

Read `BUILD_PLANS/context.md`, `BUILD_PLANS/STATE.md`, and `BUILD_PLANS/design-patterns.md` first. Also re-read `docs/ux-considerations.md` — the "direct-and-iterate" framing and facilitator move library are pulled directly from there.

**Prerequisite:** plans 00-06 complete. Facilitator is wired but not behaving. Chat mode doesn't know session context. Responses drift long. "bubble" is user-facing in prompts.

---

## The problem

Lucy tested the build and found the core mechanic is broken in practice:

1. **The facilitator stops pushing after the first synthesis response.** It goes into chat mode — answering questions, agreeing, saying "I agree with you." This is the validation-machine failure mode the UX doc explicitly warns against.
2. **The facilitator never explicitly tells the user to try writing another description in their own words.** The loop breaks because the nudge toward the next description is missing.
3. **Chat mode has no session context.** Asking "what time period was this written in?" with nothing highlighted fails — the facilitator doesn't know the user is reading P&P Ch 8.
4. **"Facilitator" and "bubble" are user-facing.** They're internal/spec-sheet language, not what a reader sees.
5. **Responses drift long.** Facilitator is running 4+ sentences when it should be 1-2. Buddies running longer than their 2-3 cap.
6. **Chat doesn't auto-scroll** to show the latest message when a new one arrives.
7. **Buddies are leaking "Mode A" / "Mode B"** into their response text — internal decision labels showing up to the reader, making no sense.

---

## What this plan fixes

- **Synthesis loop is load-bearing now.** Every synthesis response MUST end with a pushing move — either a question that names a specific gap, or an explicit "try writing another in your own words" nudge. The prompt is rewritten to mandate this structurally, not suggest it. The framing "direct-and-iterate, not check-and-approve" goes at the top of the prompt so the model understands the job shape before the rules.
- **Session metadata threads into BOTH system prompts.** The facilitator always knows what book, author, chapter/section the user is reading.
- **Rename "Facilitator" → "Chat"** in the UI pane title. Internal variable names and file names stay.
- **Remove "bubble" from user-facing prompts.** Facilitator and buddies both see the user's writing as "their current description." The UX-visual term "bubble" was an internal convenience.
- **Response length tightened:**
  - Facilitator: **1-2 sentences.** Hard cap. Directness is the point.
  - Buddies: **2-3 sentences max.** Slightly tighter than the UX doc's original 2-4 based on real-build testing — responses were drifting long and overwhelming the reader.
- **Buddies never name Mode A or Mode B** in their response text. Internal decision logic stays internal.
- **Chat auto-scrolls** to newest message unless the user is actively scrolled up.

---

## Code patterns

Read `BUILD_PLANS/design-patterns.md`. Patterns that apply:

- Minimal component changes. Most of the work is server-side prompt engineering.
- `useEffect` + ref for the auto-scroll detection (see Q: should we use `IntersectionObserver` instead — no, simpler to read scroll position).

---

## Server changes

### Full rewrite: `server/src/routes/facilitator.ts`

Two prompts, both rewritten. Session metadata flows into both. Response length hard-capped.

**New `FacilitatorRequest` shape** — add session metadata:

```ts
// in shared/types.ts
export type FacilitatorRequest = {
  messages: ChatMessage[]
  /** The highlighted passage, if any. */
  highlight?: string
  /** Session metadata — ALWAYS passed, both modes use it. */
  session?: {
    title: string
    author: string
    section: string
  }
  /** Present only in synthesis mode. */
  synthesisContext?: {
    bubbles: Array<{
      text: string
      isFocus: boolean
    }>
  }
}
```

**New chat system prompt:**

```ts
const CHAT_SYSTEM_PROMPT = `You are a reading companion in a tool called "In Your Own Words." A reader is working through a piece of writing, and you're chatting with them about it.

Your one job: answer their questions about the text. Vocabulary, context, history, what a passage literally says. Be direct and warm.

Behaviour:
- Answer questions at 1-2 sentences. Up to 3 only if the question demands a real explanation.
- If they ask for your interpretation of the text, redirect gently once — "what do you make of it?" — but if they push, give your read. Don't be precious.
- Never lecture. Never list unprompted.
- You are a person, not a textbook. Warm, not sycophantic.

DO NOT push them to synthesise or rewrite unless they've staged a description (you'll see that marked clearly). Pure chat is pure chat.`
```

**New synthesis system prompt — this is the critical one:**

```ts
const SYNTHESIS_SYSTEM_PROMPT = `You are the reading coach in a tool called "In Your Own Words." The reader is trying to articulate their understanding of a specific passage in their own words.

THE JOB SHAPE — read this before the rules:
This loop is not "check and approve." It is direct-and-iterate. Each of your turns pushes the reader toward a specific next move, not "try again." Users often arrive with the pieces of an understanding but haven't strung them together. Your job is frequently to say "you've got the parts — now put them in one sentence." You are a coach. Every response is a push.

The bar for a description to be "commit-worthy":
1. They've identified the real thing the passage is doing (not surface-level).
2. They've connected their observations into a single coherent thought.
3. They've expressed it in their own words (not echoed phrasing).

STRUCTURAL REQUIREMENT for every response:
- 1-2 sentences. Never more.
- MUST end with one of:
  (a) A question that names a specific missing move the reader should address.
  (b) An explicit nudge: "try writing that in your own words now" / "try another description with that in it."
- NEVER end with a statement that just agrees or summarises. NEVER say "I agree" or "that's a good point." NEVER restate their description back to them as if concluding.

Every response pushes toward the NEXT written description. Every response.

If their current description meets all three bars, say so directly in one sentence ("That's commit-worthy — you've got it."). Do not explain why. Do not soften. The reader will decide whether to commit.

Anti-patterns (prompt failure if any of these happens):
- Validating without pushing. If they're MOSTLY right, the response is "you've got X, now connect it to Y — try another one."
- Explaining the passage to them. You are NOT a teacher; you are a coach working on THEIR writing.
- Chat mode drift. Even if they reply to your question conversationally, your next response is still a push. If they ask you something, answer in one sentence and redirect: "...now try another description with that."
- Soft-pedalling. No "great thought!" No "interesting!" The warmth is in caring that they get there, not in praise.

Move library (study the shape — every move names a specific next step):
- "You've got the parts — now put them in one sentence. Try writing it in your own words."   ← the most common move; lean on this one
- "You've got the target but flattened two moves into one — what does [specific thing] add? Try another description with both."
- "You've got the what; now connect it to the how. Write one more in your own words."
- "You're telling me, not showing me — name the specific thing the passage does. Try again."
- "You've answered your own question. Now write it as one thought in your own words."
- "That's it. Commit-worthy."

Response reminders:
- 1-2 sentences.
- End with a question OR a "try again in your own words" nudge.
- Never agree without pushing.`
```

### Route logic — rewrite to build prompt cleanly

```ts
facilitatorRoute.post('/facilitator', async (req, res) => {
  const { messages, highlight, session, synthesisContext } = (req.body ?? {}) as Partial<FacilitatorRequest>

  if (!Array.isArray(messages) || messages.length === 0) {
    return res
      .status(400)
      .json({ error: 'Missing required field: messages (non-empty array of {role, content}).' })
  }

  const isSynthesis = !!synthesisContext
  let system = isSynthesis ? SYNTHESIS_SYSTEM_PROMPT : CHAT_SYSTEM_PROMPT

  // Session metadata — ALWAYS included when provided. Threads into both modes.
  if (session) {
    system += `\n\n--- SESSION CONTEXT ---
The reader is currently in this session:
- Title: ${session.title}
- Author: ${session.author}
- Section: ${session.section}

Remember this context in all responses, even when no specific passage is highlighted.`
  }

  if (highlight) {
    system += `\n\n--- HIGHLIGHTED PASSAGE ---
The reader is currently focused on this passage:
"${highlight}"`
  }

  if (isSynthesis && synthesisContext) {
    const descriptionList = synthesisContext.bubbles
      .map((b, i) => `${i + 1}. ${b.isFocus ? '[FOCUS — newest/edited] ' : ''}${b.text}`)
      .join('\n')
    system += `\n\n--- READER'S CURRENT DESCRIPTIONS ---
${descriptionList}

Respond primarily to the FOCUS description. The others are context for the loop so far.`
  }

  const result = await callClaude({
    system,
    messages: messages.map(({ role, content }) => ({ role, content })),
    maxTokens: 150,   // WAS 600 — hard cap enforces 1-2 sentence facilitator responses
  })

  if (result.kind === 'no-key') {
    return res.status(501).json({ error: result.message })
  }
  if (result.kind === 'error') {
    return res.status(500).json({ error: result.message })
  }

  const body: FacilitatorResponse = { text: result.text }
  res.json(body)
})
```

Facilitator `maxTokens: 150` structurally enforces 1-2 sentence cap. Prompt says 1-2; token limit guarantees it.

### Also rewrite `server/src/routes/commitCheck.ts` prompt

The commit classifier also uses "bubble" language. Replace:

```ts
const COMMIT_CHECK_SYSTEM_PROMPT = `You judge whether a reader has synthesised their understanding of a passage well enough to commit to it.

The bar (ALL THREE must be met):
1. They've identified the real thing the passage is doing, not just surface-level description.
2. They've connected their observations into a single coherent thought — not a list of fragments.
3. They've expressed it in their own words — not echoed or borrowed phrasing.

You receive: the highlighted passage, the reader's current descriptions (their attempts at articulation), and the most recent coach response.

Return JSON ONLY, no other text, in this exact shape:
{"commitReady": <boolean>, "reason": "<one short sentence>"}

Guidance:
- Default to false. Only return true when all three bars are clearly met.
- If the coach's last response was a push ("try this specific thing", "one more step", "connect X to Y", "try another in your own words"), return false — the coach is still working.
- If the coach's last response was a clear release ("commit-worthy", "that's it", "you've got it"), check the descriptions yourself before returning true. The coach can drift toward validation; you are the second opinion.
- Do not soften over time. Multiple rounds of pushing does not mean the reader has earned the commit. Judge the current state only.

Return JSON ONLY. No preamble, no explanation outside the JSON.`
```

Changes: "bubbles" → "descriptions," "Facilitator" → "coach." Substance identical.

### Also tighten `server/src/lib/buddies.ts` — language + length cap + "don't say Mode A/B"

The buddies also say "bubbles" and are drifting into mentioning Mode A/B in user-facing response text. Update:

```ts
const BASE_CONSTRAINTS = `Output format:
- 2-3 sentences. Hard cap. Never more, even if the passage seems to demand it — compress.
- A real take, not a summary. Expert register, plain English.
- Owned opinion, clearly yours. Never hedge with "one could argue" or "some might say" — you have a view.
- Never address the reader directly as "you." Write as if putting your reading on the page.
- NEVER mention "Mode A" or "Mode B" in your response. That's internal decision logic — invisible to the reader. If you find yourself about to write "In Mode A..." or "Since there's no gap (Mode A)..." — stop. Write the reading only.`

const MODE_LOGIC = `Decision — Mode A vs Mode B (internal, never mentioned in response):

You receive the passage AND the reader's current descriptions (their attempts at articulating the passage in their own words).

- If the reader's descriptions capture the real thing the passage is doing, write Mode A: your expert reading of the passage. Ignore their descriptions — they're tight, no work to do on them.
- If the reader's descriptions have a genuine gap (missing the real move, flattening two moves into one, over-generalising, presentism, etc.), write Mode B: one sentence naming the gap in plain terms, then your expert reading of the passage.

Mode B critique names the gap GENERALLY. Do not re-translate the reader's understanding through your specific lens — that's off-target. Just name what they missed, then offer your own reading.

Failure mode to avoid: manufacturing a critique to have something to say. If the reader is tight, Mode A is the honest move. Mode B only when there is real work.

REMINDER: Never write "Mode A" or "Mode B" or "since there's no gap" or any meta-commentary on your own decision. Just respond.`
```

Changes:
- "bubbles" → "descriptions"
- Sentence cap hard at 2-3 (was soft 2-4)
- Explicit anti-leak rule: "don't say Mode A/B" with example phrasings to avoid

Also update `buildBuddyUserMessage` signature — parameter renamed from `bubbles` to `descriptions`:

```ts
export function buildBuddyUserMessage(highlight: string, descriptions: string[]): string {
  if (descriptions.length === 0) {
    return `Passage:\n"${highlight}"\n\nThe reader has not yet articulated their own understanding. Respond to the passage directly.`
  }

  const list = descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')
  return `Passage:\n"${highlight}"\n\nThe reader's current descriptions (attempts at articulating the passage in their own words):\n${list}\n\nRespond per your system prompt. Remember: never mention Mode A or Mode B.`
}
```

Update the caller in `consult.ts` to match (parameter name changed from `bubbles` to `descriptions`).

**Also cap the consult `maxTokens`** — buddies at 2-3 sentences need about 180 tokens. Change from 400 to 200 in `consult.ts`:

```ts
await callClaude({
  system: buddy.systemPrompt,
  messages: [{ role: 'user', content: userMessage }],
  maxTokens: 200,   // WAS 400 — enforces 2-3 sentence cap
})
```

### Similarly cap `verify.ts`

```ts
// in verify.ts
const result = await callClaude({
  system: VERIFY_SYSTEM_PROMPT + personaContext,
  messages: [{ role: 'user', content: userMessage }],
  maxTokens: 200,   // WAS 400
})
```

And replace "bubble" with "description" in the verify system prompt if present.

---

## Client changes

### Update `FacilitatorRequest` call sites

Two sites in `PrototypeSlide.tsx` build the `FacilitatorRequest`:

```tsx
// In sendSynthesisTurn:
const facilitatorBody: FacilitatorRequest = {
  messages: historyBeforeCall,
  highlight: highlightText,
  session: activeSession
    ? {
        title: activeSession.title,
        author: activeSession.author,
        section: activeSession.section,
      }
    : undefined,
  synthesisContext: {
    bubbles: currentBubbles.map((b) => ({
      text: b.text,
      isFocus: b.id === focusBubbleId,
    })),
  },
}

// In sendChatMessage:
const body: FacilitatorRequest = {
  messages: historyBeforeCall,
  highlight: activeHighlight?.text,
  session: activeSession
    ? {
        title: activeSession.title,
        author: activeSession.author,
        section: activeSession.section,
      }
    : undefined,
}
```

Both calls now pass `session`. This threads the context into both system prompts.

`activeSession` is already computed at the top of `PrototypeSlide`: `sessions.find((s) => s.id === activeSessionId) ?? null`. Reuse it.

### Rename "Facilitator" to "Chat" in UI — pane title only

In `FacilitatorChat.tsx`, the header currently reads "Facilitator":

```tsx
<div className="border-border-subtle flex items-center border-b px-4 pb-2 pt-4">
  <p className="text-text-tertiary text-xs uppercase tracking-widest">Chat</p>
</div>
```

Component filename and variable names stay `FacilitatorChat` / `facilitatorLoading` etc. — they're internal and changing them ripples too much for too little benefit. Only the visible pane title changes.

Also update the `EmptyState` copy in the same file to match:

```tsx
function EmptyState() {
  return (
    <div className="text-text-tertiary flex h-full flex-col items-center justify-center px-6 text-center text-sm">
      <p>Ask anything about the passage. Stage a description to get focused feedback.</p>
    </div>
  )
}
```

("Stage a bubble" → "Stage a description.")

### Auto-scroll on new message

Add a ref on the scroll container + an effect that scrolls to bottom when `messages.length` or `loading` changes — BUT only if the user is currently at the bottom (within ~80px). If they've scrolled up to read earlier messages, don't yank them down.

```tsx
// in FacilitatorChat
const scrollRef = useRef<HTMLDivElement>(null)
const atBottomRef = useRef(true)   // starts true, updates on scroll

useEffect(() => {
  const el = scrollRef.current
  if (!el) return
  // Only auto-scroll if user is at bottom (or close to it)
  if (atBottomRef.current) {
    el.scrollTop = el.scrollHeight
  }
}, [messages.length, loading])

function handleScroll() {
  const el = scrollRef.current
  if (!el) return
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  atBottomRef.current = distanceFromBottom < 80
}
```

Then on the scroll div: `ref={scrollRef}` and `onScroll={handleScroll}`.

Why the 80px buffer: if the user has scrolled up even slightly to read, we leave them alone. If they're at or near the bottom (within ~3 lines), we snap. Standard chat UX.

### No "bubble" in any client-facing copy

Grep the client for user-visible occurrences of "bubble" and replace with "description" or just rephrase:

Known sites (non-exhaustive — Claude Code should grep):
- `InYourOwnWordsPane` instruction text: *"Highlight some text to start working on an understanding, or click an existing highlight to revisit it."* — this one's fine, doesn't say "bubble."
- `EmptyInputBubble` placeholder: `"In your own words…"` — fine, it's the mechanic name, not "bubble."
- `FacilitatorChat` synthesis message label (currently "Staged:") — fine as-is.
- `BuddyPanel` states — grep for any "bubble" references.

Internal variable names (`bubbles`, `addBubble`, `EmptyInputBubble` component, etc.) stay — those are code-facing, not user-facing. Ripping them out is a scope-creep refactor for no user benefit.

---

## Files to modify

```
shared/types.ts                                         ← FacilitatorRequest.session added
server/src/routes/facilitator.ts                        ← Two new system prompts (with direct-and-iterate framing), session handling, maxTokens: 150
server/src/routes/commitCheck.ts                        ← "bubbles" → "descriptions" in prompt
server/src/lib/buddies.ts                               ← BASE_CONSTRAINTS cap 2-3, MODE_LOGIC anti-leak, buildBuddyUserMessage renamed param
server/src/routes/consult.ts                            ← update to match buildBuddyUserMessage param rename, maxTokens: 200
server/src/routes/verify.ts                             ← maxTokens: 200, "bubble" → "description" if present
client/src/components/slides/PrototypeSlide.tsx         ← Thread session into FacilitatorRequest (both call sites)
client/src/components/prototype/FacilitatorChat.tsx     ← Rename "Facilitator" → "Chat" in title, update EmptyState copy, add auto-scroll
```

No files created, no new components. All focused on prompts + language + small client behaviour fix.

---

## Constraints

- **Two modes stay** — chat and synthesis. We're hardening, not collapsing.
- **Session metadata flows into both modes.** Non-negotiable — the facilitator must always know what the reader is reading.
- **Every synthesis response ends with a pushing move.** If Claude Code writes a test prompt that passes the system prompt but the response doesn't end with a question or nudge, that's a prompt failure and the prompt needs another pass.
- **No Mode A/B in user-visible response text.** Internal decision logic only.
- **Facilitator: 1-2 sentences. Buddies: 2-3 sentences.** Hard-capped at the API level via maxTokens.
- **"bubble" stays in code, leaves user-facing text.** Internal variable names unchanged.
- **Match `BUILD_PLANS/design-patterns.md`.**
- **Don't start the dev server.** Lucy verifies visually.

---

## Out of scope

- Layout restructure (plan 08)
- Vertical buddies pane (plan 08)
- In Your Own Words fixes (plan 09)
- Small polish items (plan 10)
- Classifier pipeline change (fire-and-forget, etc.) — parked as TEST_LIST item
- Streaming responses — parked

---

## Definition of done

- `shared/types.ts` has `FacilitatorRequest.session` as an optional object with title/author/section.
- Both `sendSynthesisTurn` and `sendChatMessage` in `PrototypeSlide` pass `session` (when available) in the request body.
- `server/src/routes/facilitator.ts` has both system prompts rewritten with the direct-and-iterate framing and structural requirements. Session metadata threads into both.
- Facilitator `maxTokens: 150`. Buddies `maxTokens: 200`. Verify `maxTokens: 200`.
- `server/src/lib/buddies.ts` — `BASE_CONSTRAINTS` cap 2-3, `MODE_LOGIC` has explicit anti-leak rule ("don't say Mode A/B"), `buildBuddyUserMessage` renamed `bubbles` → `descriptions`.
- `server/src/routes/commitCheck.ts` — "bubbles" → "descriptions" throughout the prompt.
- Pane title shows "Chat" not "Facilitator."
- Auto-scroll behaves correctly:
  - User at bottom → new message scrolls to show it.
  - User scrolled up reading earlier messages → new message does NOT jerk them down.
  - Typing indicator (loading state) triggers auto-scroll if at bottom.
- Manual test: ask "what time period was this written in?" with nothing highlighted in the P&P session. Facilitator correctly names 1813/Regency without being told.
- Manual test: stage a vague description. Facilitator response ends with a specific push, not a statement.
- Manual test: stage a tight commit-worthy description. Facilitator says so in one sentence and the classifier unlocks commit.
- Manual test: after Facilitator push, ask a conversational question ("oh really? but what about Mr Darcy's letter?"). Facilitator answers briefly AND redirects back to the synthesis loop ("...now try another description").
- Manual test: trigger multiple buddy responses across multiple highlights. Confirm NONE of them contain the literal strings "Mode A" or "Mode B."
- `npm run typecheck` passes both workspaces.
- `BUILD_PLANS/STATE.md` updated — plan-07 done, plan-08 next.
- `BUILD_PLANS/TEST_LIST.md` updated with:
  - New item: "Facilitator session context leak" — verify session metadata doesn't appear verbatim in responses (model should use it as context, not quote it).
  - New item: "Auto-scroll jerk" — verify the 80px buffer is right; adjust if user reports being yanked when reading older messages.
  - New item: "Commit-gating friction check" — after real use, judge whether the classifier gate is doing real work or just adding taps (the UX doc flagged this as a friction-for-friction's-sake risk). If user is constantly hitting "Commit anyway" on work that's genuinely good, the classifier prompt in `commitCheck.ts` needs to soften. If commits are landing too easily without synthesis, tighten it further.
- Summary includes: whether the synthesis loop feels like it's pushing on every turn now, whether 1-2 sentences feels tight-and-direct or clipped, whether 2-3 sentence buddies read as concise or phoning-it-in, whether chat mode with session context answered the time-period question correctly, whether auto-scroll feels right, whether Mode A/B labels have fully stopped leaking.
