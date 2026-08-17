import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  FileSpreadsheet,
  FlipHorizontal2,
  Layers3,
  Table2,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { BAND_LABEL } from '@/lib/bands';
import { StateReadinessBar, type BarOrientation } from '@/components/charts';
import { ExportMenu } from '@/components/ui';
import {
  exportCSV,
  exportExcel,
  exportFilename,
  type ExportNote,
  type ExportRow,
} from '@/lib/export';
import { useFilterStore } from '@/store/filterStore';
import { formatCount, formatScore, formatShare } from '@/lib/format';
import type { Band, FacilitySummary } from '@/lib/types';

interface StateRow {
  state: string;
  total: number;
  averageScore: number | null;
  distribution: Record<Band, number>;
}

type SortKey = 'state' | 'total' | 'averageScore' | 'ready' | 'moderately_ready' | 'not_ready';

/** The three ways this section can render the same rows. */
type View = 'table' | 'clustered' | 'stacked';

const VIEWS: { id: View; label: string; icon: typeof Table2 }[] = [
  { id: 'table', label: 'Table', icon: Table2 },
  // Stacked first: it is the closer reading of the table it replaces — one bar
  // per state, split the way the row is split. Clustered is the comparison view.
  { id: 'stacked', label: 'Stacked bars', icon: Layers3 },
  { id: 'clustered', label: 'Clustered bars', icon: BarChart3 },
];

function buildRows(facilities: FacilitySummary[]): StateRow[] {
  const byState = new Map<string, FacilitySummary[]>();
  for (const f of facilities) {
    const bucket = byState.get(f.state);
    if (bucket) bucket.push(f);
    else byState.set(f.state, [f]);
  }

  return [...byState.entries()].map(([state, rows]) => {
    const distribution: Record<Band, number> = { not_ready: 0, moderately_ready: 0, ready: 0 };
    let scoreSum = 0;
    let scoreCount = 0;
    for (const f of rows) {
      if (f.archetype) distribution[f.archetype] += 1;
      if (f.averageDomainScore != null) {
        scoreSum += f.averageDomainScore;
        scoreCount += 1;
      }
    }
    return {
      state,
      total: rows.length,
      averageScore: scoreCount ? scoreSum / scoreCount : null,
      distribution,
    };
  });
}

/**
 * Per-state facilities-assessed and archetype split, ranked.
 *
 * Operates on the already-filtered population, so a state/LGA/readiness
 * filter set elsewhere on the page narrows this table too rather than only
 * the KPI row above it. Clicking a row scopes the whole page to that state —
 * the same one-click drill the cascading location filter offers, just from
 * the table instead of a dropdown.
 *
 * Three views over one set of rows: the table, clustered bars (compare one
 * band across states) and stacked bars (compare the composition of a state).
 * Sort, selection and export are deliberately shared rather than duplicated
 * per view — the chart inherits the ranking the table's headers set, clicking
 * a bar scopes the page exactly as clicking a row does, and the export always
 * carries the same rows in the same order whichever view is on screen.
 */
