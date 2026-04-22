# Build Plan 2 — Static Content Slides

Read `BUILD_PLANS/context.md` first for project context, stack, and design tokens.

---

## Prerequisites

Plan 1 (deck shell) must be complete. The app should already be running with placeholder slides navigable via the toolbar.

---

## What this builds

Replace the placeholder slides with real designed content slides. These are visual/informational — no interactivity. After this plan, navigating through slides 1, 2, 3, 5, 6 shows real content. Slide 4 (Prototype) stays as a placeholder — that's Plan 3.

---

## Important note on content

Lucy will supply or approve final copy. Where specific text isn't provided, use the format `[PLACEHOLDER: description]` so Lucy can search and replace. **Do not invent concept/product copy.** Structure and layout are your job; words are hers.

---

## Files to create

```
client/src/components/slides/TitleSlide.tsx
client/src/components/slides/ConceptSlide.tsx
client/src/components/slides/UserJourneySlide.tsx
client/src/components/slides/ConsiderationsSlide.tsx
client/src/components/slides/NextStepsSlide.tsx
```

## Files to modify

```
client/src/slides.config.tsx   ← swap PlaceholderSlide imports for real components
```

---

## Design language for all slides

These slides should feel like pages in a well-designed product/pitch deck — editorial, confident, generous whitespace.

- Each slide fills the full viewport below the toolbar (`h-full w-full overflow-hidden`)
- Consistent inner padding: `px-16 py-12` (adjust to taste but be consistent across all slides)
- Max content width: `max-w-3xl mx-auto` — don't let text span the full screen
- Headings: `font-serif text-text-primary`
- Body: `font-sans text-text-secondary leading-relaxed`
- Section label above heading: `text-text-tertiary text-xs uppercase tracking-widest`
- Accent color (`text-accent-strong`) for emphasis sparingly
- No scroll — all content must fit within the viewport

---

## TitleSlide (`client/src/components/slides/TitleSlide.tsx`)

The first thing seen. Full-screen, centered.

Layout: vertically and horizontally centered block.

```
[section label — small, muted, uppercase]    ← omit or use "In Your Own Words"
[Main title — large serif]                   ← "In Your Own Words"
[Tagline — medium, secondary]                ← [PLACEHOLDER: one-line tagline]
[Byline — small, tertiary]                   ← [PLACEHOLDER: "Lucy Matchett · 2026" or similar]
```

The title is large — `text-5xl` or `text-6xl font-serif`. Tagline `text-xl`. Byline `text-sm text-text-tertiary`.

---

## ConceptSlide (`client/src/components/slides/ConceptSlide.tsx`)

Layout: top-aligned, not centered. Left-to-right reading flow.

```
[section label]    "Design Thinking"
[heading]          "Concept"
[body — 2-3 paragraphs or a single pull-quote block]
                   [PLACEHOLDER: describe the concept — what problem, what approach]
```

Optional: a styled pull-quote or highlighted statement block using `bg-state-pill rounded-md p-4` for visual interest.

---

## UserJourneySlide (`client/src/components/slides/UserJourneySlide.tsx`)

Layout: top-aligned. Heading, then a horizontal or vertical step flow.

```
[section label]    "Design Thinking"
[heading]          "User Journey"
[steps — numbered or connected flow]
  1. [PLACEHOLDER: step 1]
  2. [PLACEHOLDER: step 2]
  ...
```

For the step flow, use a horizontal list with arrows between steps if there are 4-5 steps, or a vertical numbered list if more. Keep it simple — `flex flex-row gap-4 items-center` with `<ArrowRight>` icons from lucide-react between steps, or just a clean numbered list.

Each step: a small box `bg-surface border border-border-soft rounded-md p-4` with a number and label.

---

## ConsiderationsSlide (`client/src/components/slides/ConsiderationsSlide.tsx`)

Layout: top-aligned, two-column or single-column list.

```
[section label]    "Considerations"
[heading]          "Design Considerations"
[list of considerations]
  · [PLACEHOLDER: consideration 1]
  · [PLACEHOLDER: consideration 2]
  · [PLACEHOLDER: consideration 3]
  ...
```

List items: `text-text-secondary leading-relaxed`. Each item can have a small label/category above it in `text-text-tertiary text-xs` if there are distinct categories. Otherwise a simple bullet list is fine.

---

## NextStepsSlide (`client/src/components/slides/NextStepsSlide.tsx`)

Layout: top-aligned.

```
[section label]    "Next Steps"
[heading]          "Next Steps & Iterations"
[list]
  1. [PLACEHOLDER: next step 1]
  2. [PLACEHOLDER: next step 2]
  ...
```

Numbered list. Can use a slightly different visual treatment from ConsiderationsSlide — e.g. larger numbers in `text-accent-strong font-serif text-2xl` next to each item for visual interest.

---

## slides.config.tsx changes

Replace the `PlaceholderSlide` component for slides 1, 2, 3, 5, 6. Leave slide 4 (prototype) as `PlaceholderSlide` — that's Plan 3.

```tsx
import { TitleSlide } from '@/components/slides/TitleSlide'
import { ConceptSlide } from '@/components/slides/ConceptSlide'
import { UserJourneySlide } from '@/components/slides/UserJourneySlide'
import { ConsiderationsSlide } from '@/components/slides/ConsiderationsSlide'
import { NextStepsSlide } from '@/components/slides/NextStepsSlide'
// keep: import { PlaceholderSlide } from '@/components/slides/PlaceholderSlide'
```

---

## Constraints

- No scroll on any slide — all content must fit within the viewport
- No interactivity — these are read-only
- Consistent visual language across all slides (padding, font sizes, color usage)
- Do not start the dev server or test in a browser — Lucy will verify visually

---

## Out of scope

- The prototype slide (Plan 3)
- Sessions (Plan 4)
