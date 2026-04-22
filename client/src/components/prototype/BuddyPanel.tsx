import { Minus, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { BuddyResponse, Highlight } from '@shared/types'

type BuddyPanelProps = {
  activeHighlight: Highlight | null
  isConsulting: boolean
  onVerify: (highlightId: string, responseId: string) => void
  onReRun: (highlightId: string, buddyId: string) => void
  onDeleteResponse: (highlightId: string, responseId: string) => void
}

export function BuddyPanel({ activeHighlight, isConsulting, onVerify, onReRun, onDeleteResponse }: BuddyPanelProps) {
  return (
    <div className="border-border-soft flex min-h-0 flex-1 flex-col border-t">
      <div className="border-border-subtle flex items-center border-b px-4 pb-2 pt-4">
        <p className="text-text-tertiary text-xs uppercase tracking-widest">Buddies</p>
      </div>

      <div className="scroll-area flex-1 overflow-y-auto px-4 py-3">
        {!activeHighlight ? (
          <EmptyState />
        ) : activeHighlight.buddyResponses.length === 0 && isConsulting ? (
          <LoadingSkeleton />
        ) : activeHighlight.buddyResponses.length === 0 ? (
          <NotYetState />
        ) : (
          <>
            {activeHighlight.buddyResponses.map((resp) => (
              <BuddyCard
                key={resp.id}
                response={resp}
                onVerify={() => onVerify(activeHighlight.id, resp.id)}
                onReRun={() => onReRun(activeHighlight.id, resp.buddyId)}
                onDeleteResponse={() => onDeleteResponse(activeHighlight.id, resp.id)}
              />
            ))}
            {isConsulting && <LoadingSkeleton inline />}
          </>
        )}
      </div>

      <div className="border-border-subtle border-t p-3">
        <Button
          variant="ghost"
          disabled
          title="Coming soon"
          className="w-full gap-2"
        >
          + Add a buddy
        </Button>
      </div>
    </div>
  )
}

function BuddyCard({
  response,
  onVerify,
  onReRun,
  onDeleteResponse,
}: {
  response: BuddyResponse
  onVerify: () => void
  onReRun: () => void
  onDeleteResponse: () => void
}) {
  return (
    <div
      data-error={!!response.error || undefined}
      className={cn('bg-surface shadow-input mb-3 flex flex-col rounded-xl px-3 py-3')}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-text-primary text-xs font-medium">{response.buddyName ?? response.buddyId}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onReRun}
            aria-label="Re-run this buddy"
            className="text-text-tertiary hover:text-text-primary flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors"
          >
            <RefreshCw className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDeleteResponse}
            aria-label="Delete this response"
            className="text-text-tertiary hover:text-danger flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors"
          >
            <Minus className="size-3.5" />
          </button>
        </div>
      </div>

      {response.error ? (
        <p className="text-danger text-sm">Error: {response.error}</p>
      ) : (
        <>
          <p className="text-text-primary whitespace-pre-line text-sm leading-snug">{response.text}</p>

          {response.verification && (
            <div className="border-border-subtle mt-3 rounded-md border-l-2 px-3 py-2">
              <p className="text-text-tertiary mb-1 text-xs uppercase tracking-widest">Verification</p>
              <p className="text-text-secondary whitespace-pre-line text-sm leading-snug">{response.verification}</p>
            </div>
          )}

          {!response.verification && !response.verifying && (
            <button
              type="button"
              onClick={onVerify}
              className="text-text-tertiary hover:text-text-primary mt-2 cursor-pointer self-start text-xs underline-offset-2 hover:underline"
            >
              Verify
            </button>
          )}
          {response.verifying && (
            <p className="text-text-tertiary mt-2 text-xs">Verifying…</p>
          )}
        </>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-text-tertiary flex h-full flex-col items-center justify-center px-6 text-center text-sm">
      <p>Buddies will appear here once you've highlighted a passage and staged a bubble.</p>
    </div>
  )
}

function NotYetState() {
  return (
    <div className="text-text-tertiary flex h-full flex-col items-center justify-center px-6 text-center text-sm">
      <p>Stage your first bubble to call in the buddies.</p>
    </div>
  )
}

function LoadingSkeleton({ inline = false }: { inline?: boolean }) {
  return (
    <div className={cn('flex gap-2 py-2', !inline && 'h-full items-center justify-center')}>
      <span className="text-text-tertiary text-sm">Buddies are reading</span>
      <span className="animate-bounce text-text-tertiary" style={{ animationDelay: '0ms' }}>•</span>
      <span className="animate-bounce text-text-tertiary" style={{ animationDelay: '150ms' }}>•</span>
      <span className="animate-bounce text-text-tertiary" style={{ animationDelay: '300ms' }}>•</span>
    </div>
  )
}