export function RankedStateTable({
  facilities,
  scopeNotes = [],
}: {
  facilities: FacilitySummary[];
  /** What narrowed this population — carried into every export. */
  scopeNotes?: ExportNote[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [view, setView] = useState<View>('table');
  const [orientation, setOrientation] = useState<BarOrientation>('horizontal');
  const selectedStates = useFilterStore((s) => s.states);
  const setStates = useFilterStore((s) => s.setStates);

  const rows = useMemo(() => {
    const built = buildRows(facilities);
    const dir = sortDir === 'asc' ? 1 : -1;
    return built.sort((a, b) => {
      if (sortKey === 'state') return dir * a.state.localeCompare(b.state);
      if (sortKey === 'total') return dir * (a.total - b.total);
      if (sortKey === 'averageScore') {
        return dir * ((a.averageScore ?? 0) - (b.averageScore ?? 0));
      }
      return dir * (a.distribution[sortKey] - b.distribution[sortKey]);
    });
  }, [facilities, sortKey, sortDir]);

  const toggleState = (state: string) => {
    if (selectedStates.length === 1 && selectedStates[0] === state) setStates([]);
    else setStates([state]);
  };

  const sortBy = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (!rows.length) {
    return null;
  }

  const columns: { key: SortKey; label: string; align?: 'right' }[] = [
    { key: 'state', label: 'State' },
    { key: 'total', label: 'Facilities', align: 'right' },
    { key: 'averageScore', label: 'Avg. score', align: 'right' },
    { key: 'ready', label: BAND_LABEL.ready, align: 'right' },
    { key: 'moderately_ready', label: BAND_LABEL.moderately_ready, align: 'right' },
    { key: 'not_ready', label: BAND_LABEL.not_ready, align: 'right' },
  ];

  const sortedBy =
    `${columns.find((c) => c.key === sortKey)?.label ?? sortKey}` +
    (sortDir === 'asc' ? ' (ascending)' : ' (descending)');

  const exportRows = (): ExportRow[] =>
    rows.map((row, i) => ({
      Position: i + 1,
      State: row.state,
      'Sorted by': sortedBy,
      'Facilities assessed': row.total,
      'Average domain score':
        row.averageScore == null ? '' : Number(row.averageScore.toFixed(4)),
      'Ready (n)': row.distribution.ready,
      'Moderately ready (n)': row.distribution.moderately_ready,
      'Not ready (n)': row.distribution.not_ready,
      '% Ready': Number(((row.distribution.ready / row.total) * 100).toFixed(2)),
    }));

  const exportGroups = [
    {
      label: `${formatCount(rows.length)} states, as sorted`,
      actions: [
        {
          id: 'csv',
          label: 'CSV',
          icon: Table2,
          run: () => exportCSV(exportFilename('emr-readiness-by-state'), exportRows()),
        },
        {
          id: 'xlsx',
          label: 'Excel workbook',
          icon: FileSpreadsheet,
          run: () =>
            exportExcel(exportFilename('emr-readiness-by-state'), exportRows(), {
              sheet: 'By state',
              notes: [['Sorted by', sortedBy], ...scopeNotes],
            }),
        },
      ],
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* A group of `aria-pressed` buttons rather than a radiogroup: these
            switch how the section is drawn, they do not set a value on a form. */}
        <div
          role="group"
          aria-label="Readiness by state view"
          className="inline-flex rounded-lg border border-border p-0.5"
        >
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={view === id}
              title={label}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                view === id
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* The chart has no column headers to click, so the sort the table
              exposes through them needs its own control in the other two
              views — otherwise switching to a chart silently freezes the
              ranking wherever the table last left it. */}
          {view !== 'table' && (
            <button
              type="button"
              onClick={() =>
                setOrientation((o) => (o === 'horizontal' ? 'vertical' : 'horizontal'))
              }
              aria-pressed={orientation === 'vertical'}
              title={
                orientation === 'horizontal'
                  ? 'Switch to states along the bottom'
                  : 'Switch to states down the side'
              }
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                orientation === 'vertical'
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <FlipHorizontal2 className="h-3.5 w-3.5" aria-hidden />
              Swap axes
            </button>
          )}

          {view !== 'table' && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Sort by
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {columns.map((col) => (
                  <option key={col.key} value={col.key}>
                    {col.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                aria-label={`Sort ${sortDir === 'asc' ? 'descending' : 'ascending'}`}
                className="rounded-md border border-border p-1 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {sortDir === 'asc' ? (
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            </label>
          )}
          <ExportMenu groups={exportGroups} />
        </div>
      </div>

      {view !== 'table' ? (
        <StateReadinessBar
          rows={rows}
          mode={view}
          orientation={orientation}
          selectedState={selectedStates.length === 1 ? selectedStates[0] : null}
          onSelectState={toggleState}
        />
      ) : (
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn('py-2 font-semibold', col.align === 'right' ? 'text-right' : 'text-left')}
              >
                <button
                  type="button"
                  onClick={() => sortBy(col.key)}
                  className={cn(
                    'inline-flex items-center gap-1 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    col.align === 'right' && 'flex-row-reverse',
                  )}
                >
                  {col.label}
                  {sortKey === col.key &&
                    (sortDir === 'asc' ? (
                      <ArrowUp className="h-3 w-3" aria-hidden />
                    ) : (
                      <ArrowDown className="h-3 w-3" aria-hidden />
                    ))}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const isSelected = selectedStates.length === 1 && selectedStates[0] === row.state;
            return (
              <tr
                key={row.state}
                onClick={() => toggleState(row.state)}
                // `aria-current`, not `aria-selected` — see RankedTable.
                aria-current={isSelected ? 'true' : undefined}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-brand-50/60',
                  isSelected && 'bg-brand-50',
                )}
              >
                <td className="py-2.5 font-medium text-foreground">
                  {/* The real control. A row-level onClick alone cannot be
                      reached from a keyboard — see RankedTable. */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleState(row.state);
                    }}
                    aria-pressed={isSelected}
                    className="text-left font-medium text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {row.state}
                  </button>
                </td>
                <td className="py-2.5 text-right tabular-nums">{formatCount(row.total)}</td>
                <td className="py-2.5 text-right tabular-nums">
                  {formatScore(row.averageScore)}
                </td>
                <td className="py-2.5 text-right tabular-nums text-ready">
                  {formatCount(row.distribution.ready)}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {formatShare(row.distribution.ready, row.total)}
                  </span>
                </td>
                <td className="py-2.5 text-right tabular-nums text-moderate">
                  {formatCount(row.distribution.moderately_ready)}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {formatShare(row.distribution.moderately_ready, row.total)}
                  </span>
                </td>
                <td className="py-2.5 text-right tabular-nums text-notready">
                  {formatCount(row.distribution.not_ready)}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {formatShare(row.distribution.not_ready, row.total)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      )}
    </div>
  );
}
