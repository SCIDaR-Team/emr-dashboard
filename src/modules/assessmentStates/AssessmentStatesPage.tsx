import { useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  BandLegend,
  EmptyState,
  LoadError,
  ScoreAxis,
  ScoreRow,
  SectionCard,
  Skeleton,
  Tile,
  TileRow,
} from '@/components/ui';
import { FilterBar } from '@/components/filters/FilterBar';
import { RankedLgaTable } from './RankedLgaTable';
import { useDataContext } from '@/state/dataContext';
import { useFilterStore } from '@/store/filterStore';
import { useFilteredData } from '@/hooks/useFilteredData';
import { BAND_ACTION, BAND_CLASSES, BAND_LABEL } from '@/lib/bands';
import { cn } from '@/lib/cn';
import { COVERAGE } from '@/lib/constants';
import { formatCount, formatScore, percentOf } from '@/lib/format';
import { THEMES } from '@/lib/themes';
import type { Band } from '@/lib/types';

const BAND_ORDER: Band[] = ['ready', 'moderately_ready', 'not_ready'];

/**
 * Module 3 — Assessed States.
 *
 * The 12 states with primary facility data, down to LGA.
 *
 * Two things went from the previous version. The archetype donut, because its
 * three slices carried exactly the same three numbers as the three cards
 * printed beside it — two encodings of one fact, and the more expensive one
 * was the less readable. And the itemised investment table, which now lives on
 * the Investment Plan page where a budget is actually built.
 *
 * What replaced them is the thing this module was missing: the domain scores
 * for the scope in view, and an LGA ranking. A page about 12 states that never
 * showed the 305 LGAs underneath them was stopping one level short of where
 * the decisions get made.
 */
