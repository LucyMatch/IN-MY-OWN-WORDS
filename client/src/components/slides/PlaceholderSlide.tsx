import { useDeck } from '@/context/DeckContext'

export function PlaceholderSlide() {
  const { slides, activeIndex } = useDeck()
  const slide = slides[activeIndex]

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-3">
      <p className="text-text-tertiary text-xs uppercase tracking-widest">{slide.sectionLabel}</p>
      <h1 className="font-serif text-text-primary text-3xl">{slide.title}</h1>
      <p className="text-text-tertiary text-sm">Slide content coming soon</p>
    </div>
  )
}
