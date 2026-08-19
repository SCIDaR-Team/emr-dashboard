import { useCallback, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RankedStatesTable } from './RankedStatesTable';
import { InvestmentByStateTable } from './InvestmentByStateTable';
import { RolloutWaves } from './RolloutWaves';
import { CheckCircle2, CircleSlash, MinusCircle, MousePointerClick } from 'lucide-react';
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
import { drillIntoState as navigateScoped } from '@/app/scopeNavigation';
import { aggregateAreaProfiles } from '@/lib/areaProfile';
import { BAND_LABEL } from '@/lib/bands';
import { COVERAGE } from '@/lib/constants';
import { buildShareMap } from '@/lib/scale';
import { formatCount, formatScore } from '@/lib/format';
import { THEMES } from '@/lib/themes';
import type { AreaProfile, Band } from '@/lib/types';

const BAND_ORDER: Band[] = ['ready', 'moderately_ready', 'not_ready'];
const BAND_ICON: Record<Band, typeof CheckCircle2> = {
  ready: CheckCircle2,
  moderately_ready: MinusCircle,
  not_ready: CircleSlash,
};

/**
 * Module 2 — National Coverage.
 *
 * Readiness across all 37 states: a national choropleth, five-domain scores
 * (the only module where Leadership & Governance appears), investment by state,
 * and the order the states should be worked in. Real for what the data actually
 * covers — the 12 primary states plus a partial (4 of 14 rubric questions)
 * Leadership score for them — and explicit about what still isn't: any finding
 * for the 25 secondary states, and every cost figure (guide §17.1, §17.4).
 *
 * Everything here reads at the national level, and the page is built so that it
 * cannot quietly stop doing so. There is no State filter: a single state's
 * detail is Assessed States' job, and the map is the way through to it. Scope is
 * cut by zone instead, which is a national way of slicing the country rather
 * than a way of leaving it.
 */
