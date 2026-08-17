import { Badge } from '@/components/ui';
import { formatCount } from '@/lib/format';
import type { InvestmentCategory, InvestmentItem } from '@/lib/types';

const CATEGORY_LABEL: Record<InvestmentCategory, string> = {
  infrastructure: 'Infrastructure',
  workforce: 'Workforce',
  workflow: 'Workflow',
  data_use: 'Data use',
};

export interface InvestmentTableProps {
  items: InvestmentItem[];
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
 */
export function InvestmentTable({ items, className }: InvestmentTableProps) {
  if (!items.length) return null;

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
            {items.map((item) => (
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
      <p className="mt-3 text-xs text-muted-foreground">
        Quantities are derived from the assessment; unit costs await a signed-off cost table
        (guide §9.1, §17.4).
      </p>
    </div>
  );
}
