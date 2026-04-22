# Plan 08 — Highlight-Scoped Chats

Read `BUILD_PLANS/context.md`, `BUILD_PLANS/STATE.md`, and `BUILD_PLANS/design-patterns.md` first.

**Prerequisite:** plan-07 complete. Facilitator loop is pushing reliably; session context threads through. Testing revealed context bleed — chat carries over across highlights, confusing the facilitator.

---

## The problem

Chat history is currently session-scoped. When the reader switches highlights mid-session, the facilitator still sees the previous highlight's chat in its context window. This causes the facilitator to respond as if the reader is still working on the old passage — a real failure of the core mechanic.

Observed after plan-07 testing: commit passage A, highlight passage B, stage a description, facilitator references the A descriptions in its response.

---

## What this plan fixes

- **Chat moves from top-level state to per-highlight state.** Each highlight owns its own chat thread.
- **Switching highlights = switching conversations.** Clean context boundary, matches how the reader actually thinks.
- **Chat persists with its highlight.** Reload the app → the conversation for a committed passage comes back with it.
- **Chat panel shows empty state when no highlight is active.** No more general chat mode. The reader must anchor their questions to a passage.
- **Committed highlights keep their chat open** — reader can revisit and continue chatting. The synthesis loop stops firing (no new descriptions being staged) but the thread stays alive.
- **Deleted highlights take their chat with them.** Matches the existing artifact deletion model.

---

## Why this matters for the pitch

Every committed highlight becomes a rich artifact: the passage, your descriptions, AND the conversation that got you there. Revisiting a committed passage shows the shape of your thinking, not just the conclusion. That's a real mastery artifact — distinct from "here are your notes."

Pitch angle:
> "Every other reading tool gives you highlights and notes. This gives you the shape of your thinking about a passage — preserved with it."

---

## Code patterns

Read `BUILD_PLANS/design-patterns.md`. Patterns that apply:

- Canonical component shape.
- `cn()` on every className.
- No new server endpoints — all the work is client-side state migration + persistence type update.

---

## Data model changes

### `shared/types.ts`

Add `chatHistory` to `Highlight`:

```ts
export type Highlight = {
  id: string
  sessionId: string
  ranges: HighlightRange[]
  text: string
  bubbles: Bubble[]
  buddyResponses: BuddyResponse[]
  /**
   * Chat thread for this highlight. Added in plan-08.
   * Persists with the highlight — each highlight owns its conversation.
   */
  chatHistory: ChatMessage[]
  /** Transient. Stripped before save. Defaults false on load. */
  commitReady: boolean
  createdAt: string
}
```

No other type changes.

---

## Client changes

### `PrototypeSlide.tsx` — the big refactor

**Remove top-level chat state:**

```tsx
// DELETE these lines:
const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
const chatHistoryRef = useRef<ChatMessage[]>(chatHistory)
useEffect(() => {
  chatHistoryRef.current = chatHistory
}, [chatHistory])
```

**Remove chat-clearing from the session-switch effect:**

```tsx
useEffect(() => {
  setActiveHighlightId(null)
  // setChatHistory([])   ← DELETE this line
}, [activeSessionId])
```

Session switch only resets `activeHighlightId`. Chat lives on highlights, which are already filtered by session at render time — no explicit clear needed.

**Derive active chat from active highlight:**

```tsx
const activeHighlight = highlights.find((h) => h.id === activeHighlightId) ?? null
const activeChatHistory = activeHighlight?.chatHistory ?? []
```

**New helper for appending to the active highlight's chat:**

```tsx
function appendToActiveChat(message: ChatMessage) {
  if (!activeHighlightId) return
  setHighlights((prev) =>
    prev.map((h) =>
      h.id === activeHighlightId
        ? { ...h, chatHistory: [...h.chatHistory, message] }
        : h,
    ),
  )
}
```

Note: this is a write to `highlights`, which means it rides through the existing save-effect. Chat persistence is free.

**Rewrite `sendSynthesisTurn`** — reads from the highlight, writes to the highlight:

