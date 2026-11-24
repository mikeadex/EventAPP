/** Title + numbered progress for multi-step host flows. */
export function StepHeader({ eyebrow, steps, current }: { eyebrow: string; steps: string[]; current: number }) {
  return (
    <div className="mb-8 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="eyebrow text-accent">
          {eyebrow} · Step {current + 1} of {steps.length}
        </span>
        <h1 className="h1 !text-[40px]">{steps[current]}</h1>
      </div>
      <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => (
          <li key={s} className="flex flex-col gap-2" aria-current={i === current ? 'step' : undefined}>
            <span className={`h-1 rounded-full ${i <= current ? 'bg-accent' : 'bg-line-2'}`} />
            <span className={`hidden text-[12px] sm:block ${i === current ? 'text-ink' : 'text-faint'}`}>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
