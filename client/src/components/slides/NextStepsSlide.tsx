const steps = [
  '[PLACEHOLDER: next step 1]',
  '[PLACEHOLDER: next step 2]',
  '[PLACEHOLDER: next step 3]',
]

export function NextStepsSlide() {
  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="px-16 py-12 max-w-3xl mx-auto">
        <p className="text-text-tertiary text-xs uppercase tracking-widest mb-2">Next Steps</p>
        <h2 className="font-serif text-4xl text-text-primary mb-8">Next Steps & Iterations</h2>
        <ol className="space-y-6">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-5">
              <span className="font-serif text-2xl text-accent-strong leading-none shrink-0">{i + 1}</span>
              <span className="font-sans text-text-secondary leading-relaxed pt-1">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
