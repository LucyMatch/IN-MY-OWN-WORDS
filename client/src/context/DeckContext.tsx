import { createContext, useContext, useState } from 'react'
import type { SlideConfig } from '@/slides.config'

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

const DeckContext = createContext<DeckContextValue | null>(null)

export function useDeck(): DeckContextValue {
  const ctx = useContext(DeckContext)
  if (!ctx) throw new Error('useDeck must be used inside DeckProvider')
  return ctx
}

export function DeckProvider({
  slides,
  children,
}: {
  slides: SlideConfig[]
  children: React.ReactNode
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isNavMenuOpen, setNavMenuOpen] = useState(false)

  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(index, slides.length - 1))
    setActiveIndex(clamped)
  }

  const goNext = () => goTo(activeIndex + 1)
  const goPrev = () => goTo(activeIndex - 1)

  const goToPrototype = () => {
    const idx = slides.findIndex((s) => s.isPrototype)
    if (idx !== -1) goTo(idx)
  }

  return (
    <DeckContext.Provider
      value={{ activeIndex, goTo, goNext, goPrev, goToPrototype, slides, isNavMenuOpen, setNavMenuOpen }}
    >
      {children}
    </DeckContext.Provider>
  )
}
