import { PlaceholderSlide } from '@/components/slides/PlaceholderSlide'
import { PrototypeSlide } from '@/components/slides/PrototypeSlide'
import { TitleSlide } from '@/components/slides/TitleSlide'
import { ConceptSlide } from '@/components/slides/ConceptSlide'
import { UserJourneySlide } from '@/components/slides/UserJourneySlide'
import { ConsiderationsSlide } from '@/components/slides/ConsiderationsSlide'
import { NextStepsSlide } from '@/components/slides/NextStepsSlide'

export type SlideSection =
  | 'intro'
  | 'design-thinking'
  | 'prototype'
  | 'considerations'
  | 'next-steps'

export type SlideConfig = {
  id: string
  section: SlideSection
  sectionLabel: string
  title: string
  isPrototype?: boolean
  component: React.ComponentType
}

export const SLIDES: SlideConfig[] = [
  {
    id: 'title',
    section: 'intro',
    sectionLabel: 'Intro',
    title: 'Title',
    component: TitleSlide,
  },
  {
    id: 'concept',
    section: 'design-thinking',
    sectionLabel: 'Design Thinking',
    title: 'Concept',
    component: ConceptSlide,
  },
  {
    id: 'user-journey',
    section: 'design-thinking',
    sectionLabel: 'Design Thinking',
    title: 'User Journey',
    component: UserJourneySlide,
  },
  {
    id: 'prototype',
    section: 'prototype',
    sectionLabel: 'Prototype',
    title: 'Prototype',
    isPrototype: true,
    component: PrototypeSlide,
  },
  {
    id: 'considerations',
    section: 'considerations',
    sectionLabel: 'Considerations',
    title: 'Design Considerations',
    component: ConsiderationsSlide,
  },
  {
    id: 'next-steps',
    section: 'next-steps',
    sectionLabel: 'Next Steps',
    title: 'Next Steps',
    component: NextStepsSlide,
  },
]
