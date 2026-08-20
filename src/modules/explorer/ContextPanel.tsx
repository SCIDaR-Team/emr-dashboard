import { ExternalLink, Info, TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BandBadge, BandIcon, MaturityMeter, Skeleton } from '@/components/ui';
import { useDataContext } from '@/state/dataContext';
import { cn } from '@/lib/cn';
import { BAND_ACTION, BAND_CLASSES, BAND_LABEL } from '@/lib/bands';
import { AGGREGATION_LABEL, formatMetric, ordinal, pctReady } from '@/lib/explorerCube';
import { formatCount, formatScore, percentOf, titleCaseName } from '@/lib/format';
import { describeThemeNode, type ThemeNodeDescription } from '@/lib/themes';
import { DistributionBar } from './DistributionBar';
import type { ExplorerData } from '@/hooks/useExplorerData';
import type { Aggregation, ExplorerCell, ThemeNodeId } from '@/lib/types';

interface ContextPanelProps {
  data: ExplorerData;
  theme: ThemeNodeId;
  aggregation: Aggregation;
  onSelectTheme: (theme: ThemeNodeId) => void;
}

/**
 * What the current (geography × theme) selection amounts to.
 *
 * Guide §8.2: score, band, n, distribution, rank among peers, and the five
 * themes side by side. The one rule running through all of it is that no figure
 * appears without the population it was computed from — `n` is on screen
 * whenever a score is, because "3.4 across 444 facilities" and "3.4 across 3"
 * are not the same claim and the difference does not survive being dropped.
 */
