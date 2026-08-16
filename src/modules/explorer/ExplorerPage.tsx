import { useRef } from 'react';
import { Database, FileImage, FileText, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, ExportMenu, LoadError, SectionCard } from '@/components/ui';
import { FilterBar } from '@/components/filters/FilterBar';
import { useExplorerSelection } from '@/hooks/useExplorerSelection';
import { useExplorerData } from '@/hooks/useExplorerData';
import { useFilteredData } from '@/hooks/useFilteredData';
import {
  exportElementToPDF,
  exportElementToPNG,
  exportFilename,
  type ExportNote,
} from '@/lib/export';
import { AGGREGATION_LABEL } from '@/lib/explorerCube';
import { formatCount } from '@/lib/format';
import { describeThemeNode } from '@/lib/themes';
import { useDataContext } from '@/state/dataContext';
import { ThematicTree } from './ThematicTree';
import { ThemePicker } from './ThemePicker';
import { ExplorerBreadcrumb } from './ExplorerBreadcrumb';
import { AggregationToggle } from './AggregationToggle';
import { ExplorerMap } from './ExplorerMap';
import { ContextPanel } from './ContextPanel';
import { RankedTable } from './RankedTable';

/**
 * Module 5 — Drill-Down Explorer.
 *
 * The other modules answer "how ready is this place?" one place at a time.
 * This one answers "where is readiness weak, and in what?" — two independent
 * axes that can be combined freely:
 *
 *   geographic   National → State → LGA → Facility   (the map)
 *   thematic     All → thematic area → sub-theme → indicator   (the left rail)
 *
 * Any combination is valid and reachable in one interaction per axis, which is
 * the whole point: "power-stabilisation readiness across the LGAs of Kano" is
 * two clicks, not a navigation sequence.
 *
 * Everything below the header reads one resolved selection from
 * `useExplorerData` — the map fills, the context panel and the ranked table are
 * three views of the same rows, which is what makes guide §8.3's "every number
 * on screen must reflect the filters" enforceable rather than aspirational.
 *
 * See build guide §8.
 */
