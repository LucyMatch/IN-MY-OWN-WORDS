import { Fragment } from 'react'
import { ArrowRight } from 'lucide-react'

const steps = [
  '[PLACEHOLDER: step 1]',
  '[PLACEHOLDER: step 2]',
  '[PLACEHOLDER: step 3]',
  '[PLACEHOLDER: step 4]',
]

export function UserJourneySlide() {
  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="px-16 py-12 max-w-3xl mx-auto">
        <p className="text-text-tertiary text-xs uppercase tracking-widest mb-2">Design Thinking</p>
        <h2 className="font-serif text-4xl text-text-primary mb-10">User Journey</h2>
        <div className="flex flex-row items-center gap-3">
          {steps.map((step, i) => (
            <Fragment key={i}>
              <div className="bg-surface border border-border-soft rounded-md p-4 flex-1">
                <p className="text-text-tertiary text-xs font-sans mb-1">{i + 1}</p>
                <p className="font-sans text-text-secondary text-sm leading-relaxed">{step}</p>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="text-text-tertiary shrink-0" size={16} />
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