export function ContextPanel({
  data,
  theme,
  aggregation,
  onSelectTheme,
}: ContextPanelProps) {
  const { indicators } = useDataContext();
  const node = describeThemeNode(theme, indicators.data);
  const { cell, facility, peers } = data;
  const isFacility = facility != null;

  // At facility level the overall node holds the *archetype*, encoded as its
  // composite weight (1/3/5) so one band scale covers facilities and
  // aggregates alike (guide §8.3). That code is not a score and must not be
  // printed as one — the facility's own average domain score is.
  const overallAtFacility = isFacility && node.level === 'overall';
  const headlineValue = overallAtFacility
    ? facility.averageDomainScore
    : aggregation === 'pct_ready' && !isFacility
      ? pctReady(cell)
      : cell.score;

  const headlineLabel = overallAtFacility
    ? 'Average domain score'
    : isFacility
      ? 'Score'
      : aggregation === 'pct_ready'
        ? AGGREGATION_LABEL.pct_ready
        : node.level === 'overall'
          ? 'Composite readiness'
          : 'Mean score';

  const showsPercent = !overallAtFacility && !isFacility && aggregation === 'pct_ready';

  return (
    <section className="card divide-y divide-border" aria-label="Selection detail">
      {/* ---- Headline ------------------------------------------------- */}
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 p-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {node.path}
          </p>
          <h2 className="mt-0.5 truncate text-xl font-bold text-brand-700">
            {data.name}
          </h2>
          {node.question && (
            <p className="mt-1 max-w-prose text-xs text-muted-foreground">
              {node.question}
            </p>
          )}
          {node.level === 'indicator' && node.indicator && (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="rounded-full border border-border px-1.5 py-0.5 font-medium uppercase tracking-wide">
                {node.indicator.class === 'contextual'
                  ? 'Unweighted'
                  : `${node.indicator.class} indicator`}
              </span>
              {node.indicator.class === 'contextual' &&
                'Scored 1/3/5 but excluded from every theme mean — context, not readiness'}
            </p>
          )}
        </div>

        {data.isLoadingIndicators ? (
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <Skeleton className="h-12 w-28" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-12 w-24" />
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <Figure
              label={headlineLabel}
              value={
                showsPercent
                  ? formatMetric(headlineValue, 'pct_ready')
                  : `${formatScore(headlineValue, 2)}${headlineValue == null ? '' : '/5'}`
              }
            />
            <div>
              <FigureLabel>Readiness band</FigureLabel>
              <div className="mt-1">
                <BandBadge band={cell.band} />
              </div>
              {/* Only when the headline is a 1–5 score. Under the "% ready"
                  aggregation there is no score on screen to place on the
                  maturity ramp, and placing the percentage there would be a
                  different scale wearing the same five steps. */}
              {!showsPercent && (
                <div className="mt-2">
                  <MaturityMeter score={headlineValue} size="lg" />
                </div>
              )}
            </div>
            <Figure
              label={isFacility ? 'Facility' : 'Facilities assessed'}
              value={isFacility ? '1' : formatCount(cell.n)}
              sublabel={
                !isFacility && cell.scored !== cell.n
                  ? `${formatCount(cell.scored)} answered this question`
                  : undefined
              }
            />
          </div>
        )}
      </div>

      <CoverageNote cell={cell} level={node.level} loading={data.isLoadingIndicators} />

      {/* ---- Distribution and rank ------------------------------------ */}
      {!isFacility && !data.isLoadingIndicators && (
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div>
            <FigureLabel>
              Distribution across {formatCount(cell.scored)}{' '}
              {node.level === 'indicator' ? 'respondents' : 'facilities'}
            </FigureLabel>
            <DistributionBar cell={cell} className="mt-2" />
            {cell.band && (
              <p className="mt-3 text-xs text-muted-foreground">
                Band implies:{' '}
                <span className="font-medium text-foreground">
                  {BAND_ACTION[cell.band]}
                </span>
              </p>
            )}
          </div>
          <PeerRankCard data={data} aggregation={aggregation} />
        </div>
      )}

      {isFacility && (
        <FacilityFooter
          uuid={facility.uuid}
          lga={facility.lga}
          state={facility.state}
          isBHCPF={facility.isBHCPF}
          functionalityLevel={facility.functionalityLevel}
          peerLine={
            peers?.rank
              ? [
                  peers.rank.tiedWith > 0 ? 'Joint' : '',
                  `${ordinal(peers.rank.rank)} of ${formatCount(peers.rank.of)} facilities assessed in ${peers.within}`,
                  peers.rank.tiedWith > 0
                    ? `— level with ${formatCount(peers.rank.tiedWith)} of them on this selection`
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')
              : null
          }
        />
      )}

      {/* ---- Small multiples ------------------------------------------ */}
      <div className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <FigureLabel>All five thematic areas at this location</FigureLabel>
          <p className="text-xs text-muted-foreground">
            Click a theme to recolour the map by it
          </p>
        </div>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {data.themeCells.map(({ theme: t, cell: themeCell, available }) => {
            const isActive = theme === t.id || theme.startsWith(`${t.id}.`);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  disabled={!available}
                  onClick={() => onSelectTheme(t.id)}
                  aria-current={isActive ? 'true' : undefined}
                  title={
                    available
                      ? undefined
                      : 'Assessed at state level only — there is no facility instrument for this theme'
                  }
                  className={cn(
                    'h-full w-full rounded-lg border p-3 text-left transition-colors',
                    available
                      ? 'border-border hover:border-brand-500/60 hover:bg-brand-50'
                      : 'cursor-not-allowed border-dashed border-border bg-muted/40',
                    isActive && 'border-brand-500 bg-brand-50',
                  )}
                >
                  <p
                    className={cn(
                      'truncate text-xs font-medium',
                      available ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {t.shortLabel}
                  </p>

                  {available ? (
                    <>
                      <p
                        className={cn(
                          'mt-1 flex items-center gap-1 text-lg font-bold tabular-nums',
                          themeCell.band
                            ? BAND_CLASSES[themeCell.band].text
                            : 'text-muted-foreground',
                        )}
                      >
                        {/* The band's glyph, because the colour of this number
                            was the only thing saying which band it is — and a
                            score alone only reads as a band to someone who
                            knows the cut points by heart. */}
                        <BandIcon
                          band={themeCell.band}
                          className="h-3.5 w-3.5 shrink-0"
                          label={themeCell.band ? BAND_LABEL[themeCell.band] : undefined}
                        />
                        {formatScore(themeCell.score, 2)}
                        {themeCell.score != null && (
                          <span className="text-xs font-normal text-muted-foreground">
                            /5
                          </span>
                        )}
                      </p>
                      <DistributionBar
                        cell={themeCell}
                        size="sm"
                        showLegend={false}
                        className="mt-2"
                      />
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {/* "100% ready" is a strange way to describe one
                            facility. At n=1 the share is just the band. */}
                        {!themeCell.scored
                          ? 'No data'
                          : themeCell.scored === 1
                            ? (themeCell.band ? BAND_LABEL[themeCell.band] : 'No data')
                            : `${percentOf(themeCell.distribution.ready, themeCell.scored)} ready`}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                      State level only — no facility instrument. Awaiting the
                      state assessment table (guide §17.1).
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * How much of the selected population actually answered this question.
 *
 * Only shown at the indicator level, because only there does coverage routinely
 * collapse. Several rubric questions sit behind skip patterns — "how long did
 * you run paper and the EMR in parallel" is put only to facilities that have an
 * EMR — so a national figure can be drawn from 158 facilities of 2,804. That
 * number is sound about its 158 respondents and badly wrong about Nigeria, and
 * nothing in a mean, a band or a distribution bar reveals which of the two it
 * is. The higher levels never need this: every facility carries all four theme
 * scores and all ten sub-theme scores.
 */
function CoverageNote({
  cell,
  level,
  loading,
}: {
  cell: ExplorerCell;
  level: ThemeNodeDescription['level'];
  loading: boolean;
}) {
  if (level !== 'indicator' || loading) return null;

  if (cell.n === 0) return null;

  if (cell.scored === 0) {
    return (
      <div className="flex items-start gap-2 bg-notready-wash px-5 py-3 text-sm">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-notready" aria-hidden />
        <p>
          <span className="font-medium">
            {cell.n === 1
              ? 'This facility did not answer this question.'
              : 'No facility here answered this question.'}
          </span>{' '}
          Nothing on this selection is a readiness finding — it is an absence of
          data. Pick another question, or step up to the sub-theme.
        </p>
      </div>
    );
  }

  if (cell.scored === cell.n) return null;

  const share = cell.scored / cell.n;
  return (
    <div
      className={cn(
        'flex items-start gap-2 px-5 py-3 text-sm',
        share < 0.5 ? 'bg-moderate-wash' : 'bg-muted/40',
      )}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <p>
        <span className="font-medium">
          {formatCount(cell.scored)} of {formatCount(cell.n)} facilities (
          {percentOf(cell.scored, cell.n)}) answered this question.
        </span>{' '}
        Every figure below describes those {formatCount(cell.scored)}
        {share < 0.5
          ? ' — a minority of the facilities in this selection. Most rubric questions with coverage this low sit behind a skip pattern in the instrument, so treat this as a finding about the respondents, not about the area.'
          : ', not the whole selection.'}
      </p>
    </div>
  );
}

function FigureLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

function Figure({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div>
      <FigureLabel>{label}</FigureLabel>
      <p className="mt-0.5 text-2xl font-bold tabular-nums text-brand-700">{value}</p>
      {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
    </div>
  );
}

/**
 * Rank among the sibling units at the same level.
 *
 * Against siblings, not the whole country: an LGA's useful comparison is the
 * other LGAs of its state. The rank is out of the *measured* peers, and the
 * unmeasured ones are counted separately rather than being ranked last —
 * "no data" and "worst" are different findings.
 */
function PeerRankCard({
  data,
  aggregation,
}: {
  data: ExplorerData;
  aggregation: Aggregation;
}) {
  const { peers, metric } = data;

  if (!peers) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <FigureLabel>Rank among peers</FigureLabel>
        <p className="mt-2 text-sm text-muted-foreground">
          Nigeria has no peer set — drill into a state to see it ranked against
          the other assessed states.
        </p>
      </div>
    );
  }

  // A peer set exists, but this unit has nothing to be placed by. Saying so is
  // the point: ranking it last would turn an absence of data into a finding.
  if (!peers.rank) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <FigureLabel>Rank among peers</FigureLabel>
        <p className="mt-2 text-sm text-muted-foreground">
          Not ranked — nothing here is measured on this selection, and an
          unmeasured unit is not a bottom-placed one.
          {peers.measured > 0 && (
            <>
              {' '}
              {formatCount(peers.measured)} of the{' '}
              {formatCount(peers.units.length)} {PEER_NOUN[peers.level]} in{' '}
              {peers.within} do carry a value.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-brand-50/60 p-4">
      <FigureLabel>Rank among peers</FigureLabel>
      <p className="mt-1 text-2xl font-bold text-brand-700">
        {peers.rank.tiedWith > 0 && (
          <span className="mr-1 text-sm font-medium">joint</span>
        )}
        {ordinal(peers.rank.rank)}
        <span className="ml-1 text-sm font-medium text-muted-foreground">
          of {formatCount(peers.rank.of)} {PEER_NOUN[peers.level]} in {peers.within}
        </span>
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">
        By {AGGREGATION_LABEL[aggregation].toLowerCase()} —{' '}
        <span className="font-medium tabular-nums text-foreground">
          {formatMetric(metric, aggregation)}
        </span>
        {peers.rank.tiedWith > 0 && (
          <>
            {' '}
            · level with {formatCount(peers.rank.tiedWith)} other
            {peers.rank.tiedWith === 1 ? '' : 's'} on exactly this value
          </>
        )}
        {peers.rank.unranked > 0 && (
          <>
            {' '}
            · {formatCount(peers.rank.unranked)} peer
            {peers.rank.unranked === 1 ? '' : 's'} unranked, having nothing
            measured on this selection
          </>
        )}
      </p>
    </div>
  );
}

const PEER_NOUN: Record<'state' | 'lga' | 'facility', string> = {
  state: 'states',
  lga: 'LGAs',
  facility: 'facilities',
};

/**
 * The facility leaf.
 *
 * Guide §8.3 is explicit that the explorer offers a link to the full Scorecard
 * rather than duplicating it, so this stays a handful of identifying attributes
 * and the link.
 */
function FacilityFooter({
  uuid,
  lga,
  state,
  isBHCPF,
  functionalityLevel,
  peerLine,
}: {
  uuid: string;
  lga: string;
  state: string;
  isBHCPF: boolean;
  functionalityLevel: string;
  peerLine: string | null;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="min-w-0 space-y-1.5">
        <ul className="flex flex-wrap items-center gap-2 text-xs">
          {[
            // The summary row carries the LGA as the ODK export spells it, in
            // caps.
            `${titleCaseName(lga)}, ${state}`,
            functionalityLevel,
            isBHCPF ? 'BHCPF' : 'Non-BHCPF',
          ].map((chip) => (
            <li
              key={chip}
              className="rounded-full border border-border px-2 py-0.5 text-muted-foreground"
            >
              {chip}
            </li>
          ))}
        </ul>
        {peerLine && <p className="text-xs text-muted-foreground">{peerLine}</p>}
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Minimum requirements, service points and the investment plan live on the
          Scorecard — this module does not duplicate them.
        </p>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/facilities/${uuid}`)}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-surface transition-colors hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Full Scorecard
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