```tsx
async function sendSynthesisTurn(
  highlightId: string,
  focusBubbleId: string,
  highlightText: string,
  currentBubbles: Bubble[],
) {
  const focusBubble = currentBubbles.find((b) => b.id === focusBubbleId)
  if (!focusBubble) return

  // Read the current chat for this specific highlight, not top-level state.
  // We need the current state at call time, so we read fresh from the state closure.
  const highlight = highlights.find((h) => h.id === highlightId)
  const currentChat = highlight?.chatHistory ?? []

  const syntheticUserMessage: ChatMessage = {
    role: 'user',
    content: `[staged: '${focusBubble.text}']`,
    kind: 'synthesis',
  }

  const historyBeforeCall = [...currentChat, syntheticUserMessage]

  // Append the synthetic user message immediately (for UI feedback)
  setHighlights((prev) =>
    prev.map((h) =>
      h.id === highlightId
        ? { ...h, chatHistory: [...h.chatHistory, syntheticUserMessage] }
        : h,
    ),
  )
  setFacilitatorLoading(true)

  try {
    const facilitatorBody: FacilitatorRequest = {
      messages: historyBeforeCall,
      highlight: highlightText,
      session: activeSession
        ? { title: activeSession.title, author: activeSession.author, section: activeSession.section }
        : undefined,
      synthesisContext: {
        bubbles: currentBubbles.map((b) => ({
          text: b.text,
          isFocus: b.id === focusBubbleId,
        })),
      },
    }

    const facilitatorRes = await fetch('/api/facilitator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(facilitatorBody),
    })

    if (!facilitatorRes.ok) {
      const errMsg =
        facilitatorRes.status === 501
          ? 'Facilitator unavailable — API key not configured.'
          : 'Facilitator call failed. Please try again.'
      // Append error to THIS highlight's chat, not active — in case user switched mid-call
      setHighlights((prev) =>
        prev.map((h) =>
          h.id === highlightId
            ? { ...h, chatHistory: [...h.chatHistory, { role: 'assistant', content: errMsg, kind: 'chat' }] }
            : h,
        ),
      )
      return
    }

    const facilitatorData = (await facilitatorRes.json()) as FacilitatorResponse
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: facilitatorData.text,
      kind: 'synthesis',
    }
    setHighlights((prev) =>
      prev.map((h) =>
        h.id === highlightId
          ? { ...h, chatHistory: [...h.chatHistory, assistantMessage] }
          : h,
      ),
    )

    // Classifier call — same as before
    const commitBody: CommitCheckRequest = {
      highlight: highlightText,
      bubbles: currentBubbles.map((b) => b.text),
      facilitatorResponse: facilitatorData.text,
    }

    const commitRes = await fetch('/api/commit-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(commitBody),
    })

    if (commitRes.ok) {
      const commitData = (await commitRes.json()) as CommitCheckResponse
      setHighlights((prev) =>
        prev.map((h) =>
          h.id === highlightId ? { ...h, commitReady: commitData.commitReady } : h,
        ),
      )
    }
  } catch {
    setHighlights((prev) =>
      prev.map((h) =>
        h.id === highlightId
          ? { ...h, chatHistory: [...h.chatHistory, { role: 'assistant', content: 'Something went wrong.', kind: 'chat' }] }
          : h,
      ),
    )
  } finally {
    setFacilitatorLoading(false)
  }
}
```

Critical detail: every chat write targets the **specific `highlightId`** that the call was made for, not `activeHighlightId`. This handles the mid-call highlight-switch edge case — the response lands on the correct highlight's chat even if the user has moved on. They'll see the response when they come back.

**Rewrite `sendChatMessage`** — now requires an active highlight:

