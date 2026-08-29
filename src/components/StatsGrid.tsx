export interface StatsGridProps {
  cards: Array<{ label: string; value: string | number }>;
}

export function StatsGrid({ cards }: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-md border border-surface-border bg-surface px-3 py-2.5"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">{card.label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-white">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
