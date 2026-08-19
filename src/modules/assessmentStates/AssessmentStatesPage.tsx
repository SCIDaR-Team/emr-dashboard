import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
import { useScopeFromNavigation } from '@/app/scopeNavigation';
import { useFilteredData } from '@/hooks/useFilteredData';
import { BAND_ACTION, BAND_LABEL } from '@/lib/bands';
import { cn } from '@/lib/cn';
import { COVERAGE } from '@/lib/constants';
import { formatCount, formatScore, percentOf } from '@/lib/format';
import { SUB_THEMES_BY_THEME, THEMES, THEME_BY_ID } from '@/lib/themes';
import type { Band, FacilityThemeId } from '@/lib/types';

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
  const navigate = useNavigate();
  const selectedStates = useFilterStore((s) => s.states);
  const setStates = useFilterStore((s) => s.setStates);

  // Arriving from a state on the National Coverage map, ranked table or wave
  // chips scopes this page to that state.
  useScopeFromNavigation();

  // Which domain the sub-domain card is broken down by. Technical
  // Infrastructure by default: it is the widest domain (7 sub-themes) and the
  // one the assessment's headline finding is about.
  const [breakdownTheme, setBreakdownTheme] = useState<FacilityThemeId>(
    'technical_infrastructure',
  );

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
        // Always present, not only after arriving from the map: this page sits
        // one level below National Coverage whichever way the user got here, and
        // a back control that appears conditionally reads as a browser artefact
        // rather than as a hierarchy. Clearing the scope on the way out matters
        // — National Coverage is national, and a state carried into it would be
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

            {/* Moved up from the band-split card that used to sit below, when
                that slot became the sub-domain breakdown. It belongs with the
                three tiles it is about: the counts alone invite reading the two
                lower bands as degrees of one problem, which is the single most
                expensive misreading available on this page. */}
            <div className="border-l-2 border-brand-500 pl-4">
              <p className="mono mb-1 text-[10px] uppercase tracking-[0.12em] text-brand-500">
                What the split means
              </p>
              <p className="max-w-[92ch] text-[13px] text-muted-foreground">
                The two lower bands are not the same problem.{' '}
                <strong className="font-semibold text-foreground">Moderately ready</strong>{' '}
                facilities need targeted fixes against named minimum requirements;{' '}
                <strong className="font-semibold text-foreground">Not ready</strong>{' '}
                facilities are blocked by a core domain and need foundational build first —
                no amount of training moves them.
              </p>
            </div>

            {isFiltered && (
              <p className="mono border border-moderate bg-moderate-wash px-3.5 py-2 text-[11px] text-foreground">
                Filters are active — every figure below reflects{' '}
                {formatCount(metrics.total)} of {formatCount(COVERAGE.facilitiesScored)}{' '}
                facilities.
              </p>
            )}

            {/* Held to one height (grid `stretch`), with each body a flex column
                whose closing note is pushed down by `mt-auto`. The row counts
                never match — five domains on the left against three to seven
                sub-themes on the right, changing with the selection — so left to
                themselves one card always ends short of the other, and the card
                would resize under the reader every time they switched domain. */}
            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard
                title="Domain scores"
                subtitle={scopeLabel}
                className="flex flex-col"
                bodyClassName="flex flex-1 flex-col"
              >
                {/* Each domain is also the control for the card beside it —
                    selecting one here breaks it down there. Leadership is the
                    exception and is deliberately inert rather than hidden: it
                    is a real domain with a real score, it simply has no
                    facility-level sub-themes to open. */}
                <div className="space-y-2.5">
                  {THEMES.map((theme) => {
                    const value = theme.facilityLevel
                      ? metrics.themeAverages[theme.id as FacilityThemeId]
                      : leadership;

                    if (!theme.facilityLevel) {
                      return (
                        <div key={theme.id} className="px-2 py-1">
                          <ScoreRow
                            label={theme.label}
                            value={value}
                            reference={nationalMean}
                            maturity
                          />
                        </div>
                      );
                    }

                    const selected = breakdownTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setBreakdownTheme(theme.id as FacilityThemeId)}
                        className={cn(
                          'block w-full rounded-[3px] px-2 py-1 text-left transition-colors',
                          selected
                            ? 'bg-brand-50 ring-1 ring-inset ring-brand-500/40'
                            : 'hover:bg-surface-sunk',
                          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        )}
                      >
                        <ScoreRow
                          label={theme.label}
                          value={value}
                          reference={nationalMean}
                          maturity
                        />
                      </button>
                    );
                  })}
                </div>
                <ScoreAxis reference={nationalMean} />
                <p className="mono mt-auto pt-3 text-[10.5px] leading-relaxed text-muted-foreground">
                  Leadership &amp; Governance is scored once per state, so it does not vary
                  with an LGA or facility filter — it is the mean across the states in scope.
                </p>
              </SectionCard>

              {/* Sub-domain scores for one domain at a time.
                  Nineteen sub-themes will not read in one column, and showing
                  them all flat would bury the seven that make up the domain a
                  reader is actually looking at. So: one domain, chosen either
                  here or by clicking its row in Domain scores — same selection,
                  two ways in.

                  This slot used to carry the band split. Those three numbers are
                  the three tiles at the top of the page, so nothing was lost by
                  replacing them; the note that went with them moved up to sit
                  under the figures it explains. */}
              <SectionCard
                title="Sub-domain scores"
                subtitle={scopeLabel}
                className="flex flex-col"
                bodyClassName="flex flex-1 flex-col"
                action={
                  <select
                    aria-label="Break down by domain"
                    value={breakdownTheme}
                    onChange={(e) => setBreakdownTheme(e.target.value as FacilityThemeId)}
                    className="mono max-w-[13rem] rounded-[3px] border border-input bg-surface px-2 py-1 text-[11px] text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {THEMES.map((theme) => (
                      <option
                        key={theme.id}
                        value={theme.id}
                        // Present but unselectable: a domain that exists in the
                        // card beside this one must not vanish from the picker,
                        // or the two cards disagree about how many there are.
                        disabled={!theme.facilityLevel}
                      >
                        {theme.shortLabel}
                        {theme.facilityLevel ? '' : ' — state-scored, no sub-themes'}
                      </option>
                    ))}
                  </select>
                }
              >
                <p className="mono mb-3 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  {THEME_BY_ID[breakdownTheme].label} ·{' '}
                  {SUB_THEMES_BY_THEME[breakdownTheme].length} sub-themes
                </p>

                <div className="space-y-2.5">
                  {SUB_THEMES_BY_THEME[breakdownTheme].map((sub) => (
                    <ScoreRow
                      key={sub.id}
                      label={sub.shortLabel}
                      value={metrics.subThemeAverages[sub.id] ?? null}
                      reference={metrics.themeAverages[breakdownTheme]}
                    />
                  ))}
                </div>
                <ScoreAxis
                  reference={metrics.themeAverages[breakdownTheme]}
                  referenceLabel="domain mean"
                />

                <p className="mono mt-auto pt-3 text-[10.5px] leading-relaxed text-muted-foreground">
                  Each sub-theme is scored within itself, so these do not average to the
                  domain score above — the rule marks the domain mean for the same scope,
                  not the national one. Leadership &amp; Governance is absent by design: it
                  is assessed once per state and has no facility-level sub-themes.
                </p>
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
