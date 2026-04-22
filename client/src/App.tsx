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
