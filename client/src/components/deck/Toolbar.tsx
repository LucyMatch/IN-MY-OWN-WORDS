import { ChevronLeft, ChevronRight, Menu } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useDeck } from '@/context/DeckContext'

export function Toolbar() {
  const { activeIndex, slides, goTo, goNext, goPrev, goToPrototype, isNavMenuOpen, setNavMenuOpen } = useDeck()

  const currentSlide = slides[activeIndex]
  const isFirst = activeIndex === 0
  const isLast = activeIndex === slides.length - 1
  const isOnPrototype = currentSlide.isPrototype === true

  return (
    <header
      className="relative flex w-full items-center border-b border-border-soft bg-surface px-4 shrink-0"
      style={{ height: 'var(--header-height)' }}
    >
      {/* Left zone — brand, section label (fixed-width), arrows + counter */}
      <div className="flex-1 flex items-center gap-2">
        <button
          onClick={() => goTo(0)}
          className="font-serif text-text-primary text-sm font-medium hover:opacity-70 transition-opacity cursor-pointer"
          aria-label="Go to home slide"
        >
          In Your Own Words
        </button>
        <span className="text-text-tertiary text-xs select-none">|</span>
        <span className="text-text-tertiary text-xs uppercase tracking-wide min-w-[96px] inline-block">
          {currentSlide.sectionLabel}
        </span>
        <div className="flex items-center gap-2 ml-4">
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
      </div>

      {/* Center zone — Jump to Prototype CTA */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <Button
          variant="primary"
          size="sm"
          onClick={goToPrototype}
          disabled={isOnPrototype}
        >
          Jump to Prototype
        </Button>
      </div>

      {/* Right zone — hamburger */}
      <div className="flex-1 flex items-center justify-end">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setNavMenuOpen(!isNavMenuOpen)}
          aria-label={isNavMenuOpen ? 'Close slide menu' : 'Open slide menu'}
        >
          <Menu className="size-4" />
        </Button>
      </div>
    </header>
  )
}