export default function ExplorerPage() {
  const { selection, geoPath, update, drillTo, drillInto, reset } =
    useExplorerSelection();
  const {
    allFacilities,
    error: facilitiesError,
    retry: retryFacilities,
  } = useFilteredData();
  const { indicators, explorerCube } = useDataContext();
  const data = useExplorerData(geoPath, selection.theme, selection.aggregation);

  /**
   * Either of the two files this module is built from failing produces the same
   * screen as a genuinely empty selection: a grey map, "No data", an empty
   * table. Both are named because they fail for different reasons — the cube is
   * 6.7 MB and the first thing a truncated deploy loses.
   */
  const loadError = facilitiesError ?? explorerCube.error;
  const loadErrorWhat = facilitiesError
    ? 'the facility summary'
    : 'the assessment cube';
  const retryLoad = facilitiesError ? retryFacilities : explorerCube.refetch;
  // Nothing recoverable to show underneath: every figure on the page is derived
  // from these two, so rendering the module around a failure would put "0
  // facilities, No data" on screen as though it were the answer.
  const nothingLoaded = allFacilities.length === 0;

  const atDefault = geoPath.parts.length === 0 && selection.theme === 'overall';

  const node = describeThemeNode(selection.theme, indicators.data);
  const viewRef = useRef<HTMLDivElement>(null);

  /**
   * What narrowed these figures. Every export carries it, because the one thing
   * that cannot be recovered from a picture of a map is which population it was
   * drawn over — and a filtered map is visually identical to an unfiltered one.
   */
  const scopeNotes: ExportNote[] = data.isFiltered
    ? [
        [
          'Population',
          `Filtered — ${formatCount(data.populationShown)} of ${formatCount(data.populationTotal)} assessed facilities match the active filters. These figures do not equal the published national ones.`,
        ],
      ]
    : [
        [
          'Population',
          `All ${formatCount(data.populationTotal)} assessed facilities across 12 states — no filters active.`,
        ],
        [
          'Source',
          data.source === 'on_demand'
            ? 'Computed in the browser from the per-indicator score matrix.'
            : 'Read from the precomputed assessment cube.',
        ],
      ];

  const imageName = () =>
    exportFilename('emr-explorer', data.name, node.label, selection.aggregation);

  const imageTitle = `${node.path} — ${data.name}`;

  const captureTarget = () => {
    const el = viewRef.current;
    if (!el) throw new Error('The view is not ready to capture yet — try again.');
    return el;
  };

  const exportGroups = [
    {
      label: 'This view, as an image',
      actions: [
        {
          id: 'png',
          label: 'PNG image',
          hint: 'Map, headline figures and the five thematic areas — sized for a slide.',
          icon: FileImage,
          run: () =>
            exportElementToPNG(captureTarget(), imageName(), {
              // Burnt into the picture, not offered beside it: a screenshot is
              // separated from its caption the moment it is pasted.
              caption: [
                imageTitle,
                ...scopeNotes.map(([label, value]) => `${label}: ${value}`),
              ],
            }),
        },
        {
          id: 'pdf',
          label: 'PDF of this view',
          hint: 'The same capture on an A4 page, with the selection and population recorded in the header.',
          icon: FileText,
          run: () =>
            exportElementToPDF(captureTarget(), imageName(), {
              title: imageTitle,
              subtitle: `Ranked by ${AGGREGATION_LABEL[selection.aggregation].toLowerCase()}.`,
              notes: scopeNotes,
            }),
        },
      ],
    },
  ];

  return (
    <>
      <PageHeader
        title="Drill-Down Explorer"
        subtitle="Explore readiness by geography and thematic area, from national down to facility"
      >
        <div className="flex w-full flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <ExplorerBreadcrumb
            geoPath={geoPath}
            leafLabel={data.facility?.name}
            onNavigate={drillTo}
          />
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <AggregationToggle
              value={selection.aggregation}
              onChange={(aggregation) => update({ aggregation })}
            />
            {!atDefault && (
              <button
                type="button"
                onClick={reset}
                className="flex h-10 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-brand-500/50 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <RotateCcw size={14} aria-hidden />
                Reset view
              </button>
            )}
            <ExportMenu groups={exportGroups} label="Export view" />
          </div>
        </div>

        {/*
          The filter bar is on this page as of Phase 5 — the cube now recomputes
          client-side when a filter is active, so these controls move every
          figure on the page rather than being decoration over precomputed
          numbers. State and LGA dropdowns are deliberately absent: the map owns
          the geographic axis, and a second geography control that fought with
          the drill path would leave two answers to "where am I". One carried in
          from another module still surfaces as a clearable chip.
        */}
        <FilterBar
          facilities={allFacilities}
          show={['funding', 'level', 'geography', 'search']}
        />
      </PageHeader>

      <div className="grid gap-5 px-4 pb-8 sm:px-6 lg:grid-cols-[18rem_1fr] lg:gap-6 lg:px-8">
        {/* The rail is desktop-only; below `lg` the same tree lives behind
            `ThemePicker`, which explains the choice. */}
        <aside className="hidden lg:block">
          <ThematicTree
            selected={selection.theme}
            onSelect={(theme) => update({ theme })}
            geoLevel={geoPath.level}
          />
        </aside>

        <ThemePicker
          selected={selection.theme}
          node={node}
          onSelect={(theme) => update({ theme })}
          geoLevel={geoPath.level}
        />

        <div className="min-w-0 space-y-5 lg:space-y-6">
          {loadError && (
            <LoadError
              what={loadErrorWhat}
              error={loadError}
              onRetry={retryLoad}
            />
          )}

          {loadError && nothingLoaded ? null : (
            <>
          {/*
            The image export captures this wrapper, not the whole column. The
            ranked table below is a fixed-height scroll container, so a capture
            of it would show whichever twelve rows happened to be scrolled into
            view and silently drop the other 293 — and it has its own exports,
            which carry every row.
          */}
          <div ref={viewRef} className="space-y-5 lg:space-y-6">
            <ScopeBanner data={data} />

            <div className="card p-3 sm:p-5">
              <ExplorerMap
                geoPath={geoPath}
                data={data}
                onDrillInto={drillInto}
                onDrillUp={() => drillTo(Math.max(0, geoPath.parts.length - 1))}
              />
            </div>

            <ContextPanel
              data={data}
              theme={selection.theme}
              aggregation={selection.aggregation}
              onSelectTheme={(theme) => update({ theme })}
            />
          </div>

          <SectionCard
            title={
              data.unitLevel === 'facility'
                ? 'Facilities here'
                : `${data.unitLevel === 'state' ? 'States' : 'LGAs'} in ${data.name}`
            }
            subtitle="Ranked on the active aggregation — sortable, click-through and exportable"
          >
            {data.unitLevel && data.units.length > 0 ? (
              <RankedTable
                units={data.units}
                level={data.unitLevel}
                geographyName={
                  data.unitLevel === 'facility' && geoPath.level === 'facility'
                    ? // At the leaf the rows are the facility's siblings, so the
                      // table belongs to the parent LGA, not to the facility.
                      (data.peers?.within ?? data.name)
                    : data.name
                }
                theme={selection.theme}
                aggregation={selection.aggregation}
                selectedGeoId={
                  geoPath.level === 'facility' ? geoPath.parts.join('.') : null
                }
                scopeNotes={scopeNotes}
                onSelect={(unit) => drillInto(unit.childId)}
              />
            ) : (
              <EmptyState
                title="No child units to rank"
                message={
                  data.isFiltered
                    ? 'No facility here survives the active filters. Clear one to widen the population.'
                    : 'This geography has no units below it in the assessment data.'
                }
              />
            )}
          </SectionCard>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Where these numbers came from.
 *
 * Two things a reader cannot infer from the figures themselves: that a filter is
 * narrowing them, and that they were recomputed in the browser rather than read
 * from the published cube. Both change how the numbers should be quoted, so both
 * are stated.
 */
function ScopeBanner({
  data,
}: {
  data: ReturnType<typeof useExplorerData>;
}) {
  if (!data.isFiltered) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Database className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {data.source === 'on_demand'
          ? // The indicator level is never in the cube, so say where it did come
            // from rather than letting the previous sentence go quietly stale.
            `Computed from the per-indicator scores of ${formatCount(data.populationTotal)} facilities across 12 assessed states.`
          : `Published figures, read from the precomputed assessment cube — ${formatCount(data.populationTotal)} facilities across 12 assessed states.`}
      </p>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-lg bg-moderate-wash px-4 py-2.5 text-sm text-foreground/80">
      <SlidersHorizontal className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        <span className="font-medium">Filters are active.</span> Every figure on
        this page — map fills included — was recomputed over the{' '}
        {formatCount(data.populationShown)} of{' '}
        {formatCount(data.populationTotal)} facilities that match, and will not
        equal the published national figures.
      </p>
    </div>
  );
}
