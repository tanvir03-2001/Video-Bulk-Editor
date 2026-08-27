export interface StatsGridProps {
  cards: Array<{ label: string; value: string | number }>;
}

export function StatsGrid({ cards }: StatsGridProps) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-md border border-surface-border bg-surface-raised px-2.5 py-2 text-center"
        >
          <p className="text-xs font-medium tracking-readable text-slate-400">{card.label}</p>
          <p className="mt-1 text-base font-semibold tabular-nums tracking-readable text-white">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
