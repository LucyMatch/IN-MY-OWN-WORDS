# Project Context — In My Own Words

Reference this file at the start of any build session. It captures the shared project context all build plans rely on. This is the stable architecture doc — what's *built and where it lives* is in `STATE.md`.

---

## What this project is

A design prototype for a reading comprehension tool called "In Your Own Words." The core mechanic: a user reads a text passage, highlights a section, and **writes what it means in their own words**. A Facilitator (Anthropic API) responds to the writing to help the user synthesise. Optional Buddies (parallel API calls, distinct personas) offer expert readings of the passage as stress-tests.

The prototype lives inside a slide-deck-style presentation wrapper so evaluators can see the design thinking *and* interact with the working prototype in one web app.

**Core mechanic:** paraphrase-to-commit. Spine of the prototype. Every feature defends this or gets cut.
**North Star:** mastery and agency.

**Owner:** Lucy Matchett — portfolio at https://lucymatch.com

For the full design rationale, see `docs/ux-considerations.md` and `docs/ai-design.md` (both at project root, outside this repo).

---

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind v4
- **Backend:** Express + TypeScript (ESM), `@anthropic-ai/sdk` for all AI calls
- **Shared types:** `shared/types.ts` — imported by both client and server
- **Storage:** Plain JSON file at `server/data/highlights.json`
- **Icons:** lucide-react
- **Headless primitives:** `@base-ui-components/react`
- **No router installed** — deck navigation is React state; no URL routes

---

## Project structure (intended end state)

```
in-my-own-words/                    ← THIS REPO
  client/
    src/
      App.tsx                       ← DeckProvider + DeckLayout
      main.tsx
      slides.config.tsx             ← the SLIDES array
      context/
        DeckContext.tsx             ← deck navigation state
      components/
        deck/
          DeckLayout.tsx
          Toolbar.tsx
          SlideNavMenu.tsx
        slides/
          TitleSlide.tsx
          ConceptSlide.tsx
          UserJourneySlide.tsx
          PrototypeSlide.tsx        ← to be built — hosts the interactive prototype
          ConsiderationsSlide.tsx
          NextStepsSlide.tsx
          PlaceholderSlide.tsx
        prototype/                  ← to be built
          SessionsPanel.tsx
          ReadingPane.tsx
          InYourOwnWordsPane.tsx
          FacilitatorChat.tsx
          BuddyPanel.tsx
        ui/
          Button.tsx                ← from starter
          Avatar.tsx                ← from starter
      lib/utils.ts                  ← cn() helper
      styles/globals.css            ← design tokens + base styles
    public/
      sessions.json                 ← session manifest (to be created)
      sessions/                     ← .txt source texts (to be created)
      favicon.svg
      assets/                       ← logos / svgs from starter
  server/
    src/
      index.ts                      ← Express entry
      routes/
        health.ts                   ← GET /api/health
        highlights.ts               ← GET/POST /api/highlights
        consult.ts                  ← POST /api/consult (parallel buddy calls)
        facilitator.ts              ← POST /api/facilitator (multi-turn)
        verify.ts                   ← POST /api/verify
      lib/
        anthropic.ts                ← Anthropic client + callClaude helper
        buddies.ts                  ← BUDDIES array + buildBuddyUserMessage
        storage.ts                  ← readHighlights() / writeHighlights()
        paths.ts                    ← findWorkspaceRoot()
    data/
      highlights.json               ← runtime storage (gitignored)
  shared/
    types.ts                        ← single source of truth for cross-boundary types
  BUILD_PLANS/
    context.md                      ← this file
    STATE.md                        ← what's built, what's next
    design-patterns.md              ← observable component conventions (read before writing components)
    plan-NN-*.md                    ← one plan per Claude Code session
    archive/                        ← superseded plans (for reference only)
```

**Reference docs that live OUTSIDE this repo** (at `take_home_assignment/docs/`):
- `ux-considerations.md` — UX design rationale
- `ai-design.md` — persona prompt design
- `technical-bits.md` — implementation notes
- `nuggets.md` — pitch-ready lines, scope calls
- `todo.md` — running task list
- `pride-and-prejudice-ch8.txt`, `romeo-and-juliet-act3-scene1.txt` — source texts (copy these into `client/public/sessions/` during plan-01)

Those docs are not accessible to Claude Code sessions (which are scoped to this repo). If a build plan needs content from them, copy the relevant bits into the plan itself.

---

## Layout direction (the prototype slide)

Four-zone layout, left to right:

1. **Sessions** — left drawer, collapsible. Lists available sessions.
2. **Reading** — source text. Highlighting happens here.
3. **In Your Own Words** — middle pane. **Collapsed by default, auto-opens on first highlight.** Houses the paraphrase bubbles.
4. **Chat + Buddies** — right column, **stacked vertically**: Facilitator chat on top, Buddies panel below. (Earlier wireframes explored two vertical panes; stacked won.)

The whole thing sits inside the deck's active slide area, below the toolbar.

---

## Design tokens (Tailwind v4)

Utility classes map directly from `@theme` in `globals.css`:

