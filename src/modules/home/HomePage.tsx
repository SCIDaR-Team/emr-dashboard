import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import type { PageSection } from '@/components/layout/SectionTabs';
import {
  LoadError,
  MaturityMeter,
  PageSkeleton,
  ScaleLegend,
  ScoreAxis,
  ScoreRow,
  ScoreTrack,
  SectionCard,
  Tile,
  TileRow,
} from '@/components/ui';
import { NigeriaChoropleth } from '@/components/map';
import { RoadmapMatrix } from '@/components/scorecard';
import { useDataContext } from '@/state/dataContext';
import { BAND_ACTION, BAND_LABEL, toBand } from '@/lib/bands';
import { formatCount, formatNaira, formatScore } from '@/lib/format';
import { buildShareMap } from '@/lib/scale';
import {
  lineTotal,
  usesIllustrative,
  type RateContext,
} from '@/modules/investment/investmentRates';
import { useInvestmentRateStore } from '@/store/investmentRateStore';

const score2 = (v: number | null | undefined) => formatScore(v, 2);
import { SUB_THEMES, THEMES, THEME_BY_ID } from '@/lib/themes';
import type { AreaProfile, Band, ThemeId } from '@/lib/types';

const BAND_ORDER: Band[] = ['ready', 'moderately_ready', 'not_ready'];

/** The tab strip under the header — this page's four bands, in reading order. */
const SECTIONS: PageSection[] = [
  { id: 'finding', label: 'The finding' },
  { id: 'gap', label: 'Where the gap is' },
  { id: 'where', label: 'Where & what it costs' },
  { id: 'roadmap', label: 'Roadmap' },
];

/** Themes with sub-themes to show. Leadership has none — it is scored once per
 *  state — so it gets its own strip rather than a fifth, half-empty panel. */
const PANEL_THEMES = THEMES.filter((t) => t.facilityLevel);

/**
 * Module 1 — Overview.
 *
 * The front door of the dashboard, and the one page that has to state a
 * finding rather than offer a menu. It used to be a masthead, a paragraph of
 * prose and six launcher cards duplicating the rail — a whole screen that
 * showed no data at all.
 *
 * The finding it leads with is the one the data actually supports and that no
 * previous screen said out loud: the three highest-scoring sub-themes are
 * about people (change readiness, digital familiarity, routine data use) and
 * the three lowest are about infrastructure resilience (connectivity
 * resilience, data resilience, device sustainability). The gap is not
 * willingness. It is power and connectivity.
 */
