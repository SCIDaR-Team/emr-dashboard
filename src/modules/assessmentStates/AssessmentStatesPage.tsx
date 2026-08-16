import { Building2, CheckCircle2, CircleSlash, MinusCircle, MapPin } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiTile, SectionCard, EmptyState, LoadError, Skeleton } from '@/components/ui';
import { FilterBar } from '@/components/filters/FilterBar';
import { ArchetypeDonut } from '@/components/charts';
import { RankedStateTable } from './RankedStateTable';
import { useFilteredData } from '@/hooks/useFilteredData';
import { BAND_ACTION, BAND_LABEL } from '@/lib/bands';
import { COVERAGE } from '@/lib/constants';
import { formatCount, formatScore, percentOf } from '@/lib/format';

/**
 * Module 3 — Assessment States.
 *
 * The 12 primary states: coverage funnel, archetype split, per-state KPIs and
 * the itemised investment table.
 *
 * This module is fully computable from `ERA dataset_v4.xlsx` — only the
 * investment table waits on a cost table.
 */
export default function AssessmentStatesPage() {
  const { facilities, allFacilities, metrics, isLoading, isFiltered, error, retry } =
    useFilteredData();

  // Four different situations that used to reach the reader as one message.
  //   loaded            — render the page
  //   still arriving    — a skeleton, never a frame full of zeros
  //   failed            — say so, offer a retry, and do not call it "no data"
  //   loaded but empty  — the only one that is a finding, and it is about the
  //                       build rather than the assessment
  // `hasData` deliberately survives an error: useFetchJSON keeps the last good
  // value on failure so a transient blip does not blank a page someone is
  // reading, and throwing that away here would undo it. When both are true the
  // error rides above the figures as a staleness warning instead of replacing
  // them.
  const hasData = allFacilities.length > 0;

  return (
    <>
      <PageHeader
        title="Assessment States"
        subtitle={`Readiness across the ${COVERAGE.statesPrimary} physically visited states`}
      >
        <FilterBar
          facilities={allFacilities}
          show={['state', 'lga', 'archetype', 'level', 'search']}
        />
      </PageHeader>

      <div className="space-y-5 px-4 pb-8 sm:px-6 lg:space-y-6 lg:px-8">
        {error && (
          <LoadError
            what="the facility summary"
            error={error}
            onRetry={retry}
          />
        )}

        {isLoading && !hasData ? (
          <AssessmentSkeleton />
        ) : !hasData ? (
          // Only reachable when the fetch succeeded and returned nothing, which
          // really is a missing build rather than a missing network.
          !error && (
            <EmptyState
              title="No facility data in this build"
              message="public/data is present but holds no facilities. Run `npm run data:refresh` to regenerate it from ERA dataset_v4.xlsx."
            />
          )
        ) : (
          <>
        {isFiltered && (
          <p className="rounded-lg bg-moderate-wash px-4 py-2 text-sm text-foreground/80">
            Filters are active — every figure below reflects{' '}
            {formatCount(metrics.total)} of {formatCount(COVERAGE.facilitiesScored)}{' '}
            facilities.
          </p>
        )}

        {/* Coverage funnel */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            label="States covered"
            value={COVERAGE.statesPrimary}
            icon={<MapPin className="h-6 w-6" aria-hidden />}
          />
          <KpiTile
            label="Facilities covered"
            value={isLoading ? '—' : formatCount(metrics.total)}
            sublabel={`of ${formatCount(COVERAGE.facilitiesSampled)} sampled`}
            icon={<Building2 className="h-6 w-6" aria-hidden />}
          />
          <KpiTile
            label="Average domain score"
            value={`${formatScore(metrics.averageScore)}/5`}
            icon={<CheckCircle2 className="h-6 w-6" aria-hidden />}
          />
          <KpiTile
            label="Composite readiness"
            value={formatScore(metrics.compositeReadiness, 2)}
            sublabel="(5·ready + 3·moderate + 1·not ready) ÷ total"
            icon={<MinusCircle className="h-6 w-6" aria-hidden />}
          />
        </div>

        {/* Archetype split — the donut is the headline; the row beside it
            names the action each band implies, which is the point of the
            classification and should not live only in a legend key. */}
        <SectionCard
          title="Facility archetype split"
          subtitle="Every facility below falls into exactly one of these three"
        >
          <div className="flex flex-wrap items-center gap-8">
            <ArchetypeDonut
              distribution={metrics.distribution}
              ariaLabel={`Archetype split: ${formatCount(metrics.distribution.ready)} ready, ${formatCount(metrics.distribution.moderately_ready)} moderately ready, ${formatCount(metrics.distribution.not_ready)} not ready`}
            />
            <div className="grid flex-1 gap-3 sm:grid-cols-3">
              {(['ready', 'moderately_ready', 'not_ready'] as const).map((band) => {
                const count = metrics.distribution[band];
                const Icon =
                  band === 'ready'
                    ? CheckCircle2
                    : band === 'moderately_ready'
                      ? MinusCircle
                      : CircleSlash;
                return (
                  <div key={band} className="rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-brand-600" aria-hidden />
                      <p className="text-sm font-medium">{BAND_LABEL[band]}</p>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-brand-700">{formatCount(count)}</p>
                    <p className="text-xs text-muted-foreground">
                      {percentOf(count, metrics.total)} of facilities · {BAND_ACTION[band]}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Readiness by state"
          subtitle="Facilities assessed and archetype split per state — click a row to scope the page"
        >
          {facilities.length === 0 ? (
            // Distinct from the page-level empty state above: the data loaded
            // fine, the filters just exclude everything. Telling someone to
            // rebuild the ETL because they picked Rivers + Functional L2 sends
            // them a very long way from the Reset button they need.
            <EmptyState
              title="No facilities match the current filters"
              message="Widen or clear a filter above to bring facilities back into scope."
            />
          ) : (
            <RankedStateTable
              facilities={facilities}
              scopeNotes={[
                [
                  'Population',
                  isFiltered
                    ? `Filtered — ${formatCount(metrics.total)} of ${formatCount(COVERAGE.facilitiesScored)} assessed facilities match the active filters.`
                    : `All ${formatCount(metrics.total)} assessed facilities across the ${COVERAGE.statesPrimary} physically visited states.`,
                ],
              ]}
            />
          )}
        </SectionCard>

        <SectionCard
          title="Total investments required"
          subtitle="Itemised: quantity × unit cost"
        >
          <EmptyState
            title="Awaiting cost table"
            message="Item list and quantity derivation are specified; unit costs need sign-off. Guide §9.1 and §17.4."
          />
        </SectionCard>
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
 * and filter bar have already rendered from constants, so a second set of title
 * bars underneath them would be wrong. What this replaces is worse than
 * nothing: the KPI tiles rendered `—`, the donut fell to its grey "No data"
 * ring, and the three band cards each showed `0`, which reads as a finding that
 * no facility in Nigeria is ready.
 */
function AssessmentSkeleton() {
  return (
    <div role="status" aria-label="Loading assessment figures" className="space-y-5 lg:space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-96" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
