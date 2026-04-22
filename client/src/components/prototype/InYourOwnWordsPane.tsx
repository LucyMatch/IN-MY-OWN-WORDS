import { useEffect, useState } from 'react'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { EmptyInputBubble } from '@/components/prototype/EmptyInputBubble'
import { StagedBubble } from '@/components/prototype/StagedBubble'
import type { Highlight } from '@shared/types'

type InYourOwnWordsPaneProps = {
  highlights: Highlight[]
  activeHighlightId: string | null
  onSetActiveHighlight: (id: string | null) => void
  onAddBubble: (highlightId: string, text: string) => void
  onUpdateBubble: (highlightId: string, bubbleId: string, text: string) => void
  onDeleteBubble: (highlightId: string, bubbleId: string) => void
  commitReady: boolean
  facilitatorLoading: boolean
  onCommit: (highlightId: string) => void
}

export function InYourOwnWordsPane({
  highlights,
  activeHighlightId,
  onSetActiveHighlight,
  onAddBubble,
  onUpdateBubble,
  onDeleteBubble,
  commitReady,
  facilitatorLoading,
  onCommit,
}: InYourOwnWordsPaneProps) {
  const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(false)

  useEffect(() => {
    if (activeHighlightId !== null) {
      setIsManuallyCollapsed(false)
    }
  }, [activeHighlightId])

  const activeHighlight = highlights.find((h) => h.id === activeHighlightId) ?? null
  const isCommitted =
    !!activeHighlight &&
    activeHighlight.bubbles.length > 0 &&
    activeHighlight.bubbles.every((b) => b.committed)

  return (
    <aside
      data-collapsed={isManuallyCollapsed || undefined}
      className={cn(
        'group/bubbles bg-surface border-border-soft flex h-full flex-shrink-0 flex-col overflow-hidden border-l transition-[width] duration-300',
        'w-[var(--bubbles-pane-width)] data-[collapsed]:w-[var(--bubbles-pane-width-collapsed)]',
      )}
    >
      {/* Collapsed strip — chevron only */}
      <div className="hidden flex-col items-center pt-3 group-data-[collapsed]/bubbles:flex">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsManuallyCollapsed(false)}
          aria-label="Expand In Your Own Words pane"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Expanded content */}
      <div className="flex h-full flex-col group-data-[collapsed]/bubbles:hidden">
        {/* Header */}
        <div className="border-border-subtle flex items-center justify-between border-b px-4 py-3">
          <p className="text-text-tertiary text-xs uppercase tracking-widest">In Your Own Words</p>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsManuallyCollapsed(true)}
            aria-label="Collapse pane"
          >
            <ChevronLeft className="size-4" />
          </Button>
        </div>

        {/* Scroll area */}
        <div className="scroll-area flex-1 overflow-y-auto px-4 py-4">
          {activeHighlight ? (
            <>
              {activeHighlight.bubbles.map((b) => (
                <StagedBubble
                  key={b.id}
                  bubble={b}
                  onUpdate={(text) => onUpdateBubble(activeHighlight.id, b.id, text)}
                  onDelete={() => onDeleteBubble(activeHighlight.id, b.id)}
                  disabled={facilitatorLoading}
                />
              ))}
              {!isCommitted && (
                <EmptyInputBubble
                  onStage={(text) => onAddBubble(activeHighlight.id, text)}
                  disabled={facilitatorLoading}
                />
              )}
            </>
          ) : (
            <div className="text-text-tertiary flex h-full flex-col items-center justify-center px-6 text-center text-sm">
              <p>Highlight some text to work on an understanding, or click an existing highlight to revisit it.</p>
            </div>
          )}
        </div>

        {/* Commit footer */}
        {isCommitted ? (
          <div className="border-border-subtle flex items-center justify-center border-t px-4 pt-3 pb-[50px]">
            <div className="text-commit flex items-center gap-2 text-sm">
              <Check className="size-4" />
              <span>Committed</span>
            </div>
          </div>
        ) : activeHighlight ? (
          <div className="border-border-subtle flex flex-col items-stretch border-t px-4 pt-3 pb-[50px]">
            <Button
              variant="primary"
              disabled={!commitReady || facilitatorLoading || activeHighlight.bubbles.length === 0}
              onClick={() => onCommit(activeHighlight.id)}
              title={!commitReady ? 'Facilitator response required to commit' : undefined}
              className="w-full gap-2"
            >
              <Check className="size-4" />
              Commit
            </Button>
            {!commitReady && activeHighlight.bubbles.length > 0 && !facilitatorLoading && (
              <button
                type="button"
                onClick={() => onCommit(activeHighlight.id)}
                className="text-text-tertiary hover:text-text-primary mt-2 cursor-pointer text-xs underline-offset-2 hover:underline"
              >
                Commit anyway
              </button>
            )}
          </div>
        ) : (
          <div className="border-border-subtle border-t px-4 pt-3 pb-[50px]">
            <Button
              variant="primary"
              disabled
              title="Facilitator response required to commit"
              className="w-full gap-2"
            >
              <Check className="size-4" />
              Commit
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}
