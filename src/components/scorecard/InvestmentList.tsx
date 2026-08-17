import { cn } from '@/lib/cn';
import type { InvestmentItem, InvestmentPriority } from '@/lib/types';

const PRIORITY_CLASSES: Record<InvestmentPriority, string> = {
  high: 'bg-notready-wash text-notready',
  medium: 'bg-moderate-wash text-moderate',
  low: 'bg-ready-wash text-ready',
};

const PRIORITY_LABEL: Record<InvestmentPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export interface InvestmentListProps {
  items: InvestmentItem[];
  /** Show the quantity alongside the label — off by default for the
   *  per-facility list, where "1" on every line adds nothing. */
  showQuantity?: boolean;
  className?: string;
}

/**
 * A theme's prioritised action list — "Install inverter or solar backup
 * power system — High", one row per triggered investment item.
 *
 * No cost figure anywhere here: quantities are derived from what actually
 * failed at this facility, but no unit-cost table has been signed off
 * (guide §9.1, §17.4), and inventing one would be worse than omitting it.
 */
export function InvestmentList({ items, showQuantity = false, className }: InvestmentListProps) {
  if (!items.length) return null;

  return (
    <ul className={cn('divide-y divide-border', className)}>
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="text-foreground">
            {item.label}
            {showQuantity && item.quantity > 1 && (
              <span className="text-muted-foreground"> ({item.quantity})</span>
            )}
          </span>
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
              PRIORITY_CLASSES[item.priority],
            )}
          >
            {PRIORITY_LABEL[item.priority]}
          </span>
        </li>
      ))}
    </ul>
  );
}
