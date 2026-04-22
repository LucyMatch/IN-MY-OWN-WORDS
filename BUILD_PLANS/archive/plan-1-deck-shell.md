# Build Plan 1 — Slide Deck Shell

Read `BUILD_PLANS/context.md` first for project context, stack, and design tokens.

---

## What this builds

The persistent presentation frame that wraps every slide. After this plan the app should:
- Show a full-screen toolbar at the top
- Render a full-viewport slide area below
- Have working back/forward navigation between placeholder slides
- Have a working hamburger menu that opens a right-side slide-out panel with a numbered slide index
- Show a "Jump to prototype" shortcut link

No real slide content yet — every slide renders a styled placeholder. Real content comes in Plans 2 and 3.

---

## Files to create

```
client/src/slides.config.tsx
client/src/context/DeckContext.tsx
client/src/components/deck/DeckLayout.tsx
client/src/components/deck/Toolbar.tsx
client/src/components/deck/SlideNavMenu.tsx
client/src/components/slides/PlaceholderSlide.tsx
```

## Files to modify

```
client/src/App.tsx       ← replace boilerplate entirely
```

---

## Slide config (`client/src/slides.config.tsx`)

```tsx
import { PlaceholderSlide } from '@/components/slides/PlaceholderSlide'

export type SlideSection =
  | 'intro'
  | 'design-thinking'
  | 'prototype'
  | 'considerations'
  | 'next-steps'

export type SlideConfig = {
  id: string
  section: SlideSection
  sectionLabel: string   // shown in toolbar handlebar
  title: string          // shown in nav menu
  isPrototype?: boolean  // marks the slide that hosts the live prototype
  component: React.ComponentType
}

export const SLIDES: SlideConfig[] = [
  {
    id: 'title',
    section: 'intro',
    sectionLabel: 'Intro',
    title: 'Title',
    component: PlaceholderSlide,
  },
  {
    id: 'concept',
    section: 'design-thinking',
    sectionLabel: 'Design Thinking',
    title: 'Concept',
    component: PlaceholderSlide,
  },
  {
    id: 'user-journey',
    section: 'design-thinking',
    sectionLabel: 'Design Thinking',
    title: 'User Journey',
    component: PlaceholderSlide,
  },
  {
    id: 'prototype',
    section: 'prototype',
    sectionLabel: 'Prototype',
    title: 'Prototype',
    isPrototype: true,
    component: PlaceholderSlide,
  },
  {
    id: 'considerations',
    section: 'considerations',
    sectionLabel: 'Considerations',
    title: 'Design Considerations',
    component: PlaceholderSlide,
  },
  {
    id: 'next-steps',
    section: 'next-steps',
    sectionLabel: 'Next Steps',
    title: 'Next Steps',
    component: PlaceholderSlide,
  },
]
```

---

## DeckContext (`client/src/context/DeckContext.tsx`)

```tsx
export type DeckContextValue = {
  activeIndex: number
  goTo: (index: number) => void
  goNext: () => void
  goPrev: () => void
  goToPrototype: () => void
  slides: SlideConfig[]
  isNavMenuOpen: boolean
  setNavMenuOpen: (open: boolean) => void
}
```

- Wrap App with `<DeckProvider>` — holds `activeIndex` state and all navigation functions
- `goToPrototype` finds the slide where `isPrototype === true` and calls `goTo` with that index
- Navigation is clamped: can't go before 0 or past `slides.length - 1`

---

## DeckLayout (`client/src/components/deck/DeckLayout.tsx`)

Structure:
```
<div className="h-screen w-screen overflow-hidden flex flex-col bg-page">
  <Toolbar />
  <main className="flex-1 overflow-hidden relative">
    <ActiveSlideComponent />
  </main>
  <SlideNavMenu />   {/* overlay, not in flow */}
</div>
```

- Renders `slides[activeIndex].component` as the current slide
- `SlideNavMenu` sits outside the main flow (position fixed or absolute) and overlays when open

---

## Toolbar (`client/src/components/deck/Toolbar.tsx`)

Height: `var(--header-height)` = 56px. Full width. `border-b border-border-soft`.

Layout — three zones, flexbox with `justify-between`:

**Left zone:**
- "In Your Own Words" — `font-serif text-text-primary text-sm font-medium`

**Center zone** (itself centered absolutely or with `flex-1 flex justify-center`):
- Section handlebar: current slide's `sectionLabel` — `text-text-tertiary text-xs uppercase tracking-wide`
- A thin separator
- Back arrow `<ChevronLeft>` button — disabled and visually muted at first slide
- Slide counter: `"2 / 6"` — `text-text-tertiary text-xs tabular-nums`
- Forward arrow `<ChevronRight>` button — disabled at last slide
- "Jump to prototype" — a ghost text-link button, `text-accent-strong text-xs`; only shown when current slide is NOT the prototype slide

**Right zone:**
- Hamburger `<Menu>` icon button (opens SlideNavMenu)

Use the existing `Button` component for icon buttons (`variant="ghost" size="icon"`).

---

## SlideNavMenu (`client/src/components/deck/SlideNavMenu.tsx`)

- Position: `fixed inset-y-0 right-0` — full height, slides in from right
- Width: 280px
- `bg-surface shadow-popover`
- Overlay backdrop: semi-transparent, clicking it closes the menu
- Open/close: CSS transition `translate-x-full` → `translate-x-0` (use Tailwind `transition-transform duration-200`)

**Menu header:**
- "Slides" label — `font-serif text-text-primary text-sm`
- `<X>` close button top-right

**Slide list:**
- Numbered: "1 · Title", "2 · Concept" etc.
- `text-text-secondary text-sm`
- Active slide: `text-text-primary font-medium bg-state-pill rounded-sm`
- Clicking a slide navigates there and closes menu

**Menu footer** (pinned to bottom with `mt-auto`):
- "by Lucy Matchett" — `text-text-tertiary text-xs`
- The entire line is a link to `https://lucymatch.com` (`target="_blank" rel="noopener noreferrer"`)

---

## PlaceholderSlide (`client/src/components/slides/PlaceholderSlide.tsx`)

Props: receives slide config via context or prop — needs to know `title` and `sectionLabel`.

```tsx
<div className="h-full w-full flex flex-col items-center justify-center gap-3">
  <p className="text-text-tertiary text-xs uppercase tracking-widest">{sectionLabel}</p>
  <h1 className="font-serif text-text-primary text-3xl">{title}</h1>
  <p className="text-text-tertiary text-sm">Slide content coming soon</p>
</div>
```

It should read the current slide from DeckContext rather than requiring props — that way it works as a drop-in for any slide entry in SLIDES.

---

## App.tsx

Replace the entire existing boilerplate with:

```tsx
import { DeckProvider } from '@/context/DeckContext'
import { DeckLayout } from '@/components/deck/DeckLayout'
import { SLIDES } from '@/slides.config'

export function App() {
  return (
    <DeckProvider slides={SLIDES}>
      <DeckLayout />
    </DeckProvider>
  )
}
```

---

## Constraints

- No slide transition animations — instant swap
- Toolbar stays fixed; only the slide content area changes
- Body already has `overflow: hidden` in globals.css — don't fight it
- Keyboard nav (left/right arrow keys) would be a nice touch but is optional for this plan
- Do not start the dev server or test in a browser — Lucy will verify visually

---

## Out of scope

- Real slide content (Plan 2)
- The interactive prototype (Plan 3)
- The sessions panel (Plan 4)
