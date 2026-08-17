import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatCount } from '@/lib/format';
import type { InvestmentCategory, InvestmentItem } from '@/lib/types';

const CATEGORY_LABEL: Record<InvestmentCategory, string> = {
  infrastructure: 'Infrastructure',
  workforce: 'Workforce',
  workflow: 'Workflow',
  data_use: 'Data use',
};

/** Rows per page. Enough to read a category's worth at once without the table
 *  becoming the whole page. */
const DEFAULT_PAGE_SIZE = 8;

export interface InvestmentTableProps {
  items: InvestmentItem[];
  /** Rows per page. */
  pageSize?: number;
  className?: string;
}

/**
 * The itemised investment table — Item, Category, Quantity required, Unit
 * cost, Total cost — guide §9.1's shape, rolled up across whatever
 * population is in scope.
 *
 * Quantity is real, summed from what actually failed across the facilities
 * in scope. Unit cost and total cost read "Pending sign-off": no cost table
 * exists for this assessment in any supplied file, and the Figma's own
 * placeholder figures don't multiply out (several rows repeat ₦550,000
 * regardless of item) — inventing numbers here would be worse than marking
 * them pending, so the columns stay in the table rather than being dropped.
 *
 * Paged, because the national roll-up runs well past the height of the card
 * beside it and pushes the roadmap off the fold. The controls only appear
 * once there is a second page.
 */
export function InvestmentTable({
  items,
  pageSize = DEFAULT_PAGE_SIZE,
  className,
}: InvestmentTableProps) {
  const [page, setPage] = useState(0);

  // The row set changes under the reader whenever a filter moves, and page 3
  // of the national list may not exist for one state. Reset on a genuine
  // change of contents rather than on every new array identity.
  const signature = items.map((i) => i.id).join('|');
  const [seenSignature, setSeenSignature] = useState(signature);
  if (signature !== seenSignature) {
    setSeenSignature(signature);
    setPage(0);
  }

  if (!items.length) return null;

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const start = current * pageSize;
  const visible = items.slice(start, start + pageSize);

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="py-2 text-left font-semibold">Item</th>
              <th scope="col" className="py-2 text-left font-semibold">Category</th>
              <th scope="col" className="py-2 text-right font-semibold">Quantity required</th>
              <th scope="col" className="py-2 text-right font-semibold">Unit cost (₦)</th>
              <th scope="col" className="py-2 text-right font-semibold">Total cost (₦)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((item) => (
              <tr key={item.id}>
                <td className="py-2.5 font-medium text-foreground">{item.label}</td>
                <td className="py-2.5">
                  <Badge tone="neutral">{CATEGORY_LABEL[item.category]}</Badge>
                </td>
                <td className="py-2.5 text-right tabular-nums">{formatCount(item.quantity)}</td>
                <td className="py-2.5 text-right text-muted-foreground italic">Pending sign-off</td>
                <td className="py-2.5 text-right text-muted-foreground italic">Pending sign-off</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Showing {formatCount(start + 1)}–{formatCount(start + visible.length)} of{' '}
            {formatCount(items.length)} items
          </p>
          <div className="flex items-center gap-2">
            <PageButton
              label="Previous page"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft size={14} aria-hidden />
              Prev
            </PageButton>
            <span className="text-xs tabular-nums text-muted-foreground">
              Page {current + 1} of {pageCount}
            </span>
            <PageButton
              label="Next page"
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
            >
              Next
              <ChevronRight size={14} aria-hidden />
            </PageButton>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Quantities are derived from the assessment; unit costs await a signed-off cost table
        (guide §9.1, §17.4).
      </p>
    </div>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-lg border border-input px-2.5 text-xs font-medium transition-colors',
        disabled
          ? 'cursor-not-allowed text-muted-foreground/50'
          : 'text-foreground hover:border-brand-500/50 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      )}
    >
      {children}
    </button>
  );
}
