# Feature Plan 02 — Small Fixes

**Type:** Polish / post-MVP cleanup.
**Prerequisite:** Main build track done (plans 00–09).

Read `BUILD_PLANS/context.md` and `BUILD_PLANS/design-patterns.md` first.

This is a rolling bucket for small one- or two-line fixes that came up during main plan builds but weren't worth blocking on. Each item is self-contained — implement in any order, test in isolation.

When adding a new item: brief description, file, before/after.

---

## Fix 01 — Strip redundant `[staged: '...']` wrapper from chat display

**What's wrong:** when the user stages a bubble during a synthesis turn, it renders in the chat thread with BOTH a "Staged:" label above AND a `[staged: 'the bubble text']` wrapper around the content. Redundant — two signals saying the same thing.

**Source of the redundancy:** the wrapper is the literal content sent to the API (so the Facilitator can parse "this is a staged bubble" from the user message). But we're also rendering that exact string as user-facing display.

**Fix:** in `client/src/components/prototype/FacilitatorChat.tsx`, strip the `[staged: '...']` wrapper for display purposes only. Keep the raw wrapped content on the `ChatMessage.content` field (so the API still gets it). Render the unwrapped text under the "Staged:" label.

### Approach

When rendering a message with `kind === 'synthesis'` and `role === 'user'`, extract the inner text:

```tsx
function extractStagedText(content: string): string {
  const match = content.match(/^\[staged:\s*['"](.+)['"]\]$/)
  return match ? match[1] : content
}
```

Then in the ChatBubble render:

```tsx
{message.kind === 'synthesis' && isUser && (
  <p className="text-text-tertiary mb-1 text-xs">Staged:</p>
)}
<p className="whitespace-pre-line">
  {message.kind === 'synthesis' && isUser
    ? extractStagedText(message.content)
    : message.content}
</p>
```

Alternative if that feels fragile: store a separate `displayContent?: string` field on `ChatMessage`, populated when the synthesis user message is created in `PrototypeSlide.sendSynthesisTurn`. Cleaner but touches the shared type. Pick whichever feels right on implementation.

### Files touched

```
client/src/components/prototype/FacilitatorChat.tsx
```

(Maybe `shared/types.ts` if using the displayContent approach.)

### Definition of done

- Staged bubble messages in the chat render cleanly: one "Staged:" label, the bubble text below, no brackets or wrapper artifacts.
- The API still receives the wrapped version — facilitator prompt parsing unchanged.
- Typecheck passes.

---

## Fix 02 — _(placeholder — add next small fix here)_
