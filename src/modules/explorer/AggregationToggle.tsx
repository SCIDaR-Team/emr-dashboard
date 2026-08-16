import { cn } from '@/lib/cn';
import type { Aggregation } from '@/lib/types';

const OPTIONS: { value: Aggregation; label: string; hint: string }[] = [
  {
    value: 'mean_score',
    label: 'Mean score',
    hint: 'Average 1–5 score across facilities in the area',
  },
  {
    value: 'pct_ready',
    label: '% Ready',
    hint: 'Share of facilities classified Ready',
  },
];

/**
 * How child units are aggregated.
 *
 * The two measures answer different questions and rank LGAs differently — an
 * area can have a decent mean score while very few facilities actually clear
 * the Ready threshold. Which one is active is always stated rather than
 * implied, and mean score is the default for continuity with the scorecards.
 */
export function AggregationToggle({
  value,
  onChange,
}: {
  value: Aggregation;
  onChange: (value: Aggregation) => void;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        Aggregate by
      </span>
      <div
        role="radiogroup"
        aria-label="Aggregation method"
        className="inline-flex rounded-lg border border-border bg-surface p-0.5"
      >
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            title={opt.hint}
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              value === opt.value
                ? 'bg-brand-600 font-medium text-surface'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