```tsx
async function sendChatMessage(text: string) {
  if (!activeHighlightId) return  // no-op if no highlight

  const highlightId = activeHighlightId
  const activeHighlight = highlights.find((h) => h.id === highlightId)
  if (!activeHighlight) return

  const userMessage: ChatMessage = { role: 'user', content: text, kind: 'chat' }
  const historyBeforeCall = [...activeHighlight.chatHistory, userMessage]

  setHighlights((prev) =>
    prev.map((h) =>
      h.id === highlightId
        ? { ...h, chatHistory: [...h.chatHistory, userMessage] }
        : h,
    ),
  )
  setFacilitatorLoading(true)

  try {
    const body: FacilitatorRequest = {
      messages: historyBeforeCall,
      highlight: activeHighlight.text,
      session: activeSession
        ? { title: activeSession.title, author: activeSession.author, section: activeSession.section }
        : undefined,
    }

    const res = await fetch('/api/facilitator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errMsg =
        res.status === 501
          ? 'Facilitator unavailable — API key not configured.'
          : 'Facilitator call failed. Please try again.'
      setHighlights((prev) =>
        prev.map((h) =>
          h.id === highlightId
            ? { ...h, chatHistory: [...h.chatHistory, { role: 'assistant', content: errMsg, kind: 'chat' }] }
            : h,
        ),
      )
      return
    }

    const data = (await res.json()) as FacilitatorResponse
    setHighlights((prev) =>
      prev.map((h) =>
        h.id === highlightId
          ? { ...h, chatHistory: [...h.chatHistory, { role: 'assistant', content: data.text, kind: 'chat' }] }
          : h,
      ),
    )
  } catch {
    setHighlights((prev) =>
      prev.map((h) =>
        h.id === highlightId
          ? { ...h, chatHistory: [...h.chatHistory, { role: 'assistant', content: 'Something went wrong.', kind: 'chat' }] }
          : h,
      ),
    )
  } finally {
    setFacilitatorLoading(false)
  }
}
```

**`addHighlight`** initialises `chatHistory: []`:

```tsx
function addHighlight(h: Highlight) {
  const withChat: Highlight = { ...h, chatHistory: h.chatHistory ?? [] }
  setHighlights((prev) => [...prev, withChat])
  setActiveHighlightId(withChat.id)
}
```

Defensive default — callers of `addHighlight` may not always set the field depending on how the `ReadingPane` builds the new highlight. Safer to default here.

**Update the `<FacilitatorChat>` props at render time:**

```tsx
<FacilitatorChat
  messages={activeChatHistory}
  loading={facilitatorLoading}
  onSend={sendChatMessage}
  hasActiveHighlight={activeHighlightId !== null}
/>
```

### `FacilitatorChat.tsx` — empty state

Add `hasActiveHighlight` prop. When `false`, show an empty state and hide the chat input:

```tsx
type FacilitatorChatProps = {
  messages: ChatMessage[]
  loading: boolean
  onSend: (text: string) => void
  hasActiveHighlight: boolean
}

export function FacilitatorChat({ messages, loading, onSend, hasActiveHighlight }: FacilitatorChatProps) {
  if (!hasActiveHighlight) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-border-subtle flex items-center border-b px-4 pb-2 pt-4">
          <p className="text-text-tertiary text-xs uppercase tracking-widest">Chat</p>
        </div>
        <div className="text-text-tertiary flex flex-1 flex-col items-center justify-center px-6 text-center text-sm">
          <p>Highlight a passage to start a conversation about it.</p>
        </div>
      </div>
    )
  }

  // ... existing render with messages + input
}
```

The empty state matches the existing `NotYetState` pattern in `BuddyPanel` — muted, centred, instruction-oriented.

### `persistence.ts` — default `chatHistory` on load

```ts
export async function loadHighlights(): Promise<Highlight[]> {
  try {
    const response = await fetch('/api/highlights')
    if (!response.ok) {
      console.error('[persistence] load failed with status', response.status)
      return []
    }
    const data = (await response.json()) as Highlight[]
    return data.map((h) => ({
      ...h,
      commitReady: false,
      chatHistory: h.chatHistory ?? [],  // NEW — default for older saves
    }))
  } catch (err) {
    console.error('[persistence] load error', err)
    return []
  }
}
```

Same pattern as `commitReady`. Any old `highlights.json` that predates this plan hydrates cleanly with empty chat.

No change to `sanitizeForSave` — chat is persistent state, not transient like `commitReady`.

### `ReadingPane.tsx` — ensure new highlights initialise with empty chat

Whatever code path creates a `Highlight` object needs to include `chatHistory: []`. Claude Code should grep for `Highlight` object literals and confirm. Most likely just one site in `ReadingPane` or a helper in `client/src/lib/highlights.ts`.

---

## Files to modify

```
shared/types.ts                                        ← Add chatHistory to Highlight
client/src/components/slides/PrototypeSlide.tsx       ← Remove top-level chat state, rewrite sendSynthesisTurn + sendChatMessage, helper for appending, init chatHistory in addHighlight
client/src/components/prototype/FacilitatorChat.tsx   ← Add hasActiveHighlight prop, empty state render branch
client/src/lib/persistence.ts                         ← Default chatHistory: [] on hydration
client/src/lib/highlights.ts (if needed)              ← Ensure new Highlight objects include chatHistory: []
client/src/components/prototype/ReadingPane.tsx (if needed) ← Same
```

