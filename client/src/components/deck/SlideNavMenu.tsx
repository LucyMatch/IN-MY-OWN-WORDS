import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useDeck } from '@/context/DeckContext'
import { cn } from '@/lib/utils'

export function SlideNavMenu() {
  const { slides, activeIndex, goTo, isNavMenuOpen, setNavMenuOpen } = useDeck()

  const handleNavigate = (index: number) => {
    goTo(index)
    setNavMenuOpen(false)
  }

  return (
    <>
      {/* Backdrop */}
      {isNavMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20"
          style={{ top: 'var(--header-height)' }}
          onClick={() => setNavMenuOpen(false)}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 bottom-0 w-1/4 bg-surface shadow-popover flex flex-col transition-transform duration-200',
          isNavMenuOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        style={{ top: 'var(--header-height)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-soft">
          <span className="font-serif text-text-primary text-sm">Navigation</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setNavMenuOpen(false)}
            aria-label="Close menu"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Slide list */}
        <nav className="flex-1 overflow-y-auto py-2">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => handleNavigate(index)}
              className={cn(
                'w-full text-left px-4 py-2 text-sm transition-colors hover:bg-state-hover',
                index === activeIndex
                  ? 'text-text-primary font-medium bg-state-pill rounded-sm'
                  : 'text-text-secondary',
              )}
            >
              {index + 1} · {slide.title}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border-soft mt-auto">
          <a
            href="https://lucymatch.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-tertiary text-xs hover:text-text-secondary transition-colors"
          >
            by Lucy Matchett
          </a>
        </div>
      </div>
    </>
  )
}
