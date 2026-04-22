import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Bubble } from '@shared/types'

type StagedBubbleProps = {
  bubble: Bubble
  onUpdate: (text: string) => void
  onDelete: () => void
  disabled?: boolean
}

export function StagedBubble({ bubble, onUpdate, onDelete, disabled }: StagedBubbleProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(bubble.text)

  function handleSave() {
    const trimmed = draft.trim()
    if (trimmed.length === 0) {
      onDelete()
      return
    }
    onUpdate(trimmed)
    setIsEditing(false)
  }

  function handleCancel() {
    setDraft(bubble.text)
    setIsEditing(false)
  }

  return (
    <div
      data-editing={isEditing || undefined}
      data-committed={bubble.committed || undefined}
      className={cn(
        'mb-3 flex flex-col rounded-xl px-3 py-2 transition-colors duration-500',
        'bg-highlight data-[committed]:bg-commit',
      )}
    >
      {isEditing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          autoFocus
          className="text-text-primary placeholder:text-text-tertiary resize-none border-none bg-transparent text-sm leading-snug outline-none"
        />
      ) : (
        <p className="text-text-primary text-sm leading-snug">{bubble.text}</p>
      )}
      {!bubble.committed && (
        <div className="mt-1 flex justify-end gap-1">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={handleCancel}
                aria-label="Cancel edit"
                className="text-text-tertiary hover:text-text-primary flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors"
              >
                <X className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={disabled}
                aria-label="Save edit"
                className="text-text-tertiary hover:text-text-primary flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors disabled:opacity-40"
              >
                <Check className="size-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => !disabled && setIsEditing(true)}
                disabled={disabled}
                aria-label="Edit bubble"
                className="text-text-tertiary hover:text-text-primary flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors disabled:opacity-40"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={disabled}
                aria-label="Delete bubble"
                className="text-text-tertiary hover:text-danger flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors disabled:opacity-40"
              >
                <X className="size-3.5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
