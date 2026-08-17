import { useMemo } from 'react';
import { CheckCircle2, CircleSlash, MinusCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Card,
  EmptyState,
  LoadError,
  MaturityBadge,
  MultiSelectDropdown,
  PageSkeleton,
  SectionCard,
} from '@/components/ui';
import { FilterBar } from '@/components/filters/FilterBar';
import { NigeriaChoropleth, MapLegend, type GeoDatum } from '@/components/map';
import { InvestmentTable, RoadmapMatrix } from '@/components/scorecard';
import { useDataContext } from '@/state/dataContext';
import { useFilterStore } from '@/store/filterStore';
import { aggregateAreaProfiles } from '@/lib/areaProfile';
import { BAND_LABEL } from '@/lib/bands';
import { COVERAGE } from '@/lib/constants';
import { formatCount, formatScore } from '@/lib/format';
import { THEMES } from '@/lib/themes';
import type { Band } from '@/lib/types';

const BAND_ORDER: Band[] = ['ready', 'moderately_ready', 'not_ready'];
const BAND_ICON: Record<Band, typeof CheckCircle2> = {
  ready: CheckCircle2,
  moderately_ready: MinusCircle,
  not_ready: CircleSlash,
};

/**
 * Module 2 — State Summary.
 *
 * Readiness across all 37 states: a national choropleth, five-domain scores
 * (the only module where Leadership & Governance appears), investment by
 * theme, and the 6-month roadmap. Real for what the data actually covers —
 * the 12 primary states plus a partial (4 of 14 rubric questions) Leadership
 * score for them — and explicit about what still isn't: any finding for the
 * 25 secondary states, and every cost figure (guide §17.1, §17.4).
 */
