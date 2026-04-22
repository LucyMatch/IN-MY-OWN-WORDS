# Design Patterns — observable conventions from the starter

Reference doc. Read before writing new components. Points at the source files where the patterns live so you can check specifics without guessing.

The starter's own AI-pairing doc — outside this repo at `../education-labs-takehome-starter/education-labs-takehome-main/CLAUDE.md` — spells the house conventions out explicitly. This doc extracts the conventions that matter for our codebase and notes the starter idioms we're deliberately NOT adopting (because we're Vite, not Next.js).

---

## The canonical component shape

Every component in the starter follows this shape, without exception:

```tsx
import { cn } from '@/lib/utils'
import type { ComponentProps } from 'react'

type ThingProps = ComponentProps<'div'> & {
  customProp?: string
}

export function Thing({ className, customProp, ...props }: ThingProps) {
  return <div className={cn('base-classes', className)} {...props} />
}
```

Rules that fall out of this:

1. **Props extend `ComponentProps<'element'>`** — native HTML attributes pass through automatically. No explicit `id`/`aria-*`/`data-*` props.
2. **`className` is always the first destructured prop**, then custom props, then `...props` as the catch-all.
3. **`className` always runs through `cn()`** from `@/lib/utils`. Never concatenate by hand.
4. **`...props` is spread onto the root DOM element** at the end, not scattered across children.
5. **Named export, one component per file** (unless the file exposes a family — see Compound components below).
6. **No explicit return type** on the component function — TS infers JSX.
7. **No default export, anywhere.**

**See:** `Button.tsx`, `Avatar.tsx` in `client/src/components/ui/` — the patterns we already have in-repo.

---

## Variant-as-object-lookup

When a component has variants, they go in an inline object keyed on the prop:

```tsx
<button
  className={cn(
    'inline-flex shrink-0 ...',            // base
    {
      ghost: 'text-text-secondary ...',
      outline: 'border-border-subtle ...',
      primary: 'bg-accent-strong ...',
    }[variant],
    {
      sm: 'h-8 gap-1.5 rounded-sm px-2.5',
      md: 'h-8 gap-1.5 rounded-sm px-3',
      icon: 'h-8 w-8 rounded-md',
    }[size],
    className,                              // always last
  )}
/>
```

No `clsx` object form, no `class-variance-authority`, no ternary chains. Just object-lookup. Matches `Button.tsx` exactly.

---

## Compound components (families in one file)

When a domain concept has multiple related pieces, they can live in one file, all named-exported. In the starter, examples include:

- `ClaudeMessage.tsx` with `ClaudeMessage`, `ClaudeHeading`, `ClaudeParagraph`, `ClaudeList`, `ClaudeListItem`, `ClaudeCitation`
- `Sidebar.tsx` with `Sidebar`, `SidebarNav`, `SidebarNavItem`, `SidebarSection`, `SidebarChatItem`

**When to reach for this pattern:** when the pieces only make sense in one context. `SidebarNavItem` doesn't belong anywhere else, so it lives next to `Sidebar`. Don't use it as an organisational tool — if two components could reasonably be used independently, they get their own files.

---

## Class string order

Roughly: **layout → visual → state → motion → responsive**. Loosely enforced; don't agonise. Example from the starter's `InputBar.tsx`:

```tsx
'bg-surface shadow-input flex w-full flex-col rounded-xl'
// visual   visual      layout ——————————  visual
```

And for interactive states, the pseudo-classes trail:

```tsx
'text-text-secondary hover:bg-state-hover bg-transparent'
// base                 state                 base
```

The point: anyone scanning a class string should see *what shape it is* before *what it does when hovered*.

---

## Data attributes for state-driven styling

Base UI primitives (`@base-ui-components/react`) emit `data-*` attributes that Tailwind targets via `data-[...]`. The starter's `Sidebar.tsx` uses this heavily:

```tsx
// Parent
data-collapsed={collapsed || undefined}
className="... data-[collapsed]:w-[var(--sidebar-width-collapsed)]"
```

```tsx
// Sidebar chat row
data-active={active || undefined}
className="... data-[active]:bg-state-active"
```

**Pattern:** set `data-x={condition || undefined}` so the attribute is present-or-absent (not present-with-value-"false"). Target it with `data-[x]:` variants.

**Apply this to our `SessionsPanel`:** the active session row should use `data-active={session.id === activeSessionId || undefined}` with `data-[active]:bg-state-pill` rather than a conditional class. Cleaner, matches the house style.

Same trick works for `data-[highlighted]` on menu items (Base UI sets this automatically for keyboard navigation).

---

## Group states and nested targeting

Used for "when the parent is collapsed, hide the child label":

```tsx
// Parent root
className="group/sidebar ... data-[collapsed]:w-[...]"

// Nested child
className="... group-data-[collapsed]/sidebar:hidden"
```

Named groups (`group/sidebar`, not just `group`) prevent accidental cross-contamination when nested.

**Apply this to our `SessionsPanel`:** when collapsed, the session list labels should hide via `group-data-[collapsed]/sessions:hidden` rather than rendering-or-not in React. Keeps the markup stable and the transition smooth.

---

## Icons

- **Library:** `lucide-react` only.
- **Import:** named, directly from the library: `import { ChevronLeft } from 'lucide-react'`
- **Sizing:** Tailwind `size-*`, not `width`/`height` props: `<Plus className="size-4" />`
- **Opacity for muted icons:** `opacity-60` / `opacity-75` on the icon's className, not a separate colour.

---

## Buttons vs raw `<button>`

Use the `Button` primitive when the thing is *a button in the design system* — standalone action, pill/rounded shape, needs a variant.

Use a raw `<button>` when the thing is *an interactive row* — list items, menu items, toggles embedded in other layouts. The starter's `Sidebar.tsx` chat rows do this.

**Rule of thumb:** if the visual spec is "a specific row inside a specific container", raw `<button>`. If it's "a button, standalone", primitive.

Both go through `cn()` and use the tokens.

---

## Event handler naming

- Component receives: `onX` (e.g. `onSend`, `onStop`, `onShare`, `onDelete`, `onToggle`, `onSelect`)
- Internal handler: `handleX` (e.g. `handleSend`, `handleKeyDown`)
- Pass the internal handler to the DOM: `onClick={handleSend}`

Consistent across all chat components in the starter.

---

## What we are NOT lifting from the starter

Our codebase is Vite + React 19 + Express, not Next.js. So ignore these starter idioms:

- **`'use client'` directives** — we don't have a server/client component split. Every component is a client component by default. No directive needed.
- **`next/link`, `next/navigation`** — we don't have a router. Deck navigation is React state via `DeckContext`. Don't reach for `<Link href>` or `usePathname`.
- **App Router paths** (`src/app/foo/page.tsx`) — not applicable.
- **Route handlers in `app/api/**/route.ts`** — we have Express routes in `server/src/routes/`.
- **`localStorage` for state persistence** — our persistence is server-side via `/api/highlights`.

If Claude Code generates a `'use client'` or imports from `next/*`, stop it — that's drift from our actual stack.

---

## When the pattern doesn't fit

If a new component genuinely needs a shape this doc doesn't cover (render props, polymorphic `as` prop, forwardRef-style), that's fine. Do it, but:

1. Check no existing pattern fits first.
2. Write the simplest version that works.
3. Flag it in the plan summary so we know there's a new pattern in play.

The goal isn't uniformity for its own sake — it's that someone reading the repo shouldn't have to context-switch between five different component dialects.
