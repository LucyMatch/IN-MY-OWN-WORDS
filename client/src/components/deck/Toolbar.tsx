import { ChevronLeft, ChevronRight, Menu } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useDeck } from '@/context/DeckContext'

export function Toolbar() {
  const { activeIndex, slides, goTo, goNext, goPrev, goToPrototype, setNavMenuOpen } = useDeck()

  const currentSlide = slides[activeIndex]
  const isFirst = activeIndex === 0
  const isLast = activeIndex === slides.length - 1
  const isOnPrototype = currentSlide.isPrototype === true

  return (
    <header
      className="relative flex w-full items-center border-b border-border-soft bg-surface px-4 shrink-0"
      style={{ height: 'var(--header-height)' }}
    >
      {/* Left: title + section label — flex-1 to mirror right zone */}
      <div className="flex-1 flex items-center gap-2">
        <button
          onClick={() => goTo(0)}
          className="font-serif text-text-primary text-sm font-medium hover:opacity-70 transition-opacity cursor-pointer"
          aria-label="Go to home slide"
        >
          In Your Own Words
        </button>
        <span className="text-text-tertiary text-xs select-none">|</span>
        <span className="text-text-tertiary text-xs uppercase tracking-wide">
          {currentSlide.sectionLabel}
        </span>
      </div>

      {/* Center: nav arrows — absolutely centered, counter fixed-width so arrows don't shift */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={goPrev}
          disabled={isFirst}
          aria-label="Previous slide"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-text-tertiary text-xs tabular-nums w-8 text-center">
          {activeIndex + 1} / {slides.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={goNext}
          disabled={isLast}
          aria-label="Next slide"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Right zone — flex-1 mirrors left, justify-between with w-8 spacer centers the button */}
      <div className="flex-1 flex items-center justify-between">
        <div className="w-8" />
        <Button
          variant="ghost"
          size="sm"
          onClick={goToPrototype}
          disabled={isOnPrototype}
          className="text-accent-strong text-xs"
        >
          Jump to prototype
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setNavMenuOpen(true)}
          aria-label="Open slide menu"
        >
          <Menu className="size-4" />
        </Button>
      </div>
    </header>
  )
}
