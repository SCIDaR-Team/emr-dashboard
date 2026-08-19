import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { RankedStatesTable } from './RankedStatesTable';
import { CheckCircle2, CircleSlash, MinusCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  EmptyState,
  LoadError,
  MaturityBadge,
  MultiSelectDropdown,
  PageSkeleton,
  BandLegend,
  ScaleLegend,
  SectionCard,
} from '@/components/ui';
import { FilterBar } from '@/components/filters/FilterBar';
import { NigeriaChoropleth, type GeoDatum } from '@/components/map';
import { useDataContext } from '@/state/dataContext';
import { useFilterStore } from '@/store/filterStore';
import { aggregateAreaProfiles } from '@/lib/areaProfile';
import { BAND_LABEL } from '@/lib/bands';
import { COVERAGE } from '@/lib/constants';
import { RoadmapMatrix } from '@/components/scorecard';
import { buildShareMap } from '@/lib/scale';
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
  //
  // The fill is a *share*, not a band. Every one of the 12 assessed states
  // classifies to the same state-level band, so a band choropleth here paints
  // twelve identical polygons and encodes exactly one value — a lot of screen
  // for "twelve states are amber". Share-not-ready runs 21%-86% across the
  // same states, so the sequential ramp has something to say. See
  // `buildShareMap` and the note on `GeoDatum.step`.
  const visibleIds = new Set(visiblePrimaryStates.map((s) => s.id));
  const shareMap = useMemo(() => buildShareMap(states.data), [states.data]);
  const polygonData = useMemo<Record<string, GeoDatum>>(
    () =>
      Object.fromEntries(
        Object.entries(shareMap.data).map(([id, datum]) => [
          id,
          // Filtered-out states drop to the no-data treatment, so a filter has
          // a visible effect on the map and not just on the tiles above it.
          datum.evidenceGrade === 'primary' && !visibleIds.has(id)
            ? { ...datum, band: null, step: null, valueLabel: undefined }
            : datum,
        ]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- visibleIds is derived fresh each render from visiblePrimaryStates
    [shareMap, visiblePrimaryStates],
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
        title="National Coverage"
        subtitle={`All ${COVERAGE.statesTotal} states and how each was evidenced`}
      >
        {/* Readiness is passed through FilterBar's slot rather than rendered
            beside it: FilterBar owns the row, so a sibling control lands on a
            second line under the State dropdown. */}
        <FilterBar facilities={facilitiesFetch.data} show={['state']}>
          <MultiSelectDropdown
            label="Readiness"
            className="min-w-[9.5rem] flex-1 sm:w-48 sm:flex-none"
            groups={[{ label: 'Among the 12 states with facility-level findings', items: readinessOptions }]}
            selected={bandFilter}
            onChange={(next) => setBandFilter(next as Band[])}
            placeholder="All readiness levels"
          />
        </FilterBar>
      </PageHeader>

      <div className="space-y-4 p-4 sm:p-5">
        {hasError && (
          <LoadError what="the state summary" error={hasError} onRetry={states.refetch} />
        )}

        {isLoading && !scope ? (
          <PageSkeleton />
        ) : (
          // One column, not two: the map is the page's primary object and a
          // half-width card left it 500px wide with the domain scores squeezed
          // into 90px columns. Full width gives the map room and lets the score
          // strip beneath it actually run horizontally.
          <div className="space-y-5 lg:space-y-6">
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

              {/* Map first, at the card's full width, with the scores as a
                  horizontal strip beneath it — the 16rem column beside the map
                  was taking a third of the width off the one element on this
                  page that is read by shape rather than by number. */}
              <div className="space-y-4">
                {/* Capped and centred: the map keeps a fixed 1000:813 aspect,
                    so letting it fill a full-width card would make it ~1000px
                    tall and push everything else off the fold. */}
                <div className="mx-auto w-full max-w-3xl space-y-3">
                  <NigeriaChoropleth
                    data={polygonData}
                    selectedId={visiblePrimaryStates.length === 1 ? (visiblePrimaryStates[0]?.id ?? null) : null}
                  />
                  <ScaleLegend
                    lo={shareMap.lo}
                    hi={shareMap.hi}
                    format={(v) => `${Math.round(v)}%`}
                    caption="Share of facilities not ready"
                    note="The map carries a share, not a band: all 12 assessed states classify to the same state-level band, so a band map would paint twelve identical polygons. The 45° hatch is evidence grade — those 25 states were desk-reviewed and are counted in no average."
                  />
                </div>

                <div className="rounded-lg border border-border p-4">
                  {/* Stacked on a phone, side by side from `sm`: the maturity
                      pills ("Institutionalized") don't shrink, so the domain
                      columns can't go below ~140px without overflowing — hence
                      the column count climbing with the width rather than
                      sitting at five. */}
                  <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-6">
                    <div className="shrink-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {scopeLabel} average score
                      </p>
                      <div className="mt-1 flex items-center gap-2.5">
                        <p className="text-2xl font-bold text-brand-700">
                          {formatScore(scope?.averageScore ?? null)}
                          <span className="text-sm font-medium text-muted-foreground">/5</span>
                        </p>
                        <MaturityBadge score={scope?.averageScore ?? null} size="sm" />
                      </div>
                    </div>

                    <div className="hidden self-stretch border-l border-border sm:block" />

                    <div className="min-w-0 flex-1">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Domain scores
                      </p>
                      <ul className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        {THEMES.map((theme) => {
                          const score = scope?.themeScores[theme.id] ?? null;
                          return (
                            <li key={theme.id} className="min-w-0">
                              <p className="truncate text-xs text-muted-foreground" title={theme.label}>
                                {theme.shortLabel}
                              </p>
                              <p className="mt-0.5 text-lg font-semibold tabular-nums text-brand-700">
                                {formatScore(score)}
                              </p>
                              <MaturityBadge score={score} size="sm" className="mt-1" />
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="The 12 assessed states, ranked"
              subtitle="composition, not average, is what a rollout plan needs"
              action={<BandLegend />}
            >
              <RankedStatesTable states={states.data} national={national.data} />
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
                  {/* Bars and the total sit side by side now that the card is
                      full width — stacked, four bars stretched to 1200px read
                      as a chart with nothing to compare against. */}
                  <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
                    <div className="space-y-3">
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

                    <div className="rounded-lg border border-border p-4">
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
                  </div>
                  <p className="mono mt-4 border-t border-border pt-3 text-[10.5px] leading-relaxed text-muted-foreground">
                    Unit and total costs, per-domain subtotals and the full{' '}
                    {scope.investments.length}-action schedule live on the{' '}
                    <Link to="/investment" className="text-brand-500 hover:text-brand-600">
                      Investment Plan
                    </Link>{' '}
                    page.
                  </p>
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

            <SectionCard
              title="Roadmap · 6-month plan"
              subtitle={
                scopeLabel === 'National'
                  ? 'what each readiness band does, month by month — all 12 assessed states'
                  : `what each readiness band does, month by month — ${scopeLabel}`
              }
            >
              <RoadmapMatrix
                distribution={
                  scope?.archetypeDistribution ?? {
                    ready: 0,
                    moderately_ready: 0,
                    not_ready: 0,
                  }
                }
              />
              <p className="mono mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
                Activities are the assessment&rsquo;s fixed 6-month plan; cost per cell awaits
                the same signed-off cost table as every other investment figure
                (guide §9.2, §17.4).
              </p>
            </SectionCard>
          </div>
        )}
      </div>
    </>
  );
}
