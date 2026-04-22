const considerations = [
  '[PLACEHOLDER: consideration 1]',
  '[PLACEHOLDER: consideration 2]',
  '[PLACEHOLDER: consideration 3]',
]

export function ConsiderationsSlide() {
  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="px-16 py-12 max-w-3xl mx-auto">
        <p className="text-text-tertiary text-xs uppercase tracking-widest mb-2">Considerations</p>
        <h2 className="font-serif text-4xl text-text-primary mb-8">Design Considerations</h2>
        <ul className="space-y-4">
          {considerations.map((item, i) => (
            <li key={i} className="flex gap-3 font-sans text-text-secondary leading-relaxed">
              <span className="text-text-tertiary shrink-0 mt-0.5">·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