export default function HomePage() {
  const { national, states, lgas } = useDataContext();
  const profile = national.data;

  // Unit rates come from the shared store, so a rate typed on the Investment
  // Plan page is already in force by the time the reader gets back here.
  const entered = useInvestmentRateStore((s) => s.entered);
  const illustrative = useInvestmentRateStore((s) => s.illustrative);
  const rateCtx: RateContext = useMemo(
    () => ({ entered, illustrative }),
    [entered, illustrative],
  );

  const primaryStates = useMemo(
    () => states.data.filter((s) => s.evidenceGrade === 'primary'),
    [states.data],
  );

  /** States sitting on the instrument floor for Leadership — 1.0 exactly. */
  const leadershipFloor = useMemo(
    () =>
      primaryStates
        .filter((s) => s.themeScores.leadership_governance === 1)
        .map((s) => s.name),
    [primaryStates],
  );

  const extremes = useMemo(() => rankSubThemes(profile), [profile]);

  /* The rubric defines 22 sub-themes, but the three under Leadership are
     state-level and carry no score, so counting the definition list overstates
     what is on screen. */
  const scoredSubThemes = useMemo(
    () => SUB_THEMES.filter((d) => profile?.subThemeScores[d.id] != null).length,
    [profile],
  );

  const investment = useMemo(
    () => investmentByTheme(profile, rateCtx),
    [profile, rateCtx],
  );
  const costIsIllustrative = usesIllustrative(profile?.investments ?? [], rateCtx);

  /** Share of each state's facilities in the Not-ready band, fitted to the
   *  observed range — see the note on GeoDatum.step. */
  const mapData = useMemo(() => buildShareMap(states.data), [states.data]);

  if (national.isLoading || states.isLoading) return <PageSkeleton />;
  if (national.error) {
    return (
      <LoadError
        what="the national profile"
        error={national.error}
        onRetry={national.refetch}
      />
    );
  }
  if (!profile) return <LoadError what="the national profile" />;

  const total = profile.facilityCount;
  const mean = profile.averageScore;

  return (
    <>
      <PageHeader title="Overview" subtitle="What the assessment found" sections={SECTIONS} />

      <div className="space-y-6 p-4 sm:p-5">
        {/* ── The finding ─────────────────────────────────────────── */}
        <section id="finding" data-section>
          <p className="eyebrow">The finding</p>
          <h2 className="mt-1.5 max-w-[30ch] text-2xl font-semibold tracking-tight text-foreground">
            Ready in people, unready in power
          </h2>
          <p className="mt-2 max-w-[68ch] text-[13px] text-muted-foreground">
            {openSentence(listOf(extremes.top))} are the three highest-scoring sub-themes
            in the instrument. {openSentence(listOf(extremes.bottom))} are the three
            lowest. The gap is infrastructure, and specifically the resilience of it — what
            keeps a system running rather than what starts it.
          </p>
        </section>

        <TileRow className="sm:grid-cols-2 xl:grid-cols-4">
          {BAND_ORDER.map((band) => {
            const n = profile.archetypeDistribution[band] ?? 0;
            return (
              <Tile
                key={band}
                band={band}
                label={BAND_LABEL[band]}
                value={formatCount(n)}
                suffix={total ? `${((n / total) * 100).toFixed(1)}%` : undefined}
                note={BAND_ACTION[band]}
              />
            );
          })}
          <Tile
            label="National average"
            value={score2(mean)}
            suffix="/5"
            note={mean != null ? BAND_LABEL[toBand(mean)!] : '—'}
          />
        </TileRow>

        {/* ── Where the gap is ────────────────────────────────────── */}
        <section id="gap" data-section>
          <p className="eyebrow">
            Where the gap is · {scoredSubThemes} sub-themes against the national mean of{' '}
            {score2(mean)}
          </p>
          <div className="mt-2 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PANEL_THEMES.map((theme) => (
              <DomainPanel key={theme.id} themeId={theme.id} profile={profile} mean={mean} />
            ))}
          </div>
          <LeadershipStrip profile={profile} mean={mean} floorStates={leadershipFloor} />
        </section>

        {/* ── Where, and what it costs ────────────────────────────── */}
        {/*
          The two cards are held to one height (grid `stretch`, the default),
          and which of them would otherwise be the taller flips with the rail:
          collapsing it widens both columns, and the map keeps a fixed aspect
          ratio, so it grows taller while the investment panels — bars and text
          — do not. Left to their natural heights they swap places as the tallest
          every time the rail is toggled.

          Equal height alone would just move the slack inside the shorter card,
          so each body is a flex column whose closing element is pushed to the
          bottom with `mt-auto`: the map's legend, and the investment card's
          note. The slack lands between blocks that already read as separate,
          rather than as a gap under the last line of a card.
        */}
        <section id="where" data-section className="grid gap-4 xl:grid-cols-2">
          <SectionCard
            title="Where the not-ready facilities are"
            className="flex flex-col"
            bodyClassName="flex flex-1 flex-col"
            action={
              <Link
                to="/states"
                className="mono inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em] text-brand-500 hover:text-brand-600"
              >
                Open <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            }
          >
            <NigeriaChoropleth data={mapData.data} />
            <div className="mt-auto pt-3">
              <ScaleLegend
                lo={mapData.lo}
                hi={mapData.hi}
                format={(v) => `${Math.round(v)}%`}
                caption="Share of facilities not ready"
                note="Hover a state to name it. The 25 desk-review states carry no facility-level findings and are counted in no average."
              />
            </div>
          </SectionCard>

          {/* Both halves of the investment picture, in the one card: items by
              domain and cost by domain. They used to be two cards on the
              Investment Plan page, drawing the same five-domain list twice; here
              they share the theme labels and, between them, fill the column
              beside the map rather than leaving it short. */}
          <SectionCard
            title="Investment required"
            subtitle={`${formatCount(investment.total)} costed items`}
            className="flex flex-col"
            bodyClassName="flex flex-1 flex-col"
            action={
              <Link
                to="/investment"
                className="mono inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em] text-brand-500 hover:text-brand-600"
              >
                Detail <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            }
          >
            <p className="eyebrow mb-2">Items by domain</p>
            {/* The two bar groups grow, and spread their five rows over whatever
                height the map column gives this card, rather than sitting in a
                fixed stack with the slack pooled above the footnote. Both groups
                hold five rows and take an equal share of the free space, so a row
                in one group is spaced like a row in the other. */}
            <div className="flex flex-1 flex-col justify-between gap-3">
              {THEMES.map((theme) => {
                const q = investment.byTheme[theme.id] ?? 0;
                return (
                  <div key={theme.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px]">
                      <span className={q ? 'text-muted-foreground' : 'text-muted-foreground/60'}>
                        {theme.label}
                      </span>
                      <span className="mono font-semibold text-foreground">
                        {q ? formatCount(q) : 'none'}
                      </span>
                    </div>
                    <div className="h-[11px] rounded-[1px] bg-surface-sunk">
                      <span
                        className={`block h-full rounded-r-[3px] ${q ? 'bg-score-3' : 'bg-nodata'}`}
                        style={{ width: `${q ? (q / investment.max) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-1 flex-col border-t border-border pt-4">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <p className="eyebrow">Cost by domain</p>
                {/* "Scaled separately" is doing real work in two words: these
                    bars run against their own largest domain, not against the
                    item bars above, because items reach ~30,000 and naira runs
                    to billions. Without it a reader compares a cost bar's length
                    to the item bar directly above it and reads the two as
                    proportional. Only shown once there are bars to mis-read. */}
                <span className="mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  {investment.costTotal == null
                    ? 'awaiting rates'
                    : `${costIsIllustrative ? 'illustrative rates' : 'entered rates'} · scaled separately`}
                </span>
              </div>

              {investment.costTotal == null ? (
                // No rates anywhere: the bars would all be empty, so say why
                // instead of drawing five blank tracks. The source workbook
                // carries no cost table at all — see investmentRates.ts.
                <div className="border border-dashed border-input px-3.5 py-4">
                  <p className="text-[13px] text-muted-foreground">
                    The assessment publishes no unit-cost table, so there is nothing to
                    total yet. Enter rates — or switch on the labelled placeholders — on
                    the{' '}
                    <Link to="/investment" className="text-brand-500 hover:text-brand-600">
                      Investment Plan
                    </Link>{' '}
                    page, and every naira figure in the dashboard follows.
                  </p>
                </div>
              ) : (
                <div className="flex flex-1 flex-col">
                  {costIsIllustrative && (
                    <div
                      role="note"
                      className="mb-3 flex items-start gap-2.5 border border-moderate bg-moderate-wash px-3 py-2"
                    >
                      <AlertTriangle
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-moderate"
                        aria-hidden
                      />
                      <p className="text-[12px] text-foreground">
                        <strong className="font-semibold">
                          Illustrative rates, not NPHCDA figures.
                        </strong>{' '}
                        <span className="text-muted-foreground">
                          Item counts are real; do not quote a naira total from this view.
                        </span>
                      </p>
                    </div>
                  )}

                  <div className="flex flex-1 flex-col justify-between gap-3">
                    {THEMES.map((theme) => {
                      const cost = investment.costByTheme[theme.id] ?? 0;
                      return (
                        <div key={theme.id}>
                          <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px]">
                            <span
                              className={
                                cost ? 'text-muted-foreground' : 'text-muted-foreground/60'
                              }
                            >
                              {theme.label}
                            </span>
                            <span className="mono font-semibold text-foreground">
                              {cost ? formatNaira(cost, true) : 'none'}
                            </span>
                          </div>
                          <div className="h-[11px] rounded-[1px] bg-surface-sunk">
                            <span
                              className={`block h-full rounded-r-[3px] ${cost ? 'bg-score-3' : 'bg-nodata'}`}
                              style={{
                                width: `${cost ? (cost / investment.maxCost) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 border-l-2 border-brand-500 pl-4">
              <p className="mono mb-1 text-[10px] uppercase tracking-[0.12em] text-brand-500">
                The hole in the plan
              </p>
              <p className="text-[13px] text-muted-foreground">
                <strong className="font-semibold text-foreground">
                  Leadership &amp; Governance is the weakest domain at{' '}
                  {score2(profile.themeScores.leadership_governance)}
                </strong>{' '}
                and carries <strong className="font-semibold text-foreground">zero</strong>{' '}
                costed items — it is measured at state level while the instrument triggers
                actions at facility level. The cheapest domain to fix is the one no line
                item touches.
              </p>
            </div>
          </SectionCard>

        </section>

        {/* Follows the investment card, at full width.

            It cannot go *inside* that column: the matrix is six months plus an
            archetype and a total column, and at half width it renders three of
            the six and scrolls for the rest — a 6-month plan that shows three
            months is not the plan. It sits under the row instead, and the cards
            in that row keep their own heights — the investment card now carries
            both its panels and runs past the map, and stretching the map to
            match would only put the whitespace inside its border.

            The plan itself is a national statement — a fixed activity sequence
            per readiness band, drawn against the national facility
            distribution. It used to close National Coverage, where the counts
            beside each row moved with a state filter and implied a per-state
            schedule the assessment never supplied. */}
        <SectionCard
          id="roadmap"
          title="Roadmap · 6-month plan"
          subtitle="what each readiness band does, month by month"
          action={
            <Link
              to="/states"
              className="mono inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em] text-brand-500 hover:text-brand-600"
            >
              Which states first <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          }
        >
          <RoadmapMatrix distribution={profile.archetypeDistribution} />
        </SectionCard>

        <p className="mono text-[10.5px] text-muted-foreground">
          {formatCount(total)} facilities · {primaryStates.length} states assessed by facility
          survey · {formatCount(lgas.data.length)} LGAs.
        </p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function DomainPanel({
  themeId,
  profile,
  mean,
}: {
  themeId: ThemeId;
  profile: AreaProfile;
  mean: number | null;
}) {
  const score = profile.themeScores[themeId];
  const subs = SUB_THEMES.filter((s) => s.themeId === themeId)
    .map((s) => ({ def: s, value: profile.subThemeScores[s.id] ?? null }))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  // A domain sitting at or below the Not-ready cut is washed, so the eye finds
  // the blocked domains before reading a single number.
  const blocked = score != null && score <= 2.9;

  return (
    <section
      className={`card flex flex-col ${blocked ? 'bg-notready-wash' : ''}`}
      aria-label={THEME_BY_ID[themeId].label}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 border-b border-border px-4 py-3">
        <h3 className="text-[13.5px] font-semibold text-foreground">
          {THEME_BY_ID[themeId].label}
        </h3>
        <span className="mono ml-auto text-sm font-semibold text-foreground">
          {score2(score)}
          <span className="ml-0.5 text-[10px] tracking-wider text-muted-foreground">/5</span>
        </span>
        {/* Own line, below the label and score: the five-step maturity position
            is a second reading of the same number, not a second number. */}
        <div className="mt-1.5 basis-full">
          <MaturityMeter score={score} />
        </div>
      </header>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex-1 space-y-2.5">
          {subs.map(({ def, value }) => (
            <ScoreRow key={def.id} label={def.shortLabel} value={value} reference={mean} />
          ))}
        </div>
        <ScoreAxis />
      </div>
    </section>
  );
}

/**
 * Leadership & Governance is not a peer of the other four: no sub-themes, and
 * scored at state level. Giving it an equal panel left a hole in the grid and
 * implied a parity that is not there.
 */
function LeadershipStrip({
  profile,
  mean,
  floorStates,
}: {
  profile: AreaProfile;
  mean: number | null;
  floorStates: string[];
}) {
  const score = profile.themeScores.leadership_governance;

  return (
    <div className="card mt-4 border-l-2 border-l-notready bg-surface-sunk p-4">
      <div className="grid items-center gap-5 lg:grid-cols-[minmax(0,180px)_minmax(0,1fr)_minmax(0,260px)]">
        <div>
          <h3 className="text-[13.5px] font-semibold text-foreground">
            Leadership &amp; Governance
          </h3>
          <p className="mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            no sub-themes · state-scored
          </p>
          <p className="mono mt-1.5 text-[32px] font-semibold leading-none tracking-tight text-foreground">
            {score2(score)}
            <span className="ml-1 text-[13px] font-medium tracking-normal text-muted-foreground">
              /5
            </span>
          </p>
          <div className="mt-1.5">
            <MaturityMeter score={score} />
          </div>
        </div>

        <div>
          <ScoreTrack value={score} reference={mean} />
          <ScoreAxis reference={mean} />
          <p className="mt-2 text-[13px] text-muted-foreground">
            The weakest domain in the assessment, and the only one with no sub-themes to
            diagnose and no costed remedy to fund.
          </p>
        </div>

        <div>
          <p className="eyebrow mb-2">At the instrument floor (1.0)</p>
          <div className="flex flex-wrap gap-1.5">
            {floorStates.map((name) => (
              <span
                key={name}
                className="mono border border-input bg-surface px-2 py-0.5 text-[10.5px] text-muted-foreground"
              >
                {name}
              </span>
            ))}
          </div>
          <p className="mono mt-2 text-[10.5px] text-muted-foreground">
            {floorStates.length} of the 12 assessed states score the minimum possible value.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------

function rankSubThemes(profile: AreaProfile | null) {
  if (!profile) return { top: [], bottom: [] };
  const scored = SUB_THEMES.map((def) => ({
    label: def.shortLabel.toLowerCase(),
    value: profile.subThemeScores[def.id] ?? null,
  })).filter((s): s is { label: string; value: number } => s.value != null);

  const sorted = [...scored].sort((a, b) => b.value - a.value);
  return { top: sorted.slice(0, 3), bottom: sorted.slice(-3).reverse() };
}

/** "a, b and c". A bare `join(', ')` reads as a truncated list rather than a
 *  finished one — the reader waits for a fourth item that never arrives. */
function listOf(items: { label: string }[]): string {
  const labels = items.map((s) => s.label);
  if (labels.length < 2) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/** `rankSubThemes` lower-cases its labels so they sit inside a sentence. Both
 *  lists in the finding *open* one, so the first word needs its capital back. */
const openSentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Item counts and cost per theme.
 *
 * Two series over the same five domains, and deliberately two separate scales:
 * items run into the tens of thousands and naira into the billions, so a shared
 * maximum would pin every cost bar full and flatten every item bar to nothing.
 * Each series is drawn against its own largest domain, which means a bar length
 * compares within items or within cost — never across the two.
 *
 * `costTotal` is null, not zero, when no rate is in force anywhere: the source
 * workbook publishes no cost table, and "we cannot say" must not render as "₦0".
 */
function investmentByTheme(profile: AreaProfile | null, ctx: RateContext) {
  const byTheme: Partial<Record<ThemeId, number>> = {};
  const costByTheme: Partial<Record<ThemeId, number>> = {};
  let total = 0;
  let priced = 0;

  for (const item of profile?.investments ?? []) {
    byTheme[item.themeId] = (byTheme[item.themeId] ?? 0) + (item.quantity ?? 0);
    total += item.quantity ?? 0;

    const cost = lineTotal(item, ctx);
    if (cost != null) {
      costByTheme[item.themeId] = (costByTheme[item.themeId] ?? 0) + cost;
      priced += 1;
    }
  }

  const max = Math.max(1, ...Object.values(byTheme).map((v) => v ?? 0));
  const maxCost = Math.max(1, ...Object.values(costByTheme).map((v) => v ?? 0));
  const costTotal = priced
    ? Object.values(costByTheme).reduce((sum, v) => sum + (v ?? 0), 0)
    : null;

  return { byTheme, total, max, costByTheme, maxCost, costTotal };
}
