import { useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, FileSpreadsheet, FileText, Table2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { BAND_LABEL, BANDS } from '@/lib/bands';
import { BandBadge, ExportMenu } from '@/components/ui';
import { AGGREGATION_LABEL, formatMetric } from '@/lib/explorerCube';
import {
  exportCSV,
  exportExcel,
  exportFilename,
  exportTablePDF,
  type ExportNote,
  type ExportRow,
} from '@/lib/export';
import { formatCount, percentOf } from '@/lib/format';
import { describeThemeNode } from '@/lib/themes';
import { useDataContext } from '@/state/dataContext';
import { DistributionBar } from './DistributionBar';
import type { ChildLevel, ExplorerUnit } from '@/hooks/useExplorerData';
import type { Aggregation, ThemeNodeId } from '@/lib/types';

type SortKey = 'name' | 'metric' | 'n' | 'ready' | 'moderately_ready' | 'not_ready';

const LEVEL_LABEL: Record<ChildLevel, string> = {
  state: 'State',
  lga: 'LGA',
  facility: 'Facility',
};

const LEVEL_PLURAL: Record<ChildLevel, string> = {
  state: 'states',
  lga: 'LGAs',
  facility: 'facilities',
};

interface RankedTableProps {
  units: ExplorerUnit[];
  level: ChildLevel;
  /** Geography and theme of the selection these rows belong to — used to name
   *  the export and to caption the table. */
  geographyName: string;
  theme: ThemeNodeId;
  aggregation: Aggregation;
  /** Drill into a child unit. Facilities are the leaf and select instead. */
  onSelect: (unit: ExplorerUnit) => void;
  /** Highlighted row — the facility currently selected, at the leaf level. */
  selectedGeoId?: string | null;
  /** Provenance the table cannot know on its own — chiefly whether a filter
   *  narrowed the population these rows were computed over. Supplied by the
   *  page, which holds the resolved selection. */
  scopeNotes?: ExportNote[];
}

/**
 * The child units of the current selection, ranked.
 *
 * Sorted by the active aggregation by default, so the table and the map agree
 * on what "top" means: switch to % Ready and the order changes, which is the
 * point of offering both (guide §8.3). Every row carries its own `n` and its
 * band split, because a one-facility LGA at 5.00 will otherwise sit above a
 * forty-facility LGA at 4.10 with nothing on screen to say why that is not a
 * finding.
 *
 * Clicking a row drills in — the same gesture as clicking the map, since a
 * reader who has found the LGA they want in a sorted list should not have to go
 * hunting for its polygon.
 */
export function RankedTable({
  units,
  level,
  geographyName,
  theme,
  aggregation,
  onSelect,
  selectedGeoId,
  scopeNotes = [],
}: RankedTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('metric');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { indicators } = useDataContext();
  const node = describeThemeNode(theme, indicators.data);
  const isFacilityLevel = level === 'facility';

  const rows = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const measured = (value: number | null) =>
      value != null && Number.isFinite(value) ? value : null;

    return [...units].sort((a, b) => {
      if (sortKey === 'name') return dir * a.name.localeCompare(b.name);

      const [va, vb] =
        sortKey === 'metric'
          ? [measured(a.metric), measured(b.metric)]
          : sortKey === 'n'
            ? [a.cell.n, b.cell.n]
            : [a.cell.distribution[sortKey], b.cell.distribution[sortKey]];

      // Unmeasured units sink in *either* direction. They are not the weakest
      // performers, they are absent from the comparison — and floating them to
      // the top of an ascending sort would read as "here are the worst".
      if (va == null && vb == null) return a.name.localeCompare(b.name);
      if (va == null) return 1;
      if (vb == null) return -1;
      return dir * (va - vb);
    });
  }, [units, sortKey, sortDir]);

  const rowsMean = useMemo(() => {
    const measured = rows
      .map((u) => u.metric)
      .filter((v): v is number => v != null && Number.isFinite(v));
    return measured.length
      ? measured.reduce((a, b) => a + b, 0) / measured.length
      : null;
  }, [rows]);

  const sortBy = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  /**
   * The rows on screen, in the order they are on screen.
   *
   * The position column is the row's place in the *current* sort, which the
   * reader may have changed away from the ranking metric. Calling it "Rank" and
   * leaving the sort unstated would invite "3rd" to be read as third best.
   */
  const sortedBy =
    (sortKey === 'name'
      ? LEVEL_LABEL[level]
      : sortKey === 'metric'
        ? AGGREGATION_LABEL[aggregation]
        : sortKey === 'n'
          ? 'Facilities assessed'
          : BAND_LABEL[sortKey]) + (sortDir === 'asc' ? ' (ascending)' : ' (descending)');

  /**
   * Including the geography, thematic node and aggregation as columns rather
   * than only in the filename: a CSV pasted into a deck is separated from its
   * filename immediately, and a column of scores with no record of which theme
   * they belong to is the easiest way for this data to be quoted wrongly.
   */
  const exportRows = (): ExportRow[] =>
    rows.map((u, i) => ({
      Position: i + 1,
      [LEVEL_LABEL[level]]: u.name,
      Geography: geographyName,
      'Thematic area': node.path,
      'Sorted by': sortedBy,
      // Both measures go out regardless of which is on screen — the position
      // column only makes sense next to the one it was taken on, and someone
      // re-sorting the file in Excel should not find the other missing.
      'Aggregation shown': AGGREGATION_LABEL[aggregation],
      'Mean score': u.cell.score == null ? '' : Number(u.cell.score.toFixed(4)),
      '% Ready':
        u.cell.scored === 0
          ? ''
          : Number(((u.cell.distribution.ready / u.cell.scored) * 100).toFixed(2)),
      'Readiness band': u.cell.band ? BAND_LABEL[u.cell.band] : 'No data',
      'Facilities assessed': u.cell.n,
      'Facilities scored': u.cell.scored,
      'Ready (n)': u.cell.distribution.ready,
      'Moderately ready (n)': u.cell.distribution.moderately_ready,
      'Not ready (n)': u.cell.distribution.not_ready,
      'Evidence grade': u.evidenceGrade,
    }));

  const baseName = () =>
    exportFilename('emr-explorer', geographyName, node.label, aggregation);

  const notes = (): ExportNote[] => [
    ['Geography', geographyName],
    ['Thematic area', node.path],
    ['Ranked by', AGGREGATION_LABEL[aggregation]],
    ['Sorted by', sortedBy],
    ...scopeNotes,
  ];

  /**
   * The PDF here is a *table*, not a picture of one. A 305-row LGA ranking
   * rasterised is several megabytes of unsearchable image that breaks across
   * pages mid-row; the columns are the whole content, so they are typeset.
   */
  const exportGroups = [
    {
      label: `${formatCount(rows.length)} rows, as sorted`,
      actions: [
        {
          id: 'csv',
          label: 'CSV',
          hint: 'Every column, for re-analysis. UTF-8 with a BOM, so Excel keeps ₦ and ≤.',
          icon: Table2,
          run: () => exportCSV(baseName(), exportRows()),
        },
        {
          id: 'xlsx',
          label: 'Excel workbook',
          hint: 'Same rows, sized columns and filters on, with the selection recorded on an About sheet.',
          icon: FileSpreadsheet,
          run: () =>
            exportExcel(baseName(), exportRows(), {
              sheet: node.label.slice(0, 31),
              notes: notes(),
            }),
        },
        {
          id: 'pdf',
          label: 'PDF table',
          hint: 'Typeset for circulation — selectable text, header repeated on every page.',
          icon: FileText,
          run: () =>
            exportTablePDF(baseName(), exportRows(), {
              title: `${node.label} — ${LEVEL_PLURAL[level]} of ${geographyName}`,
              subtitle: `Ranked by ${AGGREGATION_LABEL[aggregation].toLowerCase()}, sorted by ${sortedBy.toLowerCase()}.`,
              notes: scopeNotes,
            }),
        },
      ],
    },
  ];

  const columns: { key: SortKey; label: string; align?: 'right' }[] = [
    { key: 'name', label: LEVEL_LABEL[level] },
    {
      key: 'metric',
      label: aggregation === 'pct_ready' ? '% Ready' : 'Mean score',
      align: 'right',
    },
    ...(isFacilityLevel
      ? []
      : ([
          { key: 'n', label: 'Facilities', align: 'right' },
          { key: 'ready', label: BAND_LABEL.ready, align: 'right' },
          { key: 'moderately_ready', label: BAND_LABEL.moderately_ready, align: 'right' },
          { key: 'not_ready', label: BAND_LABEL.not_ready, align: 'right' },
        ] satisfies { key: SortKey; label: string; align?: 'right' }[])),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {formatCount(units.length)} {LEVEL_PLURAL[level]} in{' '}
          <span className="font-medium text-foreground">{geographyName}</span>,
          ranked by {AGGREGATION_LABEL[aggregation].toLowerCase()} on{' '}
          <span className="font-medium text-foreground">{node.label}</span>
          {isFacilityLevel ? '' : ' — click a row to drill in'}
        </p>
        <ExportMenu groups={exportGroups} />
      </div>

      <div className="max-h-[32rem] overflow-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">
            {LEVEL_PLURAL[level]} of {geographyName}, with {node.path} readiness
          </caption>
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="w-8 px-2 py-2 text-right font-semibold">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  className={cn(
                    'px-3 py-2 font-semibold',
                    col.align === 'right' ? 'text-right' : 'text-left',
                  )}
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
              {!isFacilityLevel && (
                /* The bar and the inline percentages below are the two things
                   in this table that restate rather than add — the counts are
                   already there, and the context panel above carries the split
                   at full size. They earn their space only on a wide screen,
                   and dropping them is what keeps the table off a horizontal
                   scrollbar at 1280. */
                <th
                  scope="col"
                  className="hidden px-3 py-2 text-left font-semibold 2xl:table-cell"
                >
                  Split
                </th>
              )}
              <th scope="col" className="w-7 px-2 py-2">
                <span className="sr-only">Drill in</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {rows.map((unit, i) => {
              const isSelected = unit.geoId === selectedGeoId;
              const isSecondary = unit.evidenceGrade === 'secondary';
              // A facility is not drillable — it is the leaf — but clicking it
              // still selects it. A secondary-evidence state is neither: the map
              // disables it with an explanation, and a row that navigated
              // somewhere the map refuses to would be the same view arrived at
              // two ways with two different answers.
              const clickable = unit.drillable || isFacilityLevel;
              return (
                <tr
                  key={unit.geoId}
                  onClick={clickable ? () => onSelect(unit) : undefined}
                  // `aria-current`, not `aria-selected`: these rows are not a
                  // selectable set, one of them is the place the reader is at.
                  aria-current={isSelected ? 'true' : undefined}
                  title={
                    clickable
                      ? undefined
                      : 'Desk review only — no facility-level detail to drill into'
                  }
                  className={cn(
                    'transition-colors',
                    clickable
                      ? 'cursor-pointer hover:bg-brand-50/60'
                      : 'cursor-not-allowed',
                    isSelected && 'bg-brand-50',
                    isSecondary && 'bg-muted/30',
                  )}
                >
                  <td className="px-2 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                    {i + 1}
                  </td>

                  <td className="max-w-[16rem] px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {/*
                        The drill lives on a real button inside the row, not on
                        the row's own click handler alone. A `<tr onClick>` is
                        unreachable by keyboard, and putting `role="button"` on
                        the row to fix that would destroy the table semantics a
                        screen-reader user navigates it with. The row stays
                        clickable as a convenience; this is the actual control.
                      */}
                      {clickable ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(unit);
                          }}
                          className="truncate text-left font-medium text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          {unit.name}
                        </button>
                      ) : (
                        <span className="truncate font-medium text-foreground">
                          {unit.name}
                        </span>
                      )}
                      {isSecondary && (
                        <span
                          className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground"
                          title="Secondary evidence — desk review only, no facility-level detail to aggregate"
                        >
                          Desk review
                        </span>
                      )}
                    </div>
                    {isFacilityLevel && unit.cell.band && (
                      <BandBadge band={unit.cell.band} size="sm" className="mt-1" />
                    )}
                  </td>

                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                    {formatMetric(unit.metric, aggregation)}
                  </td>

                  {!isFacilityLevel && (
                    <>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {formatCount(unit.cell.n)}
                      </td>
                      {BANDS.slice()
                        .reverse()
                        .map((band) => (
                          <td
                            key={band}
                            className="px-3 py-2.5 text-right tabular-nums text-muted-foreground"
                          >
                            {unit.cell.scored ? (
                              <>
                                {formatCount(unit.cell.distribution[band])}
                                <span className="ml-1 hidden text-xs 2xl:inline">
                                  {percentOf(
                                    unit.cell.distribution[band],
                                    unit.cell.scored,
                                  )}
                                </span>
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                        ))}
                      <td className="hidden w-32 px-3 py-2.5 2xl:table-cell">
                        <DistributionBar
                          cell={unit.cell}
                          size="sm"
                          showLegend={false}
                        />
                      </td>
                    </>
                  )}

                  <td className="px-2 py-2.5 text-right">
                    {clickable && (
                      <ArrowRight
                        className="h-3.5 w-3.5 text-muted-foreground"
                        aria-hidden
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {!isFacilityLevel && (
            <tfoot className="sticky bottom-0 border-t border-border bg-surface">
              <tr className="text-xs text-muted-foreground">
                <td />
                <td className="px-3 py-2 font-semibold uppercase tracking-wide">
                  Total
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {/* The unweighted mean of the rows above, which is *not* the
                      parent's score — that one is weighted by facility. A
                      one-facility LGA counts as much as a forty-facility one
                      here, so it is labelled as an average of rows rather than
                      presented as the total. */}
                  {formatMetric(rowsMean, aggregation)}
                  <span className="ml-1 font-normal">avg of rows</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCount(rows.reduce((sum, u) => sum + u.cell.n, 0))}
                </td>
                {BANDS.slice()
                  .reverse()
                  .map((band) => (
                    <td key={band} className="px-3 py-2 text-right tabular-nums">
                      {formatCount(
                        rows.reduce((sum, u) => sum + u.cell.distribution[band], 0),
                      )}
                    </td>
                  ))}
                <td className="hidden 2xl:table-cell" />
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