export default function StateSummaryPage() {
  const { states, national, facilities: facilitiesFetch } = useDataContext();
  const navigate = useNavigate();
  const zoneFilter = useFilterStore((s) => s.zones);
  const bandFilter = useFilterStore((s) => s.archetypes);
  const setBandFilter = useFilterStore((s) => s.setArchetypes);
  const setStates = useFilterStore((s) => s.setStates);

  // Filter state is global and persisted, so a state scope set on Assessed
  // States would otherwise follow the user here and silently narrow a page that
  // no longer has a control to undo it — the figures would read as national and
  // be one state's. Arriving here *is* the act of going back to national, so the
  // scope is dropped on the way in. (`setStates` clears LGAs with it.)
  useEffect(() => {
    if (useFilterStore.getState().states.length) setStates([]);
  }, [setStates]);

  /** Everything in the selected zones — assessed or desk-reviewed. */
  const scopedStates = useMemo(
    () =>
      zoneFilter.length
        ? states.data.filter((s) => s.zone && zoneFilter.includes(s.zone))
        : states.data,
    [states.data, zoneFilter],
  );

  const primaryStates = useMemo(
    () => scopedStates.filter((s) => s.evidenceGrade === 'primary'),
    [scopedStates],
  );

  // Both filters narrow the *same* population — every panel below reads off
  // this one list, so "Zone: North West" and "Readiness: Ready" combine (AND,
  // not two independent views), and a combination that matches nothing shows
  // nothing rather than quietly falling back to the national figures.
  const visiblePrimaryStates = useMemo(
    () =>
      bandFilter.length
        ? primaryStates.filter((s) => s.band && bandFilter.includes(s.band))
        : primaryStates,
    [primaryStates, bandFilter],
  );

  const allPrimaryCount = useMemo(
    () => states.data.filter((s) => s.evidenceGrade === 'primary').length,
    [states.data],
  );

  const zoneLabel =
    zoneFilter.length === 1 ? zoneFilter[0]! : `${zoneFilter.length} zones`;

  const scopeLabel =
    visiblePrimaryStates.length === 0
      ? 'No states match'
      : visiblePrimaryStates.length === allPrimaryCount
        ? 'National'
        : zoneFilter.length && !bandFilter.length
          ? zoneLabel
          : `${visiblePrimaryStates.length} states`;

  const scope = useMemo(() => {
    if (visiblePrimaryStates.length === 0) return null;
    if (visiblePrimaryStates.length === allPrimaryCount) return national.data;
    if (visiblePrimaryStates.length === 1) return visiblePrimaryStates[0];
    return aggregateAreaProfiles(visiblePrimaryStates);
  }, [visiblePrimaryStates, allPrimaryCount, national.data]);

  const stateBandCounts: Record<Band, number> = { ready: 0, moderately_ready: 0, not_ready: 0 };
  for (const s of visiblePrimaryStates) if (s.band) stateBandCounts[s.band] += 1;

  /**
   * Drill into one state.
   *
   * The state becomes the global scope and the user lands on the module that
   * answers the question they asked it from — Assessed States for readiness,
   * the Investment Plan for a bill. Both scope to the state and both carry a
   * way back up to this page.
   */
  // The scope rides along with the navigation and is applied by the page being
  // opened — see `scopeNavigation.ts` for why writing it here instead cancels
  // the route change.
  const drillInto = useCallback(
    (stateName: string, to: string) => navigateScoped(navigate, to, stateName),
    [navigate],
  );

  /** The map, the ranked table and the wave chips: readiness questions. */
  const drillIntoState = useCallback(
    (state: AreaProfile) => drillInto(state.name, '/assessment'),
    [drillInto],
  );

  /** The investment table: a costing question, so it lands on the costed
   *  schedule rather than on the readiness breakdown. */
  const drillIntoInvestment = useCallback(
    (state: AreaProfile) => drillInto(state.name, '/investment'),
    [drillInto],
  );

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
  const inZoneIds = new Set(scopedStates.map((s) => s.id));
  const shareMap = useMemo(() => buildShareMap(states.data), [states.data]);
  const polygonData = useMemo<Record<string, GeoDatum>>(
    () =>
      Object.fromEntries(
        Object.entries(shareMap.data).map(([id, datum]) => [
          id,
          // Filtered-out states drop to the no-data treatment, so a filter has
          // a visible effect on the map and not just on the tiles above it. A
          // zone filter drops the desk-review states outside it too — the zone
          // is a claim about the whole country, not just the assessed part.
          !inZoneIds.has(id) ||
          (datum.evidenceGrade === 'primary' && !visibleIds.has(id))
            ? { ...datum, band: null, step: null, valueLabel: undefined }
            : datum,
        ]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- visibleIds/inZoneIds are derived fresh each render
    [shareMap, visiblePrimaryStates, scopedStates],
  );

  const isLoading = states.isLoading || national.isLoading || facilitiesFetch.isLoading;
  const hasError = states.error || national.error;

  // A dedicated readiness control, not FilterBar's shared 'archetype' one —
  // that one tallies *facilities* against each band, which is the wrong
  // number here: this page's Readiness filter narrows *states*, and showing
  // "Ready (110)" beside an option that will actually select from 0 states
  // is its own bug. Counts below are how many of the 12 primary states carry
  // each band, computed against the unfiltered 12 so they stay stable as the
  // Zone control narrows.
  const readinessOptions = BAND_ORDER.map((band) => ({
    key: band,
    label: BAND_LABEL[band],
    count: states.data.filter((s) => s.evidenceGrade === 'primary' && s.band === band).length,
  }));

  return (
    <>
      <PageHeader
        title="National Coverage"
        subtitle={`All ${COVERAGE.statesTotal} states and how each was evidenced`}
      >
        {/* Zone, not State: this page is the national view, and a single state
            belongs to Assessed States. Readiness is passed through FilterBar's
            slot rather than rendered beside it — FilterBar owns the row, so a
            sibling control lands on a second line under the dropdown. */}
        <FilterBar facilities={facilitiesFetch.data} show={['zone']}>
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
                  {/* Above the map, not below it: an instruction read after the
                      reader has already given up on clicking is no instruction. */}
                  <div className="card flex items-center gap-2.5 px-3.5 py-2.5">
                    <MousePointerClick className="h-4 w-4 shrink-0 text-brand-500" aria-hidden />
                    <p className="text-[12.5px] text-foreground">
                      Click any highlighted state to drill into it.
                    </p>
                  </div>

                  <NigeriaChoropleth data={polygonData} onSelect={(id) => {
                    const state = states.data.find((s) => s.id === id);
                    if (state) drillInto(state.name, '/assessment');
                  }} />
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
              title={
                visiblePrimaryStates.length === allPrimaryCount
                  ? `The ${COVERAGE.statesPrimary} assessed states, ranked`
                  : `${visiblePrimaryStates.length} assessed states, ranked`
              }
              subtitle="composition, not average, is what a rollout plan needs"
              action={<BandLegend />}
            >
              <RankedStatesTable
                states={[
                  ...visiblePrimaryStates,
                  ...scopedStates.filter((s) => s.evidenceGrade === 'secondary'),
                ]}
                national={scope ?? null}
                onSelectState={drillIntoState}
              />
            </SectionCard>

            <SectionCard
              title="Investment required, by state"
              subtitle={
                visiblePrimaryStates.length === 0
                  ? 'No states match the current filters'
                  : 'ranked by total items — quantities are real, naira is not'
              }
            >
              {visiblePrimaryStates.length === 0 ? (
                <EmptyState
                  title="No states match"
                  message="Widen or clear the Zone/Readiness filters above to bring states back into scope."
                />
              ) : (
                <>
                  <InvestmentByStateTable
                    states={visiblePrimaryStates}
                    onSelectState={drillIntoInvestment}
                  />
                  <p className="mono mt-4 border-t border-border pt-3 text-[10.5px] leading-relaxed text-muted-foreground">
                    Item quantities are real — each one is an action a facility failed a
                    minimum requirement on. Naira is not: the assessment publishes no cost
                    table, so a cost reads &ldquo;pending&rdquo; until unit rates are entered
                    on the{' '}
                    <Link to="/investment" className="text-brand-500 hover:text-brand-600">
                      Investment Plan
                    </Link>{' '}
                    page, which is also where a state row opens its own itemised schedule
                    (guide §9.1, §17.4).
                  </p>
                </>
              )}
            </SectionCard>

            <SectionCard
              title="Rollout waves"
              subtitle={
                scopeLabel === 'National'
                  ? 'the order to work the 12 assessed states in'
                  : `the order to work these states in — ${scopeLabel}`
              }
            >
              {visiblePrimaryStates.length === 0 ? (
                <EmptyState
                  title="No states to sequence"
                  message="Widen or clear the Zone/Readiness filters above to bring states back into scope."
                />
              ) : (
                <>
                  <RolloutWaves
                    states={visiblePrimaryStates}
                    onSelectState={drillIntoState}
                  />
                  <p className="mono mt-4 border-t border-border pt-3 text-[10.5px] leading-relaxed text-muted-foreground">
                    Derived sequencing, not a signed-off schedule. The assessment specifies
                    one fixed 6-month activity plan per readiness band and no per-state
                    timetable; what separates these states is the composition of their
                    facilities, so the waves are cut on composite readiness. The activity
                    plan itself is on the{' '}
                    <Link to="/dashboard" className="text-brand-500 hover:text-brand-600">
                      Overview
                    </Link>
                    .
                  </p>
                </>
              )}
            </SectionCard>
          </div>
        )}
      </div>
    </>
  );
}
