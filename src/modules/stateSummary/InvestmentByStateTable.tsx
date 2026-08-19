import { useMemo } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { formatCount, formatNaira } from '@/lib/format';
import { THEMES } from '@/lib/themes';
import type { AreaProfile } from '@/lib/types';
import {
  lineTotal,
  usesIllustrative,
  type RateContext,
} from '@/modules/investment/investmentRates';
import { useInvestmentRateStore } from '@/store/investmentRateStore';

/** Only the four facility-level domains trigger costed actions. Leadership &
 *  Governance is state-scored and carries none — a column of zeroes would read
 *  as "nothing needed" rather than "the instrument cannot see this". */
const INVESTMENT_THEMES = THEMES.filter((t) => t.facilityLevel);

interface InvestmentByStateTableProps {
  /** Assessed states in scope, any order — the table ranks them itself. */
  states: AreaProfile[];
  /** Open this state's costed schedule on the Investment Plan page. */
  onSelectState: (state: AreaProfile) => void;
}

/** Sum of quantity and cost per theme for one state, plus that state's totals.
 *  Cost is null when nothing in the state has a rate — distinct from ₦0. */
function summarise(state: AreaProfile, ctx: RateContext) {
  const quantity: Record<string, number> = {};
  const cost: Record<string, number> = {};
  let priced = 0;

  for (const item of state.investments) {
    quantity[item.themeId] = (quantity[item.themeId] ?? 0) + item.quantity;
    const total = lineTotal(item, ctx);
    if (total != null) {
      cost[item.themeId] = (cost[item.themeId] ?? 0) + total;
      priced += 1;
    }
  }

  return {
    quantity,
    cost,
    totalQuantity: state.investments.reduce((sum, i) => sum + i.quantity, 0),
    totalCost: priced ? Object.values(cost).reduce((a, b) => a + b, 0) : null,
  };
}

/**
 * Investment required, by state.
 *
 * This used to be four national bars — one per domain, summed across all 12
 * states. On a page that no longer has a State filter, that left the whole
 * costed picture with no way to ask the only question a rollout budget starts
 * from: which state needs the most, and in what.
 *
 * Quantities are real, derived from what actually failed at each facility.
 * Naira is not: the assessment workbook publishes no cost table, so the cost
 * column reads "pending" until someone enters rates or switches the
 * placeholders on — both on the Investment Plan page, and both shared with this
 * table through `investmentRateStore` so the two pages can never quote
 * different totals for the same states.
 */
