import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
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
import { useDataContext } from '@/state/dataContext';
import { BAND_ACTION, BAND_LABEL, toBand } from '@/lib/bands';
import { formatCount, formatScore } from '@/lib/format';
import { buildShareMap } from '@/lib/scale';

const score2 = (v: number | null | undefined) => formatScore(v, 2);
import { SUB_THEMES, THEMES, THEME_BY_ID } from '@/lib/themes';
import type { AreaProfile, Band, ThemeId } from '@/lib/types';

const BAND_ORDER: Band[] = ['ready', 'moderately_ready', 'not_ready'];

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

  const investment = useMemo(() => investmentByTheme(profile), [profile]);

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
      <PageHeader title="Overview" subtitle="What the assessment found" />

      <div className="space-y-6 p-4 sm:p-5">
        {/* ── The finding ─────────────────────────────────────────── */}
        <section>
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
        <section>
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
        <section className="grid items-start gap-4 xl:grid-cols-2">
          <SectionCard
            title="Where the not-ready facilities are"
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
            <ScaleLegend
              lo={mapData.lo}
              hi={mapData.hi}
              format={(v) => `${Math.round(v)}%`}
              caption="Share of facilities not ready"
              note="Hover a state to name it. The 25 desk-review states carry no facility-level findings and are counted in no average."
            />
          </SectionCard>

          <SectionCard
            title="Investment required"
            subtitle={`${formatCount(investment.total)} costed items`}
            action={
              <Link
                to="/investment"
                className="mono inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em] text-brand-500 hover:text-brand-600"
              >
                Detail <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            }
          >
            <div className="space-y-2.5">
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
                    <div className="h-[7px] rounded-[1px] bg-surface-sunk">
                      <span
                        className={`block h-full rounded-r-[3px] ${q ? 'bg-score-3' : 'bg-nodata'}`}
                        style={{ width: `${q ? (q / investment.max) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 border-l-2 border-brand-500 pl-4">
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

function investmentByTheme(profile: AreaProfile | null) {
  const byTheme: Partial<Record<ThemeId, number>> = {};
  let total = 0;
  for (const item of profile?.investments ?? []) {
    byTheme[item.themeId] = (byTheme[item.themeId] ?? 0) + (item.quantity ?? 0);
    total += item.quantity ?? 0;
  }
  const max = Math.max(1, ...Object.values(byTheme).map((v) => v ?? 0));
  return { byTheme, total, max };
}
