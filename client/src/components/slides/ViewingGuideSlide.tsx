import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ViewingGuideSlide() {
  const [isGuideOpen, setIsGuideOpen] = useState(false)

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-16 py-12">
        <p className="text-text-tertiary text-xs uppercase tracking-widest mb-2">Viewing Guide</p>
        <h2 className="font-serif text-4xl text-text-primary mb-8">Prototype Viewing Guide</h2>

        <ul className="space-y-3 text-text-secondary text-base leading-relaxed mb-10 list-disc pl-5">
          <li>Desktop viewing</li>
          <li>Only tested in Firefox</li>
          <li>
            Reminder: this isn't an annotation tool — the "In Your Own Words" feature just
            lives inside one
          </li>
        </ul>

        <button
          type="button"
          onClick={() => setIsGuideOpen((v) => !v)}
          className={cn(
            'text-text-primary hover:text-accent-strong flex items-center gap-2 text-sm cursor-pointer transition-colors',
          )}
          aria-expanded={isGuideOpen}
        >
          <span className="uppercase tracking-widest text-xs">How to use</span>
          <ChevronDown
            className={cn('size-4 transition-transform', isGuideOpen && 'rotate-180')}
          />
        </button>

        {isGuideOpen && (
          <ol className="mt-6 space-y-3 text-text-secondary text-sm leading-relaxed list-decimal pl-5">
            <li>Select a session on the far left (Romeo &amp; Juliet or Pride &amp; Prejudice)</li>
            <li>Highlight a section of text you want to explain</li>
            <li>
              Write your understanding in the "In Your Own Words" pane, in your own words.
              Hit + when ready to review.
            </li>
            <li>Chat responds to your explanation and guides you through refinement</li>
            <li>Talk to chat to workshop your thoughts</li>
            <li>
              Stuck? Select a context lens on the right pane — it'll explain from a different
              angle or analogy to help you unstick
            </li>
            <li>
              Add another "In Your Own Words" description any time, hit + to stage it. Add as
              many as you like.
            </li>
            <li>
              When your explanation feels refined and comprehensive, commit — this saves it
              as a refined understanding
            </li>
            <li>
              Commit is unavailable until the chat facilitator agrees your understanding is
              solid. You can bypass this with the text link under the button.
            </li>
            <li>
              Not committing still stores your explanation, just marked as staged (shown in a
              different colour)
            </li>
            <li>Click any existing highlight to view its previous descriptions</li>
          </ol>
        )}
      </div>
    </div>
  )
}
