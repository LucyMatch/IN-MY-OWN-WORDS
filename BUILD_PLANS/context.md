# Project Context — In My Own Words

Reference this file at the start of any build session. It captures the shared project context all build plans rely on. This is the stable architecture doc — what's *built and where it lives* is in `STATE.md`.

**Last updated:** 2026-04-22 (post plan-09 drafting; audited during plan-09 build)

---

## What this project is

A design prototype for a reading comprehension tool called "In Your Own Words." The core mechanic: a user reads a text passage, highlights a section, and **writes what it means in their own words**. A Facilitator (Anthropic API) responds to the writing to help the user synthesise. Optional **context lenses** (expert personas) can be pulled in on demand to offer a different angle on the passage.

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

## Project structure (current state, post plan-09)

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
          PrototypeSlide.tsx        ← hosts the interactive prototype
          ConsiderationsSlide.tsx
          NextStepsSlide.tsx
          PlaceholderSlide.tsx
        prototype/
          SessionsPanel.tsx
          ReadingPane.tsx
          InYourOwnWordsPane.tsx
          FacilitatorChat.tsx       ← full-height after plan-09
          LensPane.tsx              ← vertical far-right pane, added in plan-09
          EmptyInputBubble.tsx
          StagedBubble.tsx
        ui/
          Button.tsx                ← from starter
          Avatar.tsx                ← from starter
      lib/
        utils.ts                    ← cn() helper
        highlights.ts               ← splitIntoParagraphs, computeRangesFromSelection, etc.
        persistence.ts              ← loadHighlights, saveHighlights, sanitizeForSave
      styles/globals.css            ← design tokens + base styles
    public/
      sessions.json                 ← session manifest
      sessions/                     ← .txt source texts (pride-and-prejudice, romeo-and-juliet)
      favicon.svg
      assets/                       ← logos / svgs from starter
  server/
    src/
      index.ts                      ← Express entry
      routes/
        health.ts                   ← GET /api/health
        highlights.ts               ← GET/POST /api/highlights
        lens.ts                     ← POST /api/lens (plan-09; replaces consult)
        personas.ts                 ← GET /api/personas (plan-09)
        facilitator.ts              ← POST /api/facilitator (dual-mode: chat + synthesis)
        commitCheck.ts              ← POST /api/commit-check (Haiku classifier)
        verify.ts                   ← POST /api/verify (kept for future use; not UI-wired post-plan-09)
      lib/
        anthropic.ts                ← Anthropic client + callClaude helper
        personas.ts                 ← PERSONAS array + getPersonaRoster (renamed from buddies.ts in plan-09)
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
    feature-NN-*.md                 ← post-MVP polish plans
    TEST_LIST.md                    ← interactions to verify with human judgment
    archive/                        ← superseded plans (for reference only)
```

**Reference docs that live OUTSIDE this repo** (at `take_home_assignment/docs/`):
- `ux-considerations.md` — UX design rationale
- `ai-design.md` — persona prompt design
- `technical-bits.md` — implementation notes
- `nuggets.md` — pitch-ready lines, scope calls
- `todo.md` — running task list
- `pride-and-prejudice-ch8.txt`, `romeo-and-juliet-act3-scene1.txt` — source texts (already copied into `client/public/sessions/`)

Those docs are not accessible to Claude Code sessions (which are scoped to this repo). If a build plan needs content from them, copy the relevant bits into the plan itself.

---

## Layout direction (the prototype slide)

Five-column layout, left to right (post plan-09):

1. **Sessions** — left drawer, collapsible. Lists available sessions.
2. **Reading** — source text. Highlighting happens here.
3. **In Your Own Words** — middle pane. **Collapsed by default, auto-opens on first highlight.** Houses the paraphrase bubbles.
4. **Chat** — the Facilitator. Full vertical height. Empty state shown when no highlight is active (input hidden). Chat is scoped per-highlight (plan-08) — switching highlights switches conversations.
5. **Lens** — vertical far-right pane. Collapsible via chevron. Contains persona buttons ("say it again but different — the Professor / the Historian / the Reframer"). Clicking a button fires a lens call; the response lands inline in the Chat thread, visually demarcated (italic, right-aligned, accent border, persona header).

The whole thing sits inside the deck's active slide area, below the toolbar.

**Historical note:** the layout went through several iterations. The final wireframe had Buddies as a stacked-below-Facilitator panel; that was built in plans 01–06, then replaced in plan-09 when testing revealed the stacked approach was cramping both panels and making the personas blur together. The pull-model lens-in-chat design is the current state.

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
| Highlight yellow (staged) | `bg-highlight` |
| Sage green (committed) | `bg-commit` |

---

## CSS layout variables (in `:root`, not `@theme`)

```css
--sidebar-width: 288px;           /* sessions panel expanded */
--sidebar-width-collapsed: 48px;  /* sessions panel collapsed */
--header-height: 56px;            /* deck toolbar height */
--content-max-width: 768px;
--bubbles-pane-width: 360px;
--bubbles-pane-width-collapsed: 60px;
```

Body already has `overflow: hidden` — full-viewport no-scroll is baked in. The prototype slide's reading pane is the **only** element with internal scroll alongside the chat + lens panes.

---

## Shared types summary (`shared/types.ts`)

The current source of truth lives in the file — these are highlights only, not authoritative:

```ts
Highlight {
  id: string
  sessionId: string
  ranges: HighlightRange[]          // added in plan-02 for multi-paragraph highlights
  text: string                      // the selected passage
  bubbles: Bubble[]                 // plan-03: replaced articulation string
  chatHistory: ChatMessage[]        // plan-08: chat per highlight
  commitReady: boolean              // plan-04: transient, stripped before save
  createdAt: string
}

