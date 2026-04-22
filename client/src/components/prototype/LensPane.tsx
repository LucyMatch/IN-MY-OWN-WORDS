import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Persona } from '@shared/types'

type LensPaneProps = {
  personas: Persona[]
  hasActiveHighlight: boolean
  onInvokeLens: (personaId: string) => void
  invokingPersonaId: string | null
  expanded: boolean
  onToggleExpanded: () => void
}

export function LensPane({
  personas,
  hasActiveHighlight,
  onInvokeLens,
  invokingPersonaId,
  expanded,
  onToggleExpanded,
}: LensPaneProps) {
  if (!expanded) {
    return (
      <div className="border-border-soft bg-background flex w-12 flex-shrink-0 flex-col items-center border-l py-3">
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-label="Open context lens panel"
          className="text-text-tertiary hover:text-text-primary flex size-6 cursor-pointer items-center justify-center transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="border-border-soft bg-background flex w-[280px] flex-shrink-0 flex-col border-l">
      <div className="border-border-subtle flex items-center justify-between border-b px-4 pb-2 pt-4">
        <p className="text-text-tertiary text-xs uppercase tracking-widest">Use a context lens</p>
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-label="Collapse context lens panel"
          className="text-text-tertiary hover:text-text-primary flex size-6 cursor-pointer items-center justify-center transition-colors"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="scroll-area flex-1 overflow-y-auto px-3 py-3">
        {!hasActiveHighlight ? (
          <p className="text-text-tertiary px-2 py-4 text-center text-sm">
            Highlight a passage to use a lens.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {personas.map((persona) => (
              <PersonaButton
                key={persona.id}
                persona={persona}
                loading={invokingPersonaId === persona.id}
                disabled={invokingPersonaId !== null}
                onClick={() => onInvokeLens(persona.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PersonaButton({
  persona,
  loading,
  disabled,
  onClick,
}: {
  persona: Persona
  loading: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'bg-surface shadow-input flex w-full flex-col items-start gap-1 rounded-xl px-3 py-3 text-left transition-opacity',
        'hover:shadow-input-hover',
        'disabled:cursor-not-allowed disabled:opacity-50',
        !disabled && 'cursor-pointer',
      )}
    >
      <span className="text-text-primary text-sm font-medium">{persona.name}</span>
      <span className="text-text-tertiary text-xs">{persona.subtitle}</span>
      <span className="text-text-secondary mt-1 text-xs italic">
        {loading ? 'thinking…' : `→ ${persona.buttonLabel}`}
      </span>
    </button>
  )
}