export function InvestmentByStateTable({
  states,
  onSelectState,
}: InvestmentByStateTableProps) {
  const entered = useInvestmentRateStore((s) => s.entered);
  const illustrative = useInvestmentRateStore((s) => s.illustrative);
  const ctx: RateContext = useMemo(
    () => ({ entered, illustrative }),
    [entered, illustrative],
  );

  const rows = useMemo(
    () =>
      states
        .map((state) => ({ state, ...summarise(state, ctx) }))
        .sort((a, b) => b.totalQuantity - a.totalQuantity),
    [states, ctx],
  );

  const themeTotals = INVESTMENT_THEMES.map((theme) => ({
    theme,
    quantity: rows.reduce((sum, r) => sum + (r.quantity[theme.id] ?? 0), 0),
    cost: rows.reduce((sum, r) => sum + (r.cost[theme.id] ?? 0), 0),
  }));

  const grandQuantity = rows.reduce((sum, r) => sum + r.totalQuantity, 0);
  const grandCost = rows.reduce((sum, r) => sum + (r.totalCost ?? 0), 0);
  const anyPriced = grandCost > 0;

  // A figure resting on an invented rate is stamped wherever it appears, not
  // only on the page whose toggle switched the rates on. Someone who lands
  // here from a link has no way of knowing which mode the store is in.
  const showWarning = usesIllustrative(
    states.flatMap((s) => s.investments),
    ctx,
  );

  return (
    <div className="space-y-3">
      {showWarning && (
        <div
          role="note"
          className="flex items-start gap-2.5 border border-moderate bg-moderate-wash px-3.5 py-2.5"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-moderate" aria-hidden />
          <p className="text-[12.5px] text-foreground">
            <strong className="font-semibold">
              The naira column is illustrative, not NPHCDA rates.
            </strong>{' '}
            <span className="text-muted-foreground">
              Placeholder unit rates are switched on. Item counts are real; do not quote
              a cost from this view.
            </span>
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <caption className="sr-only">
            Investment items required per assessed state, split by thematic domain, with
            total items and total cost per state and per domain
          </caption>
          <thead>
            <tr className="mono text-[9.5px] uppercase tracking-[0.11em] text-muted-foreground">
              <th scope="col" className="w-8 border-b border-input py-2 pr-2 text-left font-normal" />
              <th scope="col" className="border-b border-input py-2 pr-3 text-left font-normal">
                State
              </th>
              {INVESTMENT_THEMES.map((theme) => (
                <th
                  key={theme.id}
                  scope="col"
                  className="border-b border-input py-2 pr-3 text-right font-normal"
                  title={theme.label}
                >
                  {theme.shortLabel}
                </th>
              ))}
              <th scope="col" className="border-b border-input py-2 pr-3 text-right font-normal">
                Total items
              </th>
              <th scope="col" className="border-b border-input py-2 pl-3 text-right font-normal">
                Total cost (₦)
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.state.id}
                className="group cursor-pointer border-b border-border transition-colors hover:bg-surface-sunk"
                onClick={() => onSelectState(row.state)}
              >
                <td className="mono py-2 pr-2 text-[10px] tabular-nums text-muted-foreground">
                  {i + 1}
                </td>
                <td className="py-2 pr-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectState(row.state);
                    }}
                    className="inline-flex items-center gap-1.5 text-left font-medium text-foreground group-hover:text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {row.state.name}
                    <ArrowRight
                      className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden
                    />
                  </button>
                  <p className="mono text-[10px] text-muted-foreground">
                    {formatCount(row.state.facilityCount)} facilities
                  </p>
                </td>
                {INVESTMENT_THEMES.map((theme) => {
                  const q = row.quantity[theme.id] ?? 0;
                  return (
                    <td
                      key={theme.id}
                      className={`mono py-2 pr-3 text-right tabular-nums ${
                        q ? 'text-foreground' : 'text-muted-foreground/50'
                      }`}
                    >
                      {q ? formatCount(q) : '—'}
                    </td>
                  );
                })}
                <td className="mono py-2 pr-3 text-right font-semibold tabular-nums text-foreground">
                  {formatCount(row.totalQuantity)}
                </td>
                <td className="mono py-2 pl-3 text-right tabular-nums">
                  {row.totalCost != null ? (
                    <span className="font-semibold text-foreground">
                      {formatNaira(row.totalCost, true)}
                    </span>
                  ) : (
                    <span className="text-[11px] italic text-muted-foreground">
                      Pending
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot className="mono text-[11px] uppercase tracking-[0.08em]">
            <tr className="text-muted-foreground">
              <td className="py-2 pr-2" />
              <td className="py-2 pr-3">
                {rows.length === 1 ? '1 state · items' : `${rows.length} states · items`}
              </td>
              {themeTotals.map(({ theme, quantity }) => (
                <td key={theme.id} className="py-2 pr-3 text-right tabular-nums text-foreground">
                  {quantity ? formatCount(quantity) : '—'}
                </td>
              ))}
              <td className="py-2 pr-3 text-right font-semibold tabular-nums text-foreground">
                {formatCount(grandQuantity)}
              </td>
              <td className="py-2 pl-3" />
            </tr>

            {/* Cost per domain sits on its own row rather than doubled up inside
                each cell — the two are different units and a reader scanning one
                of them should never have to step over the other. */}
            <tr className="border-t border-border text-muted-foreground">
              <td className="py-2 pr-2" />
              <td className="py-2 pr-3">Cost (₦)</td>
              {themeTotals.map(({ theme, cost }) => (
                <td key={theme.id} className="py-2 pr-3 text-right tabular-nums text-foreground">
                  {cost ? formatNaira(cost, true) : <span className="italic">Pending</span>}
                </td>
              ))}
              <td className="py-2 pr-3" />
              <td className="py-2 pl-3 text-right font-semibold tabular-nums text-foreground">
                {anyPriced ? formatNaira(grandCost, true) : <span className="italic">Pending</span>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
