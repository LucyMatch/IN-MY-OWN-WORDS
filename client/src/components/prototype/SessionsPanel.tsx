import { useState } from 'react'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { Session } from '@shared/types'

type SessionsPanelProps = {
  sessions: Session[]
  activeSessionId: string
  onSelect: (id: string) => void
  onClearSession: (id: string) => void
  loading: boolean
  error: string | null
  highlightCountsBySession: Record<string, number>
}

export function SessionsPanel({
  sessions,
  activeSessionId,
  onSelect,
  onClearSession,
  loading,
  error,
  highlightCountsBySession,
}: SessionsPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [pendingClearId, setPendingClearId] = useState<string | null>(null)

  function handleClearClick(sessionId: string) {
    if (pendingClearId === sessionId) {
      onClearSession(sessionId)
      setPendingClearId(null)
    } else {
      setPendingClearId(sessionId)
      setTimeout(() => {
        setPendingClearId((prev) => (prev === sessionId ? null : prev))
      }, 3000)
    }
  }

  return (
    <nav
      data-collapsed={isCollapsed || undefined}
      className={cn(
        'group/sessions bg-surface border-border-soft flex h-full flex-shrink-0 flex-col overflow-hidden border-r transition-[width] duration-200',
        'w-[var(--sidebar-width)] data-[collapsed]:w-[var(--sidebar-width-collapsed)]',
      )}
    >
      {/* Collapsed affordance — only visible when collapsed */}
      <div className="hidden group-data-[collapsed]/sessions:flex flex-col items-center pt-3">
        <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(false)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Expanded affordance — hidden when collapsed */}
      <div className="flex flex-col group-data-[collapsed]/sessions:hidden">
        <div className="flex justify-end px-2 pt-2">
          <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(true)}>
            <ChevronLeft className="size-4" />
          </Button>
        </div>

        <p className="text-text-tertiary px-4 pt-4 pb-2 text-xs uppercase tracking-widest">
          Sessions
        </p>

        {loading && (
          <p className="text-text-tertiary px-4 py-3 text-xs">Loading sessions…</p>
        )}

        {error && (
          <p className="text-danger px-4 py-3 text-xs">{error}</p>
        )}

        {!loading && !error && sessions.map((session) => {
          const count = highlightCountsBySession[session.id] ?? 0
          return (
            <div
              key={session.id}
              data-active={session.id === activeSessionId || undefined}
              className={cn(
                'group/row relative flex items-center',
                'hover:bg-state-hover data-[active]:bg-state-pill',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(session.id)}
                className="flex flex-1 flex-col gap-0.5 px-4 py-3 text-left cursor-pointer"
              >
                <span className="text-text-primary text-sm">{session.title}</span>
                <span className="text-text-tertiary text-xs">{session.author}</span>
              </button>

              {count > 0 && (
                pendingClearId === session.id ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onClearSession(session.id)
                      setPendingClearId(null)
                    }}
                    className="bg-danger text-surface mr-3 flex h-6 items-center gap-1 rounded-full px-2 text-xs cursor-pointer"
                  >
                    <Trash2 className="size-3" />
                    <span>Confirm?</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleClearClick(session.id)
                    }}
                    title={`Clear ${count} highlight${count === 1 ? '' : 's'}`}
                    aria-label={`Clear highlights for ${session.title}`}
                    className={cn(
                      'text-text-tertiary hover:text-danger mr-3 flex size-6 cursor-pointer items-center justify-center rounded-full transition-opacity',
                      'opacity-0 group-hover/row:opacity-100 focus:opacity-100',
                    )}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
