import { useMemo } from 'react';
import { AlertTriangle, ArrowLeft, Download, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import type { PageSection } from '@/components/layout/SectionTabs';
import {
  LoadError,
  PageSkeleton,
  SectionCard,
  Tile,
  TileRow,
} from '@/components/ui';
import { useDataContext } from '@/state/dataContext';
import { useFilterStore } from '@/store/filterStore';
import { useScopeFromNavigation } from '@/app/scopeNavigation';
import { useInvestmentRateStore } from '@/store/investmentRateStore';
import { aggregateAreaProfiles } from '@/lib/areaProfile';
import { cn } from '@/lib/cn';
import { formatCount, formatNaira, formatScore } from '@/lib/format';
import { THEMES, THEME_BY_ID } from '@/lib/themes';
import type { InvestmentItem, ThemeId } from '@/lib/types';
import {
  lineTotal,
  rateFor,
  unitOf,
  usesIllustrative,
  type RateContext,
} from './investmentRates';

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

/**
 * Module 5 — Investment Plan.
 *
 * The costed schedule used to be a slab at the bottom of State Summary, below
 * a map and a ranked table, where nobody building a budget would look for it.
 * It is its own destination now, with the two columns the old table never had:
 * unit cost and total cost.
 *
 * On the costs themselves, see `investmentRates.ts` — the source data has none,
 * so unit cost is an input and every total is honestly "pending" until real
 * rates exist. The placeholder rates are opt-in and loudly labelled.
 */
export default function InvestmentPlanPage() {
  const { national, states } = useDataContext();
  const navigate = useNavigate();
  const selectedStates = useFilterStore((s) => s.states);
  const setStates = useFilterStore((s) => s.setStates);

  // Arriving from a state row in National Coverage's investment table scopes
  // the whole costed plan to that state.
  useScopeFromNavigation();

  // Rates live in a store, not local state, so the cost column on National
  // Coverage and the schedule here are always quoting the same figures.
  const entered = useInvestmentRateStore((s) => s.entered);
  const illustrative = useInvestmentRateStore((s) => s.illustrative);
  const setEntered = useInvestmentRateStore((s) => s.setEntered);
  const clearEntered = useInvestmentRateStore((s) => s.clearEntered);
  const setIllustrative = useInvestmentRateStore((s) => s.setIllustrative);

  /**
   * The states in scope, if any. Arriving from a state row on National
   * Coverage scopes the whole plan to that state — the row was a question
   * about *that* state's bill, and answering it with the national schedule
   * would lose the question on the way over.
   */
  const scopedStates = useMemo(
    () =>
      states.data.filter(
        (s) => s.evidenceGrade === 'primary' && selectedStates.includes(s.name),
      ),
    [states.data, selectedStates],
  );

  const scopeLabel =
    scopedStates.length === 0
      ? null
      : scopedStates.length === 1
        ? scopedStates[0]!.name
        : `${scopedStates.length} states`;

  const profile = useMemo(() => {
    if (scopedStates.length === 0) return national.data;
    if (scopedStates.length === 1) return scopedStates[0]!;
    return aggregateAreaProfiles(scopedStates);
  }, [scopedStates, national.data]);

  const ctx: RateContext = useMemo(
    () => ({ entered, illustrative }),
    [entered, illustrative],
  );

  const items = useMemo(() => profile?.investments ?? [], [profile]);

  const totals = useMemo(() => computeTotals(items, ctx), [items, ctx]);
  const showWarning = usesIllustrative(items, ctx);

  const grouped = useMemo(() => {
    return THEMES.map((theme) => ({
      theme,
      rows: items
        .filter((i) => i.themeId === theme.id)
        .sort(
          (a, b) =>
            (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3) ||
            (b.quantity ?? 0) - (a.quantity ?? 0),
        ),
    })).filter((g) => g.rows.length);
  }, [items]);

  /**
   * The tab strip under the header.
   *
   * Derived from `grouped` rather than declared, so it lists the domains that
   * actually carry costed items and never offers a tab that scrolls to nothing.
   * Leadership & Governance is the standing case — it scores 2.21 nationally
   * and funds zero actions, which is the hole this page is about — but a state
   * scope can empty a domain the same way.
   *
   * "By domain" leads, because a domain tab drops the reader into the middle of
   * the schedule and the two summary cards above it are what that number came
   * from. Labels are the themes' own short forms: five full domain names do not
   * fit on one line at any width this app is read at.
   */
  const sections = useMemo<PageSection[]>(
    () => [
      { id: 'domains', label: 'By domain' },
      ...grouped.map(({ theme }) => ({
        id: `domain-${theme.id}`,
        label: theme.shortLabel,
      })),
    ],
    [grouped],
  );

  if (national.isLoading) return <PageSkeleton />;
  if (national.error) {
    return (
      <LoadError
        what="the investment schedule"
        error={national.error}
        onRetry={national.refetch}
      />
    );
  }
  if (!profile) return <LoadError what="the investment schedule" />;

  const highPriority = items.filter((i) => i.priority === 'high').length;

  // Leadership is the weakest domain nationally, but not in every state — Kano
  // is weaker on Technical Infrastructure. The claim is checked against the
  // scope in view rather than asserted, because the point of the note survives
  // without it: a domain with no costed line is a hole whatever it scores.
  const leadershipScore = profile.themeScores.leadership_governance;
  const leadershipIsWeakest =
    leadershipScore != null &&
    THEMES.every((t) => {
      const other = profile.themeScores[t.id];
      return t.id === 'leadership_governance' || other == null || other >= leadershipScore;
    });
  const notReady = profile.facilityCount - (profile.archetypeDistribution.ready ?? 0);

  return (
    <>
      <PageHeader
        title="Investment Plan"
        sections={sections}
        subtitle={
          scopeLabel
            ? `${scopeLabel} — itemised and costed`
            : 'What it will take, itemised and costed'
        }
        // The costed plan is reached both from the rail (nationally) and by
        // drilling a state row on National Coverage, so the way back up the
        // hierarchy is always present and always drops the scope with it —
        // National Coverage is national, and a state carried into it would be
        // an invisible filter on a page with no control to undo it.
        back={
          <button
            type="button"
            onClick={() => {
              setStates([]);
              navigate('/states');
            }}
            className="mono -ml-1 inline-flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden />
            National
          </button>
        }
        actions={
          <button
            type="button"
            className="mono inline-flex items-center gap-1.5 border border-input px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
          >
            <Download className="h-3 w-3" aria-hidden /> Export XLSX
          </button>
        }
      />

      <div className="space-y-4 p-4 sm:p-5">
        {/* The scope has no filter control on this page, so it says so itself
            and offers its own way out — otherwise a state-scoped schedule is
            indistinguishable from the national one at a glance. */}
        {scopeLabel && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Scoped to:</span>
            <button
              type="button"
              onClick={() => setStates([])}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600 transition-colors hover:border-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {scopedStates.map((s) => s.name).join(', ')}
              <X size={12} aria-hidden />
            </button>
            <span className="mono text-[10.5px] text-muted-foreground">
              clear to see the national plan
            </span>
          </div>
        )}

        {showWarning && (
          <div
            role="note"
            className="flex items-start gap-3 border border-moderate bg-moderate-wash px-3.5 py-3"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-moderate" aria-hidden />
            <div className="text-[12.5px] text-foreground">
              <strong className="font-semibold">
                These naira figures are illustrative placeholders, not NPHCDA rates.
              </strong>
              <p className="mt-0.5 text-muted-foreground">
                The assessment workbook publishes no cost table, so every unit cost in the
                source data is null. The rates below were invented to show the costed layout
                — do not quote any total from this view. Type over any cell to enter a real
                rate, or switch the placeholders off.
              </p>
            </div>
          </div>
        )}

        <TileRow className="sm:grid-cols-2 xl:grid-cols-4">
          <Tile
            label="Total costed items"
            value={formatCount(totals.quantity)}
            note={`${items.length} distinct actions`}
          />
          <Tile
            label="Facilities with at least one action"
            value={formatCount(notReady)}
            suffix={`of ${formatCount(profile.facilityCount)}`}
            note="Every non-ready facility"
          />
          <Tile
            label="High-priority actions"
            value={String(highPriority)}
            suffix={`of ${items.length}`}
            note="Blocking EMR deployment"
          />
          <Tile
            label={`Estimated total${showWarning ? ' · illustrative' : ''}`}
            value={totals.grand != null ? formatNaira(totals.grand, true) : '—'}
            note={
              totals.priced === 0
                ? 'Awaiting a signed-off cost table'
                : totals.priced < items.length
                  ? `${totals.priced} of ${items.length} actions priced`
                  : showWarning
                    ? 'From placeholder rates'
                    : 'From entered rates'
            }
          />
        </TileRow>

        {/* Held to one height (grid `stretch`), each body a flex column with its
            closing block pushed down by `mt-auto`. The two cards draw the same
            five domains but not the same trailing content — a note on one side,
            a caption or an empty-state prompt on the other — so their natural
            heights never match, and the cost card's "no rates yet" state is far
            shorter than the item bars beside it. */}
        {/* One section for the pair — they sit side by side from `xl`, and two
            tabs pointing at the same scroll offset are one tab too many. */}
        <div id="domains" data-section className="grid gap-4 xl:grid-cols-2">
          <SectionCard
            title="Items by domain"
            subtitle={`${formatCount(totals.quantity)} units across ${items.length} actions`}
            className="flex flex-col"
            bodyClassName="flex flex-1 flex-col"
          >
            <div className="space-y-2.5">
              {THEMES.map((theme) => {
                const q = totals.byTheme[theme.id]?.quantity ?? 0;
                return (
                  <div key={theme.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px]">
                      <span className={q ? 'text-muted-foreground' : 'text-muted-foreground/60'}>
                        {theme.label}
                      </span>
                      <span className="mono font-semibold text-foreground">
                        {q ? formatCount(q) : 'none'}
                      </span>
                    </div>
                    <div className="h-[7px] rounded-[1px] bg-surface-sunk">
                      <span
                        className={cn(
                          'block h-full rounded-r-[3px]',
                          q ? 'bg-score-3' : 'bg-nodata',
                        )}
                        style={{ width: `${q ? (q / totals.maxQuantity) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-auto border-l-2 border-brand-500 pl-4 pt-4">
              <p className="mono mb-1 text-[10px] uppercase tracking-[0.12em] text-brand-500">
                The hole in the plan
              </p>
              <p className="text-[13px] text-muted-foreground">
                <strong className="font-semibold text-foreground">
                  Leadership &amp; Governance carries zero costed items
                </strong>{' '}
                while scoring {formatScore(profile.themeScores.leadership_governance, 2)}
                {leadershipIsWeakest
                  ? ` — the weakest domain ${scopeLabel ? `in ${scopeLabel}` : 'nationally'}`
                  : ''}
                . It is measured at state level and the instrument only triggers actions at
                facility level, so it has no line to fund whatever it scores.
              </p>
            </div>
          </SectionCard>

          <SectionCard
            title="Cost by domain"
            subtitle={
              showWarning
                ? 'illustrative rates'
                : totals.priced
                  ? 'entered rates'
                  : 'awaiting rates'
            }
            className="flex flex-col"
            bodyClassName="flex flex-1 flex-col"
          >
            {totals.grand ? (
              <>
                <div className="space-y-2.5">
                  {THEMES.map((theme) => {
                    const cost = totals.byTheme[theme.id]?.cost ?? 0;
                    return (
                      <div key={theme.id}>
                        <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px]">
                          <span
                            className={cost ? 'text-muted-foreground' : 'text-muted-foreground/60'}
                          >
                            {theme.label}
                          </span>
                          <span className="mono font-semibold text-foreground">
                            {cost ? formatNaira(cost, true) : '—'}
                          </span>
                        </div>
                        <div className="h-[7px] rounded-[1px] bg-surface-sunk">
                          <span
                            className="block h-full rounded-r-[3px] bg-score-3"
                            style={{ width: `${(cost / totals.maxCost) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mono mt-auto pt-3 text-[10.5px] leading-relaxed text-muted-foreground">
                  Share of spend is not share of items — the heaviest unit rates sit on power
                  and devices, so Technical Infrastructure takes a larger slice of cost than
                  of volume.
                </p>
              </>
            ) : (
              // Centred in whatever height the card is held to, rather than
              // pinned to the top with the rest of the card empty beneath it.
              <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                <p className="text-sm font-semibold text-foreground">No rates entered yet</p>
                <p className="mx-auto mt-1.5 max-w-[42ch] text-[13px] text-muted-foreground">
                  The source data has no unit costs, so this panel has nothing to total. Enter
                  rates in the table below, or switch on the placeholder rates to see the
                  costed layout.
                </p>
                <button
                  type="button"
                  onClick={() => setIllustrative(true)}
                  className="mt-4 border border-brand-500 bg-brand-500 px-3 py-1.5 text-xs font-semibold text-surface transition-colors hover:bg-brand-600 hover:border-brand-600"
                >
                  Use illustrative rates
                </button>
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard
          title="Itemised schedule"
          subtitle={`${items.length} actions`}
          bodyClassName="p-0"
        >
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
            <span className="mono text-[9.5px] uppercase tracking-[0.11em] text-muted-foreground">
              Unit rates
            </span>
            <div className="flex border border-input">
              <button
                type="button"
                aria-pressed={!illustrative}
                onClick={() => setIllustrative(false)}
                className={cn(
                  'border-r border-input px-2.5 py-1 text-xs transition-colors',
                  !illustrative
                    ? 'bg-brand-50 font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                From your data
              </button>
              <button
                type="button"
                aria-pressed={illustrative}
                onClick={() => setIllustrative(true)}
                className={cn(
                  'px-2.5 py-1 text-xs transition-colors',
                  illustrative
                    ? 'bg-brand-50 font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Illustrative placeholders
              </button>
            </div>
            {Object.keys(entered).length > 0 && (
              <button
                type="button"
                onClick={clearEntered}
                className="mono text-[10px] uppercase tracking-[0.08em] text-brand-500 hover:text-brand-600"
              >
                Clear my entries ({Object.keys(entered).length})
              </button>
            )}
            <span className="mono ml-auto text-[10.5px] text-muted-foreground">
              Type in any unit-cost cell to price an action
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <caption className="sr-only">
                Investment actions with quantity, unit cost and total cost
              </caption>
              <thead>
                <tr className="mono text-[9.5px] uppercase tracking-[0.11em] text-muted-foreground">
                  <th scope="col" className="border-b border-input px-4 py-2 text-left font-normal">
                    Action
                  </th>
                  <th scope="col" className="border-b border-input py-2 pr-3 text-right font-normal">
                    Priority
                  </th>
                  <th scope="col" className="border-b border-input py-2 pr-3 text-right font-normal">
                    Facilities
                  </th>
                  <th scope="col" className="border-b border-input py-2 pr-3 text-right font-normal">
                    Quantity
                  </th>
                  <th scope="col" className="border-b border-input py-2 pr-3 text-right font-normal">
                    Unit
                  </th>
                  <th scope="col" className="border-b border-input py-2 pr-3 text-right font-normal">
                    Unit cost (₦)
                  </th>
                  <th scope="col" className="border-b border-input py-2 pr-4 text-right font-normal">
                    Total cost (₦)
                  </th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(({ theme, rows }) => {
                  const sub = totals.byTheme[theme.id];
                  return (
                    <DomainRows
                      key={theme.id}
                      themeId={theme.id}
                      anchorId={`domain-${theme.id}`}
                      rows={rows}
                      ctx={ctx}
                      subtotal={sub?.cost ?? 0}
                      pricedRows={sub?.priced ?? 0}
                      quantity={sub?.quantity ?? 0}
                      onRate={(id, value) =>
                        setEntered(
                          (() => {
                            const next = { ...entered };
                            if (value === '') delete next[id];
                            else next[id] = value;
                            return next;
                          })(),
                        )
                      }
                    />
                  );
                })}
                <tr className="border-t-2 border-brand-500 bg-brand-50 font-semibold">
                  <td className="px-4 py-2.5" colSpan={3}>
                    Grand total
                  </td>
                  <td className="mono py-2.5 pr-3 text-right">{formatCount(totals.quantity)}</td>
                  <td />
                  <td />
                  <td className="mono py-2.5 pr-4 text-right">
                    {totals.grand != null ? (
                      formatNaira(totals.grand)
                    ) : (
                      <span className="font-normal italic text-muted-foreground">pending</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mono border-t border-border px-4 py-3 text-[10.5px] leading-relaxed text-muted-foreground">
            {totals.priced > 0 && totals.priced < items.length
              ? '* Subtotal covers only the priced actions in that domain. '
              : ''}
            Quantity units differ by action — devices and fans are counted per unit, most
            others per facility, so the Unit column names what a rate buys.
          </p>
        </SectionCard>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function DomainRows({
  themeId,
  anchorId,
  rows,
  ctx,
  subtotal,
  pricedRows,
  quantity,
  onRate,
}: {
  themeId: ThemeId;
  /** Scroll target for the header's domain tabs. */
  anchorId: string;
  rows: InvestmentItem[];
  ctx: RateContext;
  subtotal: number;
  pricedRows: number;
  quantity: number;
  onRate: (id: string, value: string) => void;
}) {
  return (
    <>
      {/* The group's banner row is the anchor: it carries the domain's name and
          its totals, so landing on it puts the reader at the head of the block
          rather than at its first action. */}
      <tr id={anchorId} data-section className="bg-surface-sunk">
        <td colSpan={7} className="border-t border-input px-4 pb-1.5 pt-3 font-semibold">
          {THEME_BY_ID[themeId].label}{' '}
          <span className="mono text-[10.5px] font-normal text-muted-foreground">
            — {rows.length} actions · {formatCount(quantity)} units
          </span>
        </td>
      </tr>

      {rows.map((item) => {
        const rate = rateFor(item.id, ctx);
        const total = lineTotal(item, ctx);
        const typed = ctx.entered[item.id];
        const isPlaceholder = (typed == null || typed === '') && rate != null;

        return (
          <tr key={item.id} className="border-b border-border hover:bg-surface-sunk">
            <td className="px-4 py-2">{item.label}</td>
            <td className="py-2 pr-3 text-right">
              <span
                className={cn(
                  'mono border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em]',
                  item.priority === 'high'
                    ? 'border-notready text-notready'
                    : 'border-input text-muted-foreground',
                )}
              >
                {item.priority}
              </span>
            </td>
            <td className="mono py-2 pr-3 text-right text-xs">
              {formatCount(item.facilityCount ?? null)}
            </td>
            <td className="mono py-2 pr-3 text-right text-xs">{formatCount(item.quantity)}</td>
            <td className="mono py-2 pr-3 text-right text-[10px] text-muted-foreground">
              {unitOf(item.id)}
            </td>
            <td className="py-2 pr-3 text-right">
              <input
                type="text"
                inputMode="numeric"
                aria-label={`Unit cost for ${item.label}`}
                placeholder="not set"
                value={typed ?? (isPlaceholder ? String(rate) : '')}
                onChange={(e) => onRate(item.id, e.target.value.replace(/[^\d.]/g, ''))}
                className={cn(
                  'mono w-[104px] border bg-surface px-2 py-1 text-right text-xs text-foreground',
                  'placeholder:italic placeholder:text-muted-foreground',
                  'focus:border-brand-500 focus:outline-none',
                  isPlaceholder ? 'border-dashed border-input' : 'border-input',
                )}
              />
            </td>
            <td className="mono py-2 pr-4 text-right text-xs">
              {total != null ? (
                formatNaira(total)
              ) : (
                <span className="italic text-muted-foreground">pending</span>
              )}
            </td>
          </tr>
        );
      })}

      <tr className="bg-surface-sunk font-semibold">
        <td
          colSpan={6}
          className="mono border-t border-input py-2 pr-3 text-right text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground"
        >
          {THEME_BY_ID[themeId].label} subtotal
        </td>
        <td className="mono border-t border-input py-2 pr-4 text-right text-xs">
          {pricedRows ? (
            <>
              {formatNaira(subtotal)}
              {pricedRows < rows.length && ' *'}
            </>
          ) : (
            <span className="font-normal italic text-muted-foreground">pending</span>
          )}
        </td>
      </tr>
    </>
  );
}

// ---------------------------------------------------------------------------

interface ThemeTotals {
  quantity: number;
  cost: number;
  priced: number;
  rows: number;
}

function computeTotals(items: InvestmentItem[], ctx: RateContext) {
  const byTheme: Partial<Record<ThemeId, ThemeTotals>> = {};
  let quantity = 0;
  let grand = 0;
  let priced = 0;

  for (const item of items) {
    const bucket = (byTheme[item.themeId] ??= { quantity: 0, cost: 0, priced: 0, rows: 0 });
    bucket.rows += 1;
    bucket.quantity += item.quantity ?? 0;
    quantity += item.quantity ?? 0;

    const total = lineTotal(item, ctx);
    if (total != null) {
      bucket.cost += total;
      bucket.priced += 1;
      grand += total;
      priced += 1;
    }
  }

  return {
    byTheme,
    quantity,
    priced,
    grand: priced ? grand : null,
    maxQuantity: Math.max(1, ...Object.values(byTheme).map((t) => t?.quantity ?? 0)),
    maxCost: Math.max(1, ...Object.values(byTheme).map((t) => t?.cost ?? 0)),
  };
}
