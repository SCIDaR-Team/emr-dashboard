import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, FileSpreadsheet, Table2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { BAND_LABEL } from '@/lib/bands';
import { ExportMenu } from '@/components/ui';
import {
  exportCSV,
  exportExcel,
  exportFilename,
  type ExportNote,
  type ExportRow,
} from '@/lib/export';
import { useFilterStore } from '@/store/filterStore';
import { formatCount, formatScore, percentOf } from '@/lib/format';
import type { Band, FacilitySummary } from '@/lib/types';

interface StateRow {
  state: string;
  total: number;
  averageScore: number | null;
  distribution: Record<Band, number>;
}

type SortKey = 'state' | 'total' | 'averageScore' | 'ready' | 'moderately_ready' | 'not_ready';

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
      distribution[f.archetype] += 1;
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
      <div className="flex justify-end">
        <ExportMenu groups={exportGroups} />
      </div>

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
                    {percentOf(row.distribution.ready, row.total)}
                  </span>
                </td>
                <td className="py-2.5 text-right tabular-nums text-moderate">
                  {formatCount(row.distribution.moderately_ready)}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {percentOf(row.distribution.moderately_ready, row.total)}
                  </span>
                </td>
                <td className="py-2.5 text-right tabular-nums text-notready">
                  {formatCount(row.distribution.not_ready)}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {percentOf(row.distribution.not_ready, row.total)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
