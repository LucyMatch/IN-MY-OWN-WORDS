import { PrototypeSlide } from '@/components/slides/PrototypeSlide'
import { TitleSlide } from '@/components/slides/TitleSlide'
import { ConceptSlide } from '@/components/slides/ConceptSlide'
import { ViewingGuideSlide } from '@/components/slides/ViewingGuideSlide'

export type SlideSection = 'context' | 'prototype'

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
    section: 'context',
    sectionLabel: 'Context',
    title: 'Title',
    component: TitleSlide,
  },
  {
    id: 'concept',
    section: 'context',
    sectionLabel: 'Context',
    title: 'Concept',
    component: ConceptSlide,
  },
  {
    id: 'viewing-guide',
    section: 'context',
    sectionLabel: 'Context',
    title: 'Prototype Viewing Guide',
    component: ViewingGuideSlide,
  },
  {
    id: 'prototype',
    section: 'prototype',
    sectionLabel: 'Prototype',
    title: 'Prototype',
    isPrototype: true,
    component: PrototypeSlide,
  },
]