No files created, none deleted. No server changes.

---

## Constraints

- **Chat lives on highlights, not on session or top-level state.**
- **Every chat write targets a specific `highlightId`** (not `activeHighlightId`) to survive mid-call highlight switches.
- **Chat persists via the existing save-effect.** No new endpoint, no new storage, no new hydration logic beyond the one-line default.
- **No chat when no highlight active.** Input hidden, empty state shown. This is a deliberate design choice — questioning is anchored to a passage.
- **Committed highlights keep chat open.** Reader can keep chatting about a committed passage. Synthesis loop stays dormant (no new descriptions = no synthesis calls).
- **Deleting a highlight deletes its chat.** Matches existing bubbles + buddyResponses deletion behaviour.
- **`facilitatorLoading` stays top-level.** One flag is enough — only one chat is active at a time.
- **Don't start the dev server.** Lucy verifies visually.

---

## Out of scope

- Per-highlight loading flag (edge case — use top-level for simplicity).
- Undo for deleting a highlight (chat loss is intentional, matches rest of data model).
- Chat search across highlights ("find the conversation where I talked about Darcy's letter").
- Multi-tab concurrency.
- Exporting a committed highlight's full artifact.
- Lens responses in chat (plan-09-alt).

---

## Definition of done

- `Highlight` type has `chatHistory: ChatMessage[]`.
- Top-level `chatHistory` state and `chatHistoryRef` removed from `PrototypeSlide`.
- Session-switch effect no longer clears chat.
- `addHighlight` initialises `chatHistory: []` on new highlights.
- `sendSynthesisTurn` reads and writes the specific highlight's chat, not top-level.
- `sendChatMessage` reads and writes the active highlight's chat; no-op when no active highlight.
- `FacilitatorChat` receives `hasActiveHighlight` prop; shows empty state when false (input hidden).
- `loadHighlights` defaults `chatHistory: []` for hydrated highlights without the field.
- New highlights from `ReadingPane` / `highlights.ts` lib include `chatHistory: []`.
- Manual test: highlight A, stage a description, get facilitator push, commit. Highlight B, stage a new description. Facilitator's response is scoped ONLY to B's context — no reference to A's content.
- Manual test: click back to highlight A. A's chat history is visible. Continue the conversation. Facilitator responds with A's context, no B bleed.
- Manual test: reload the app. Both A and B's chat histories come back intact, each with its own thread.
- Manual test: delete highlight A. Its chat disappears. B is unaffected.
- Manual test: deselect highlight (click the active highlight mark again, or delete it). Chat pane shows empty state. Input hidden.
- Manual test: committed highlight chat remains accessible. Reader can continue chatting. No synthesis-mode calls fire because no new descriptions are being staged.
- `npm run typecheck` passes both workspaces.
- `BUILD_PLANS/STATE.md` updated — plan-08 done, plan-09 (lenses-in-chat) next if desired.
- `BUILD_PLANS/TEST_LIST.md` updated:
  - New item: "Mid-call highlight switch" — stage a description, switch highlights before facilitator responds. Response should land on the original highlight's chat, not the new active one.
  - New item: "Committed chat re-engagement" — does the facilitator respond sensibly when asked a question on a committed highlight where no new descriptions are being staged?
  - Remove: any old items that assumed session-scoped chat.
- Summary includes: whether the refactor landed cleanly or needed defensive additions, whether the empty state for no-highlight feels right, whether committed highlights continuing to accept chat feels natural or redundant, whether the mid-call switch edge case surfaced any issues.

---

## Notes for future plans

**Lenses-in-chat (plan-09-alt drafted):** lens responses will land in `activeHighlight.chatHistory` with `kind: 'lens'`. Highlight-scoped chats make this simpler — lenses automatically belong to their passage. Visual treatment: italics + right-aligned per Lucy's note, worth keeping in mind when plan-09 is drafted/executed.

**The committed highlight artifact story:** once highlight-scoped chat + committed bubbles + buddy responses (or lens responses if we go that route) all live on a highlight, a committed highlight becomes a rich artifact. The pitch deck's "what makes this different" slide should name this directly: you don't just get highlights and notes, you get the shape of your thinking preserved per-passage.