export default function AssessmentStatesPage() {
  const { facilities, allFacilities, metrics, isLoading, isFiltered, error, retry } =
    useFilteredData();
  const { states, national } = useDataContext();
  const selectedStates = useFilterStore((s) => s.states);

  const scopeLabel =
    selectedStates.length === 0
      ? `All ${COVERAGE.statesPrimary} assessed states`
      : selectedStates.length === 1
        ? selectedStates[0]
        : `${selectedStates.length} selected states`;

  /** Leadership is state-scored, so it has no facility-level average to take
   *  from `metrics`. Read it from the state profiles actually in scope. */
  const leadership = useMemo(() => {
    const inScope = states.data.filter(
      (s) =>
        s.evidenceGrade === 'primary' &&
        (selectedStates.length === 0 || selectedStates.includes(s.name)),
    );
    const values = inScope
      .map((s) => s.themeScores.leadership_governance)
      .filter((v): v is number => v != null);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }, [states.data, selectedStates]);

  const nationalMean = national.data?.averageScore ?? null;
  const lgaCount = useMemo(
    () => new Set(facilities.map((f) => `${f.stateId}.${f.lgaId}`)).size,
    [facilities],
  );

  const hasData = allFacilities.length > 0;

  return (
    <>
      <PageHeader
        title="Assessed States"
        subtitle={`The ${COVERAGE.statesPrimary} states visited, down to LGA`}
      >
        <FilterBar
          facilities={allFacilities}
          show={['state', 'lga', 'archetype', 'level', 'search']}
        />
      </PageHeader>

      <div className="space-y-4 p-4 sm:p-5">
        {error && <LoadError what="the facility summary" error={error} onRetry={retry} />}

        {isLoading && !hasData ? (
          <AssessmentSkeleton />
        ) : !hasData ? (
          !error && (
            <EmptyState
              title="No facility data in this build"
              message="public/data is present but holds no facilities. Run `npm run data:refresh` to regenerate it from ERA dataset_v4.xlsx."
            />
          )
        ) : (
          <>
            <TileRow className="sm:grid-cols-2 xl:grid-cols-4">
              <Tile
                label="Scope"
                value={<span className="text-[19px]">{scopeLabel}</span>}
                note={`${formatCount(metrics.total)} facilities · ${formatCount(lgaCount)} LGAs`}
              />
              {BAND_ORDER.map((band) => (
                <Tile
                  key={band}
                  band={band}
                  label={BAND_LABEL[band]}
                  value={formatCount(metrics.distribution[band])}
                  suffix={percentOf(metrics.distribution[band], metrics.total, 1)}
                  note={BAND_ACTION[band]}
                />
              ))}
            </TileRow>

            {isFiltered && (
              <p className="mono border border-moderate bg-moderate-wash px-3.5 py-2 text-[11px] text-foreground">
                Filters are active — every figure below reflects{' '}
                {formatCount(metrics.total)} of {formatCount(COVERAGE.facilitiesScored)}{' '}
                facilities.
              </p>
            )}

            <div className="grid items-start gap-4 xl:grid-cols-2">
              <SectionCard title="Domain scores" subtitle={scopeLabel}>
                <div className="space-y-2.5">
                  {THEMES.map((theme) => (
                    <ScoreRow
                      key={theme.id}
                      label={theme.label}
                      value={
                        theme.facilityLevel
                          ? metrics.themeAverages[
                              theme.id as keyof typeof metrics.themeAverages
                            ]
                          : leadership
                      }
                      reference={nationalMean}
                      maturity
                    />
                  ))}
                </div>
                <ScoreAxis reference={nationalMean} />
                <p className="mono mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
                  Leadership &amp; Governance is scored once per state, so it does not vary
                  with an LGA or facility filter — it is the mean across the states in scope.
                </p>
              </SectionCard>

              <SectionCard
                title="How the facilities split"
                subtitle="every facility falls in exactly one band"
              >
                <div className="space-y-2.5">
                  {BAND_ORDER.map((band) => {
                    const n = metrics.distribution[band];
                    const pct = metrics.total ? (n / metrics.total) * 100 : 0;
                    return (
                      <div key={band}>
                        <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px] text-muted-foreground">
                          <span>{BAND_LABEL[band]}</span>
                          <span className="mono font-semibold text-foreground">
                            {formatCount(n)} · {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-[7px] rounded-[1px] bg-surface-sunk">
                          <span
                            className={cn(
                              'block h-full rounded-r-[3px]',
                              BAND_CLASSES[band].bg,
                              BAND_CLASSES[band].texture,
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 border-l-2 border-brand-500 pl-4">
                  <p className="mono mb-1 text-[10px] uppercase tracking-[0.12em] text-brand-500">
                    What the split means
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    The two lower bands are not the same problem.{' '}
                    <strong className="font-semibold text-foreground">Moderately ready</strong>{' '}
                    facilities need targeted fixes against named minimum requirements;{' '}
                    <strong className="font-semibold text-foreground">Not ready</strong>{' '}
                    facilities are blocked by a core domain and need foundational build
                    first — no amount of training moves them.
                  </p>
                </div>
              </SectionCard>
            </div>

            {facilities.length > 0 && (
              <SectionCard
                title="LGAs ranked"
                subtitle={`${formatCount(lgaCount)} LGAs in scope · by average domain score`}
                action={<BandLegend />}
                bodyClassName="p-0"
              >
                <RankedLgaTable facilities={facilities} />
              </SectionCard>
            )}

            <p className="mono text-[10.5px] text-muted-foreground">
              Investment for this scope is itemised and costed on the{' '}
              <a href="/investment" className="text-brand-500 hover:text-brand-600">
                Investment Plan
              </a>{' '}
              page. Average domain score {formatScore(metrics.averageScore, 2)} · composite
              readiness {formatScore(metrics.compositeReadiness, 2)}.
            </p>
          </>
        )}
      </div>
    </>
  );
}

/**
 * The page's own shape while the facility summary is in flight.
 *
 * `PageSkeleton` is the route-level fallback and does not fit here — the header
 * and filter bar have already rendered from constants. What this replaces is
 * worse than nothing: the tiles rendered `—` and the band figures each showed
 * `0`, which reads as a finding that no facility in Nigeria is ready.
 */
function AssessmentSkeleton() {
  return (
    <div role="status" aria-label="Loading assessment figures" className="space-y-4">
      <Skeleton className="h-24" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-96" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