| Purpose | Class |
|---|---|
| Page background | `bg-page` |
| Surface (cards, panels) | `bg-surface` |
| Primary text | `text-text-primary` |
| Secondary text | `text-text-secondary` |
| Tertiary / muted | `text-text-tertiary` |
| Accent (orange) | `text-accent` / `bg-accent` |
| Accent strong | `text-accent-strong` / `bg-accent-strong` |
| Danger | `text-danger` |
| Border subtle | `border-border-subtle` |
| Border soft | `border-border-soft` |
| Hover state bg | `bg-state-hover` |
| Active state bg | `bg-state-active` |
| Pill bg | `bg-state-pill` |
| Card shadow | `shadow-input` |
| Popover shadow | `shadow-popover` |
| Serif font | `font-serif` |
| Sans font | `font-sans` |
| Radii | `rounded-xs` `rounded-sm` `rounded-md` `rounded-lg` `rounded-xl` |

---

## CSS layout variables (in `:root`, not `@theme`)

```css
--sidebar-width: 288px;           /* sessions panel expanded */
--sidebar-width-collapsed: 48px;  /* sessions panel collapsed */
--header-height: 56px;            /* deck toolbar height */
--content-max-width: 768px;
```

Body already has `overflow: hidden` — full-viewport no-scroll is baked in. The prototype slide's reading pane is the **only** element with internal scroll.

---

## Shared types summary (`shared/types.ts`)

The current source of truth lives in the file — these are highlights only, not authoritative:

```ts
Highlight {
  id: string
  sessionId: string           // renamed from documentId in plan-00
  text: string                // the selected passage
  articulation: string | null // what the user wrote — becomes "bubbles" (see note)
  buddyResponses: BuddyResponse[]
  createdAt: string
}

Session        { id, title, author, section, filename }   // added in plan-00
BuddyResponse  { buddyId, buddyName?, text?, error?, verified? }
BuddyMeta      { id, name, description }
ChatMessage    { role: 'user' | 'assistant', content }
```

**Note on articulation shape:** current type has `articulation: string | null` (single string). The UX evolved to multiple "bubbles" per highlight (stage several paraphrases before committing) plus a committed summary. The type will need to evolve — probably `bubbles: Bubble[]` where each Bubble has its own id, text, staged/committed state, and the Facilitator response pegged to it. Each plan that touches this will update `shared/types.ts` as needed; the contract between client and server should remain the single source of truth.

**API request/response shapes** (in the same file): `ConsultRequest/Response`, `FacilitatorRequest/Response`, `VerifyRequest/Response`, `HighlightsGetResponse`, `HighlightsPostRequest/Response`, `HealthResponse`, `ApiErrorResponse`.

---

## AI persona summary

Short version (full version lives outside the repo in `docs/ai-design.md` — copy relevant bits into plans that need them):

- **Facilitator.** Teaching presence. Reads committed/staged paraphrases, pushes user to synthesise. Short directional responses, never explains the text. Gates the green-tick commit (soft gate — user can override).
- **Buddies** (3 of them, currently hardcoded in `server/src/lib/buddies.ts`): **English Teacher**, **Historian**, **Reframer** (visual medium expert). Each one produces an independent 2–4 sentence take on the passage. Mode A (vacuum) or Mode B (reads user's writing, names the gap) — classifier decides per call. Never chat, never converse — one-shot only. Every response has a "Verify" button that triggers a self-check re-prompt.

---

## Match the starter's code patterns

The design system was frankensteined from the Anthropic Education Labs takehome starter — tokens, `cn()` utility, and the `Button` / `Avatar` primitive components. New components should feel like they belong next to the starter's primitives, not alongside them.

**Read `BUILD_PLANS/design-patterns.md` before writing any new component.** It's the canonical reference. Covers:

- The canonical component shape (props extend `ComponentProps<'element'>`, `cn()` on every className, named export, one per file)
- Variant-as-object-lookup pattern
- Compound components (when to put a family in one file)
- Class string order, data-attribute state pattern, named group states
- Icons, buttons vs raw `<button>`, event handler naming
- **What we're NOT lifting** (no `'use client'`, no `next/*`, no App Router) — critical for catching drift

Short version: if a new component looks stylistically different from `Button.tsx`, rewrite until it doesn't.

---

## Conventions (repo-wide)

- **Prefer editing existing files to creating new ones.**
- **No comments unless the WHY is non-obvious.** The code should be legible without them.
- **No default exports — named exports only.**
- **Keep types local** unless they cross the network boundary; if they do, add them to `shared/types.ts`.
- **Tailwind v4** — utility classes only, no `tailwind.config.js`.
- **Match the starter's component patterns** — read `BUILD_PLANS/design-patterns.md` before writing any new component.
- **Do not start the dev server or test in a browser** from a Claude Code session. Lucy verifies visually and reports back.

---

## Known scope (all parked deliberately, covered in deck)

- No streaming — loading states do the work.
- No auth, no multi-user.
- JSON file storage, not a real DB.
- No PDF ingestion in the user-facing app (considered, scoped out).
- No "build your own buddy" UI — buddy roster is hardcoded.
- No buddy-to-buddy chat.
- Single-column text only. Multi-column is v2.