export default function StateSummaryPage() {
  const { states, national, facilities: facilitiesFetch } = useDataContext();
  const selectedStates = useFilterStore((s) => s.states);
  const bandFilter = useFilterStore((s) => s.archetypes);
  const setBandFilter = useFilterStore((s) => s.setArchetypes);

  const primaryStates = useMemo(
    () => states.data.filter((s) => s.evidenceGrade === 'primary'),
    [states.data],
  );

  // Both filters narrow the *same* population — every panel below reads off
  // this one list, so "State: Kano" and "Readiness: Ready" combine (AND, not
  // two independent views), and a combination that matches nothing shows
  // nothing rather than quietly falling back to the national figures.
  const visiblePrimaryStates = useMemo(() => {
    let visible = primaryStates;
    if (selectedStates.length) {
      visible = visible.filter((s) => selectedStates.includes(s.name));
    }
    if (bandFilter.length) {
      visible = visible.filter((s) => s.band && bandFilter.includes(s.band));
    }
    return visible;
  }, [primaryStates, selectedStates, bandFilter]);

  const scopeLabel =
    visiblePrimaryStates.length === primaryStates.length
      ? 'National'
      : visiblePrimaryStates.length === 1
        ? (visiblePrimaryStates[0]?.name ?? 'National')
        : visiblePrimaryStates.length === 0
          ? 'No states match'
          : `${visiblePrimaryStates.length} states`;

  const scope = useMemo(() => {
    if (visiblePrimaryStates.length === 0) return null;
    if (visiblePrimaryStates.length === primaryStates.length) return national.data;
    if (visiblePrimaryStates.length === 1) return visiblePrimaryStates[0];
    return aggregateAreaProfiles(visiblePrimaryStates);
  }, [visiblePrimaryStates, primaryStates.length, national.data]);

  const stateBandCounts: Record<Band, number> = { ready: 0, moderately_ready: 0, not_ready: 0 };
  for (const s of visiblePrimaryStates) if (s.band) stateBandCounts[s.band] += 1;

  // States filtered out of scope grey out on the map (band: null reads as
  // "no data", the same visual the secondary-evidence states already use for
  // "nothing to show here") — otherwise neither filter has any visible effect
  // beyond the KPI cards, which is exactly the "does this do anything?" bug.
  const visibleIds = new Set(visiblePrimaryStates.map((s) => s.id));
  const polygonData = useMemo<Record<string, GeoDatum>>(
    () =>
      Object.fromEntries(
        states.data.map((s) => [
          s.id,
          {
            band: s.evidenceGrade === 'primary' && !visibleIds.has(s.id) ? null : s.band,
            n: s.facilityCount,
            evidenceGrade: s.evidenceGrade,
            label: s.name,
          },
        ]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- visibleIds is derived fresh each render from visiblePrimaryStates
    [states.data, visiblePrimaryStates],
  );

  const isLoading = states.isLoading || national.isLoading || facilitiesFetch.isLoading;
  const hasError = states.error || national.error;

  // A dedicated readiness control, not FilterBar's shared 'archetype' one —
  // that one tallies *facilities* against each band, which is the wrong
  // number here: this page's Readiness filter narrows *states*, and showing
  // "Ready (110)" beside an option that will actually select from 0 states
  // is its own bug. Counts below are how many of the 12 primary states carry
  // each band, computed against the unfiltered 12 so they stay stable as the
  // State control narrows.
  const readinessOptions = BAND_ORDER.map((band) => ({
    key: band,
    label: BAND_LABEL[band],
    count: primaryStates.filter((s) => s.band === band).length,
  }));

  return (
    <>
      <PageHeader
        title="State Summary"
        subtitle={`Readiness across ${COVERAGE.statesTotal} states using state-level findings`}
      >
        <FilterBar facilities={facilitiesFetch.data} show={['state']} />
        <MultiSelectDropdown
          label="Readiness"
          className="w-48"
          groups={[{ label: 'Among the 12 states with facility-level findings', items: readinessOptions }]}
          selected={bandFilter}
          onChange={(next) => setBandFilter(next as Band[])}
          placeholder="All readiness levels"
        />
      </PageHeader>

      <div className="space-y-5 px-4 pb-8 sm:px-6 lg:space-y-6 lg:px-8">
        {hasError && (
          <LoadError what="the state summary" error={hasError} onRetry={states.refetch} />
        )}

        {isLoading && !scope ? (
          <PageSkeleton />
        ) : (
          <div className="grid gap-5 lg:gap-6 xl:grid-cols-2">
            <SectionCard
              title="Readiness by state"
              subtitle={`Among the ${COVERAGE.statesPrimary} states with facility-level findings`}
            >
              <div className="mb-5 grid gap-3 sm:grid-cols-3">
                {BAND_ORDER.map((band) => {
                  const Icon = BAND_ICON[band];
                  return (
                    <div key={band} className="card flex items-center gap-3 p-3">
                      <Icon className="h-5 w-5 shrink-0 text-brand-600" aria-hidden />
                      <div>
                        <p className="text-sm text-muted-foreground">{BAND_LABEL[band]}</p>
                        <p className="text-xl font-bold text-brand-700">
                          {formatCount(stateBandCounts[band])}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                +{COVERAGE.statesSecondary} states assessed by secondary desk review only — no
                facility-level readiness to classify. Shown on the map below, not counted above.
              </p>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_16rem]">
                <div className="space-y-3">
                  <NigeriaChoropleth
                    data={polygonData}
                    selectedId={visiblePrimaryStates.length === 1 ? (visiblePrimaryStates[0]?.id ?? null) : null}
                  />
                  <MapLegend showSecondary />
                </div>

                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {scopeLabel} average score
                  </p>
                  <p className="mt-1 text-2xl font-bold text-brand-700">
                    {formatScore(scope?.averageScore ?? null)}
                    <span className="text-sm font-medium text-muted-foreground">/5</span>
                  </p>
                  <MaturityBadge score={scope?.averageScore ?? null} size="sm" className="mt-1.5" />

                  <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Domain scores
                  </p>
                  <ul className="space-y-2.5">
                    {THEMES.map((theme) => {
                      const score = scope?.themeScores[theme.id] ?? null;
                      return (
                        <li key={theme.id} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-foreground">{theme.shortLabel}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-semibold tabular-nums text-brand-700">
                              {formatScore(score)}
                            </span>
                            <MaturityBadge score={score} size="sm" />
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Leadership & Governance covers only 4 of the rubric's 14 questions, for the
                    12 primary states (guide §17.1). Secondary states show no data throughout.
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Investments required"
              subtitle={
                visiblePrimaryStates.length === 0
                  ? 'No states match the current filters'
                  : scopeLabel === 'National'
                    ? 'Itemised across all 12 assessed states'
                    : `Itemised for ${scopeLabel}`
              }
            >
              {scope?.investments.length ? (
                <>
                  <div className="mb-5 space-y-3">
                    {THEMES.filter((t) => t.facilityLevel).map((theme) => {
                      const items = scope.investments.filter((i) => i.themeId === theme.id);
                      const quantity = items.reduce((sum, i) => sum + i.quantity, 0);
                      const max = Math.max(
                        1,
                        ...THEMES.filter((t) => t.facilityLevel).map((t) =>
                          scope.investments
                            .filter((i) => i.themeId === t.id)
                            .reduce((sum, i) => sum + i.quantity, 0),
                        ),
                      );
                      return (
                        <div key={theme.id}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="text-foreground">{theme.label}</span>
                            <span className="font-semibold text-brand-700">
                              {formatCount(quantity)} items
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-brand-600"
                              style={{ width: `${(quantity / max) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mb-5 rounded-lg border border-border p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Total investment items
                    </p>
                    <p className="mt-1 text-2xl font-bold text-brand-700">
                      {formatCount(scope.investments.reduce((sum, i) => sum + i.quantity, 0))}
                    </p>
                    <p className="text-xs italic text-muted-foreground">
                      Naira total pending a signed-off cost table (guide §9.1, §17.4)
                    </p>
                  </div>
                  <InvestmentTable items={scope.investments} />
                </>
              ) : visiblePrimaryStates.length === 0 ? (
                <EmptyState
                  title="No states match"
                  message="Widen or clear the State/Readiness filters above to bring states back into scope."
                />
              ) : scope ? (
                <EmptyState
                  title="No investment needed"
                  message="Every measured minimum requirement across this population is met."
                />
              ) : (
                <EmptyState title="Loading…" />
              )}
            </SectionCard>

            <Card className="xl:col-span-2">
              <h2 className="text-base font-semibold text-brand-700">Roadmap (6 month plan)</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Activity per month, by readiness archetype
                {scopeLabel === 'National' ? ' — all 12 assessed states' : ` — ${scopeLabel}`}.
              </p>
              <RoadmapMatrix
                distribution={scope?.archetypeDistribution ?? { ready: 0, moderately_ready: 0, not_ready: 0 }}
                className="mt-4"
              />
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
