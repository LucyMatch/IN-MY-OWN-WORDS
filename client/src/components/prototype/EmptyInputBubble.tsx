import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

type EmptyInputBubbleProps = {
  onStage: (text: string) => void
  disabled?: boolean
}

export function EmptyInputBubble({ onStage, disabled }: EmptyInputBubbleProps) {
  const [value, setValue] = useState('')
  const canStage = value.trim().length > 0 && !disabled

  function handleStage() {
    if (!canStage) return
    onStage(value.trim())
    setValue('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleStage()
    }
  }

  return (
    <div className="bg-page shadow-input mb-3 flex flex-col rounded-xl">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="In your own words…"
        rows={3}
        disabled={disabled}
        className="text-text-primary placeholder:text-text-tertiary resize-none border-none bg-transparent px-3 py-3 text-sm leading-snug outline-none disabled:opacity-50"
      />
      <div className="flex justify-end p-2">
        <button
          type="button"
          onClick={handleStage}
          disabled={!canStage}
          aria-label="Stage this description"
          className={cn(
            'text-text-tertiary hover:bg-highlight hover:text-text-primary flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  )
}
