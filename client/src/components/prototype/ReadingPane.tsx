import { useLayoutEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  buildHighlightText,
  computeRangesFromSelection,
  segmentParagraph,
  splitIntoParagraphs,
} from '@/lib/highlights'
import type { Highlight, Session } from '@shared/types'

type ReadingPaneProps = {
  session: Session | null
  text: string
  loading: boolean
  highlights: Highlight[]
  activeHighlightId: string | null
  onAddHighlight: (h: Highlight) => void
  onDeleteHighlight: (id: string) => void
  onSetActiveHighlight: (id: string | null) => void
}

export function ReadingPane({
  session,
  text,
  loading,
  highlights,
  activeHighlightId,
  onAddHighlight,
  onDeleteHighlight,
  onSetActiveHighlight,
}: ReadingPaneProps) {
  const blocks = splitIntoParagraphs(text)
  const paragraphsRootRef = useRef<HTMLDivElement>(null)
  const [markerPositions, setMarkerPositions] = useState<Record<string, number>>({})

  useLayoutEffect(() => {
    if (!paragraphsRootRef.current) return
    const root = paragraphsRootRef.current
    const next: Record<string, number> = {}
    for (const h of highlights) {
      const firstRange = h.ranges[0]
      if (!firstRange) continue
      const mark = root.querySelector<HTMLElement>(`[data-highlight-id="${h.id}"]`)
      if (!mark) continue
      next[h.id] = mark.offsetTop
    }
    setMarkerPositions(next)
  }, [highlights, text])

  function handleMouseUp() {
    if (!paragraphsRootRef.current) return
    if (!session) return
    const ranges = computeRangesFromSelection(blocks, paragraphsRootRef.current)
    if (!ranges || ranges.length === 0) return

    const newHighlight: Highlight = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      ranges,
      text: buildHighlightText(blocks, ranges),
      bubbles: [],
      buddyResponses: [],
      commitReady: false,
      createdAt: new Date().toISOString(),
    }
    onAddHighlight(newHighlight)
    window.getSelection()?.removeAllRanges()
  }

  return (
    <div className={cn('flex-1 overflow-y-auto')}>
      <div className="mx-auto max-w-2xl px-10 py-10">
        {session && (
          <div className="mb-6">
            <p className="text-text-tertiary text-xs uppercase tracking-widest">{session.section}</p>
            <h1 className="font-serif text-text-primary mt-1 text-2xl">{session.title}</h1>
            <p className="text-text-secondary mt-1 text-sm">{session.author}</p>
            <div className="border-border-subtle mb-6 mt-4 border-b" />
          </div>
        )}

        {loading && (
          <p className="text-text-tertiary text-sm">Loading…</p>
        )}

        {!loading && !session && (
          <p className="text-text-tertiary text-sm">No session selected</p>
        )}

        {!loading && session && !text && (
          <p className="text-text-tertiary text-sm">No text available</p>
        )}

        {!loading && text && (
          <div
            ref={paragraphsRootRef}
            onMouseUp={handleMouseUp}
            className="relative"
          >
            {blocks.map((blockText, i) => {
              const rangesForThis = highlights.flatMap((h) =>
                h.ranges
                  .filter((r) => r.paragraphIndex === i)
                  .map((r) => ({ ...r, highlightId: h.id })),
              )
              const segments = segmentParagraph(blockText, rangesForThis)

              const isHeading = i === 0
              const Tag = isHeading ? 'h2' : 'p'
              const tagClass = isHeading
                ? 'font-serif text-text-primary mb-4 text-lg uppercase tracking-widest'
                : 'font-serif text-text-secondary mb-4 leading-relaxed whitespace-pre-line'

              return (
                <Tag key={i} data-paragraph-index={i} className={tagClass}>
                  {segments.map((seg, j) => {
                    if (seg.type === 'text') return seg.text
                    const h = highlights.find((x) => x.id === seg.highlightId)
                    const isCommitted = h
                      ? h.bubbles.length > 0 && h.bubbles.every((b) => b.committed)
                      : false
                    return (
                      <mark
                        key={j}
                        data-highlight-id={seg.highlightId}
                        data-active={seg.highlightId === activeHighlightId || undefined}
                        data-committed={isCommitted || undefined}
                        onClick={() => onSetActiveHighlight(seg.highlightId)}
                        className={cn(
                          'cursor-pointer rounded-[2px] px-0.5 transition-colors duration-500',
                          'bg-highlight data-[committed]:bg-commit',
                          'data-[active]:ring-2 data-[active]:ring-accent-strong/40',
                        )}
                      >
                        {seg.text}
                      </mark>
                    )
                  })}
                </Tag>
              )
            })}

            {highlights.map((h) => {
              const top = markerPositions[h.id]
              if (top === undefined) return null
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => onDeleteHighlight(h.id)}
                  aria-label="Delete highlight"
                  className={cn(
                    'text-text-tertiary hover:text-danger absolute -left-8 flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors',
                  )}
                  style={{ top }}
                >
                  <X className="size-3.5" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