Bubble         { id, text, staged, committed, createdAt }
Session        { id, title, author, section, filename }
HighlightRange { paragraphIndex, start, end }
ChatMessage    { role, content, kind?: 'chat' | 'synthesis' | 'lens', personaId?, personaName? }
Persona        { id, name, subtitle, buttonLabel }  // plan-09 public shape
```

**Types removed in plan-09:**
- `BuddyResponse` — gone (no more buddy cards)
- `Highlight.buddyResponses` — gone
- `ConsultRequest` / `ConsultResponse` — gone (replaced by `LensRequest`/`LensResponse`)

**API request/response shapes** (in the same file): `FacilitatorRequest/Response`, `CommitCheckRequest/Response`, `LensRequest/Response`, `PersonasResponse`, `VerifyRequest/Response`, `HighlightsGetResponse`, `HighlightsPostRequest/Response`, `HealthResponse`, `ApiErrorResponse`.

**`FacilitatorRequest.session`** (added in plan-07) threads session metadata (title, author, section) into both chat and synthesis modes so the Facilitator always knows what's being read.

---

## AI persona summary

Short version (full version lives outside the repo in `docs/ai-design.md` — copy relevant bits into plans that need them):

- **Facilitator** (two modes, same endpoint `/api/facilitator`):
  - **Chat mode** — answers questions about the passage. 1-2 sentences. Session context threaded in.
  - **Synthesis mode** — triggered when the user stages a description (bubble). Pushes toward synthesis. Every response ends with either a specific question or an explicit "try writing another in your own words" nudge. Hard-capped at 150 tokens. The **direct-and-iterate** loop (from the UX doc) is the load-bearing framing.
  - Gates the green-tick commit via a separate Haiku classifier (`/api/commit-check`). Soft gate — user can "Commit anyway."
- **Context Lenses** (3 personas, pulled on demand via `/api/lens`):
  - **English Teacher** — craft, form, figurative language.
  - **Historian** — period, biography, contemporary reception.
  - **Reframer** — visual mediums (film, painting, staging).
  - Each opens with a framing phrase ("If I were The Historian, I'd say…") that signals which lens is speaking. Responses are 2-3 sentences, hard cap 250 tokens. One lens at a time; user initiates. Lens responses land in the active highlight's chat thread, visually demarcated (italic, right-aligned, accent border, persona header).
  - **No Mode A/B logic** (removed in plan-09). No "verify" button on lens responses (parked; can be added as a feature plan if hallucinations become an issue).

**Chat is highlight-scoped** (plan-08) — each highlight has its own `chatHistory` that persists with it. Switching highlights switches conversations. This is the core fix for the context-bleed issue; the Facilitator always responds in the context of the currently active highlight only.

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
- No "build your own persona" UI — persona roster is hardcoded.
- No lens-to-lens chat.
- No verify button on lens responses (post-plan-09; previously on buddy cards).
- Single-column text only. Multi-column is v2.
