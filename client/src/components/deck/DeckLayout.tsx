import { Toolbar } from '@/components/deck/Toolbar'
import { SlideNavMenu } from '@/components/deck/SlideNavMenu'
import { useDeck } from '@/context/DeckContext'

export function DeckLayout() {
  const { slides, activeIndex } = useDeck()
  const ActiveSlide = slides[activeIndex].component

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-page">
      <Toolbar />
      <main className="flex-1 overflow-hidden relative pb-4">
        <ActiveSlide />
      </main>
      <SlideNavMenu />
    </div>
  )
}
