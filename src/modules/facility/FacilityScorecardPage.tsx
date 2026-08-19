import { useMemo, useRef } from 'react';
import {
  ClipboardList,
  FileImage,
  FileSpreadsheet,
  FileText,
  Table2,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  BandBadge,
  EmptyState,
  ExportMenu,
  LoadError,
  MaturityBadge,
  ScoreAxis,
  ScoreRow,
  PageSkeleton,
  SectionCard,
} from '@/components/ui';
import { CascadingLocationFilter } from '@/components/filters/CascadingLocationFilter';
import {
  MinimumRequirementsChecklist,
  ServicePointGrid,
} from '@/components/scorecard';
import { useDataContext } from '@/state/dataContext';
import { useFacility } from '@/hooks/useFacility';
import { isNotFound } from '@/hooks/useFetchJSON';
import { useFilteredData } from '@/hooks/useFilteredData';
import {
  explainArchetype,
  FACILITY_CORE_THEMES,
  SUPPORTING_FLOOR,
} from '@/lib/archetype';
import { BAND_CLASSES, BAND_LABEL, BAND_LOWER_CUT, toBand } from '@/lib/bands';
import { cn } from '@/lib/cn';
import { scorePct } from '@/lib/scale';
import {
  exportCSV,
  exportElementToPDF,
  exportElementToPNG,
  exportExcel,
  exportFilename,
  type ExportNote,
  type ExportRow,
} from '@/lib/export';
import { FACILITY_THEMES, SUB_THEMES, THEME_BY_ID } from '@/lib/themes';
import { formatScore, titleCaseName, formatCount } from '@/lib/format';
import type {
  Facility,
  FacilitySummary,
  FacilityThemeId,
  InvestmentPriority,
} from '@/lib/types';

/** Unmet first, then met, then never measured: the work is what the reader
 *  came for, and "not measured" is neither a pass nor a failure. */
const rank = (met: boolean | null) => (met === false ? 0 : met === true ? 1 : 2);

const PRIORITY_RANK: Record<InvestmentPriority, number> = { high: 0, medium: 1, low: 2 };


/**
 * Module 4 — Facility Scorecard.
 *
 * Cascading State → LGA → Facility selector; readiness badge and average
 * domain score; then one column per scored theme, each with a donut, a
 * minimum-requirements checklist, and a prioritised investment list. A
 * service-point grid follows, spanning the full width.
 *
 * Leadership & Governance is absent by design — it is assessed at state level
 * only and has no facility instrument.
 */
export default function FacilityScorecardPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const { allFacilities } = useFilteredData();
  const { requirementDefs } = useDataContext();
  const { data: facility, isLoading, error, refetch } = useFacility(uuid);
  const sheetRef = useRef<HTMLDivElement>(null);

  /**
   * The scorecard is the one surface in the dashboard that is *about* a single
   * place, so it is the one people ask to take away — a PDF for the facility's
   * own file, and the requirements table for whoever has to act on it. Both
   * carry the facility's identity, because a page of ticks and crosses with no
   * name on it is worse than no page at all.
   */
  const exportGroups = facility
    ? (() => {
        const name = () => exportFilename('emr-scorecard', facility.name, facility.lga);
        const title = `${titleCaseName(facility.name)} — EMR Readiness Scorecard`;
        const notes: ExportNote[] = [
          ['Facility', titleCaseName(facility.name)],
          ['Location', `${titleCaseName(facility.lga)}, ${facility.state}`],
          [
            'Readiness level',
            `${facility.archetype ? BAND_LABEL[facility.archetype] : 'No data'} · average domain score ${formatScore(facility.averageDomainScore)}/5`,
          ],
        ];

        const requirementRows = (): ExportRow[] =>
          FACILITY_THEMES.flatMap((theme) =>
            requirementDefs.data
              .filter((r) => r.themeId === theme.id)
              .map((r) => {
                const answer = facility.minimumRequirements.find((m) => m.id === r.id);
                return {
                  Facility: titleCaseName(facility.name),
                  LGA: titleCaseName(facility.lga),
                  State: facility.state,
                  'Thematic area': theme.label,
                  Requirement: r.label,
                  // Null is not a failure. Two of the 24 requirements cannot be
                  // measured from the instrument at all, and a spreadsheet that
                  // renders them as "No" invents a finding.
                  Status:
                    answer?.met == null ? 'Not assessed' : answer.met ? 'Met' : 'Not met',
                };
              }),
          );

        return [
          {
            label: 'This scorecard',
            actions: [
              {
                id: 'pdf',
                label: 'PDF scorecard',
                hint: 'The page as printed — donuts, checklists and service points, across as many A4 pages as it takes.',
                icon: FileText,
                run: () => {
                  const el = sheetRef.current;
                  if (!el) throw new Error('The scorecard is not ready to capture yet.');
                  return exportElementToPDF(el, name(), { title, notes });
                },
              },
              {
                id: 'png',
                label: 'PNG image',
                hint: 'One tall image, for a slide or a message.',
                icon: FileImage,
                run: () => {
                  const el = sheetRef.current;
                  if (!el) throw new Error('The scorecard is not ready to capture yet.');
                  return exportElementToPNG(el, name(), {
                    caption: [title, ...notes.slice(1).map(([l, v]) => `${l}: ${v}`)],
                  });
                },
              },
            ],
          },
          {
            label: 'Minimum requirements',
            actions: [
              {
                id: 'csv',
                label: 'CSV',
                icon: Table2,
                run: () => exportCSV(`${name()}-requirements`, requirementRows()),
              },
              {
                id: 'xlsx',
                label: 'Excel workbook',
                icon: FileSpreadsheet,
                run: () =>
                  exportExcel(`${name()}-requirements`, requirementRows(), {
                    sheet: 'Requirements',
                    notes,
                  }),
              },
            ],
          },
        ];
      })()
    : null;

  return (
    <>
      <PageHeader
        title="Facility Scorecard"
        subtitle="One facility, its gates and its actions"
      >
        <CascadingLocationFilter facilities={allFacilities} />
        {exportGroups && <ExportMenu groups={exportGroups} className="ml-auto" />}
      </PageHeader>

      <div className="space-y-4 p-4 sm:p-5">
        {!uuid ? (
          <FacilityPicker facilities={allFacilities} />
        ) : isLoading && !facility ? (
          <PageSkeleton />
        ) : /*
             A 404 on the shard is the one case where "not found" is true: the
             server was reached and reported that this UUID has no file. Every
             other error — a 500, a timeout, an offline browser — says nothing
             about the id, and telling the reader it does sends them off to
             hunt for a typo in a UUID that was correct.
           */
        isNotFound(error) || (!error && !facility) ? (
          <EmptyState
            title="Facility not found"
            message="That facility id does not match anything in the current dataset. Choose a facility above, or return to the Report Explorer."
          />
        ) : error ? (
          <LoadError
            what="this facility's scorecard"
            error={error}
            onRetry={refetch}
          />
        ) : !facility ? (
          <EmptyState
            title="Facility not found"
            message="That facility id does not match anything in the current dataset."
          />
        ) : (
          <div ref={sheetRef}>
            <GatePanel facility={facility} />

            {/* Where the score comes from — the sub-theme bars behind each
                domain figure. These replace the four ECharts donuts: a donut
                of a single 1–5 value is a one-datum pie, it cannot show the
                seven sub-scores underneath it, and the reader could not see
                that Technical Infrastructure is dragged down by resilience
                rather than by devices. */}
            <section>
              <p className="eyebrow">Where the score comes from</p>
              <div className="mt-2 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                {FACILITY_THEMES.map((theme) => {
                  const themeScore = facility.themeScores.find((t) => t.themeId === theme.id);
                  const subs = SUB_THEMES.filter((sub) => sub.themeId === theme.id)
                    .map((sub) => ({
                      def: sub,
                      value: themeScore?.subThemeScores?.[sub.id] ?? null,
                    }))
                    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

                  return (
                    <section key={theme.id} className="card flex flex-col">
                      <header className="flex flex-wrap items-baseline gap-x-3 border-b border-border px-4 py-3">
                        <h2 className="text-[13.5px] font-semibold text-foreground">
                          {theme.label}
                        </h2>
                        <span className="mono ml-auto text-sm font-semibold text-foreground">
                          {formatScore(themeScore?.score ?? null, 2)}
                        </span>
                        <div className="mt-1.5 basis-full">
                          <MaturityBadge score={themeScore?.score ?? null} size="sm" />
                        </div>
                      </header>
                      <div className="flex flex-1 flex-col p-4">
                        <div className="flex-1 space-y-2.5">
                          {subs.map(({ def, value }) => (
                            <ScoreRow key={def.id} label={def.shortLabel} value={value} />
                          ))}
                        </div>
                        <ScoreAxis />
                      </div>
                    </section>
                  );
                })}
              </div>
            </section>

            {/* Minimum requirements, unmet first.
                A checklist read in rubric order buries the four things this
                facility has to fix among the twenty it already does. Ordering
                by outcome puts the work at the top of each column, and the
                met items recede rather than disappearing — "we checked and it
                passed" is worth seeing. */}
            <section>
              <p className="eyebrow">
                Minimum requirements ·{' '}
                {facility.minimumRequirements.filter((r) => r.met === true).length} of{' '}
                {facility.minimumRequirements.length} met
              </p>
              <div className="mt-2 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                {FACILITY_THEMES.map((theme) => {
                  const requirements = requirementDefs.data
                    .filter((r) => r.themeId === theme.id)
                    .map((r) => {
                      const answer = facility.minimumRequirements.find((m) => m.id === r.id);
                      return { id: r.id, label: r.label, met: answer?.met ?? null };
                    })
                    .sort((a, b) => rank(a.met) - rank(b.met));
                  const met = requirements.filter((r) => r.met === true).length;

                  if (!requirements.length) return null;
                  return (
                    <div key={theme.id} className="card p-4">
                      <h3 className="mono mb-2.5 text-[9.5px] uppercase tracking-[0.11em] text-muted-foreground">
                        {theme.label} — {met} of {requirements.length} met
                      </h3>
                      <MinimumRequirementsChecklist items={requirements} />
                    </div>
                  );
                })}
              </div>
            </section>

            <SectionCard
              title="What this facility needs"
              subtitle={`${facility.investments.length} actions, ordered by priority`}
              bodyClassName="p-0"
            >
              {facility.investments.length ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[13px]">
                      <caption className="sr-only">
                        Investment actions required at this facility
                      </caption>
                      <thead>
                        <tr className="mono text-[9.5px] uppercase tracking-[0.11em] text-muted-foreground">
                          <th scope="col" className="border-b border-input px-4 py-2 text-left font-normal">
                            Action
                          </th>
                          <th scope="col" className="border-b border-input py-2 pr-3 text-left font-normal">
                            Domain
                          </th>
                          <th scope="col" className="border-b border-input py-2 pr-3 text-right font-normal">
                            Quantity
                          </th>
                          <th scope="col" className="border-b border-input py-2 pr-4 text-right font-normal">
                            Priority
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...facility.investments]
                          .sort(
                            (a, b) =>
                              PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
                              b.quantity - a.quantity,
                          )
                          .map((item) => (
                            <tr
                              key={item.id}
                              className="border-b border-border last:border-b-0 hover:bg-surface-sunk"
                            >
                              <td className="px-4 py-2">{item.label}</td>
                              <td className="py-2 pr-3 text-xs text-muted-foreground">
                                {THEME_BY_ID[item.themeId].shortLabel}
                              </td>
                              <td className="mono py-2 pr-3 text-right text-xs">
                                {formatCount(item.quantity)}
                              </td>
                              <td className="py-2 pr-4 text-right">
                                <span
                                  className={cn(
                                    'mono border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em]',
                                    item.priority === 'high'
                                      ? 'border-notready text-notready'
                                      : 'border-input text-muted-foreground',
                                  )}
                                >
                                  {item.priority}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mono border-t border-border px-4 py-3 text-[10.5px] leading-relaxed text-muted-foreground">
                    Naira costs are omitted here for the same reason as everywhere else: the
                    source workbook has no signed-off unit cost table. Rates can be applied
                    on the{' '}
                    <Link to="/investment" className="text-brand-500 hover:text-brand-600">
                      Investment Plan
                    </Link>{' '}
                    page.
                  </p>
                </>
              ) : (
                <div className="p-4">
                  <EmptyState
                    title="No investment needed"
                    message="Every measured minimum requirement at this facility is met."
                  />
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Service points"
              subtitle="Device, digital system and staffing at each point of care"
            >
              <ServicePointGrid servicePoints={facility.servicePoints} />
            </SectionCard>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * The landing state, before a facility is chosen.
 *
 * The cascading selector above is three dependent dropdowns deep, which is the
 * right instrument for "show me *this* facility" and the wrong one for "show me
 * what a scorecard looks like". Most first visits are the second question, so
 * the empty state carries a few facilities you can open in one click.
 *
 * They are drawn from the Ready band on purpose: it holds 110 of 2,804
 * facilities, so it is the hardest band to reach by picking at random, and a
 * scorecard that clears every gate is the most legible introduction to what the
 * gates are. The list is sorted by name so the same four appear every visit —
 * a shuffling set of examples reads as data changing underneath you.
 */
function FacilityPicker({ facilities }: { facilities: FacilitySummary[] }) {
  const picks = useMemo(
    () =>
      facilities
        .filter((f) => f.archetype === 'ready')
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 4),
    [facilities],
  );

  return (
    <div className="grid place-items-center rounded-card border border-dashed border-border px-6 py-16 text-center">
      <div className="max-w-xl">
        <ClipboardList className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
        <p className="mt-3 font-medium text-foreground">Choose a facility</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a state, then an LGA, then a facility from the bar above — or jump
          straight to one of these.
        </p>

        {picks.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {picks.map((f) => (
              <Link
                key={f.uuid}
                to={`/facilities/${f.uuid}`}
                className="border border-input bg-surface px-3 py-2 text-sm text-foreground hover:border-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {titleCaseName(f.name)}{' '}
                <span className="text-muted-foreground">{f.state}</span>
              </Link>
            ))}
          </div>
        )}

        <p className="mono mt-4 text-[11px] text-muted-foreground">
          {formatCount(facilities.length)} facilities have a scorecard.
        </p>
      </div>
    </div>
  );
}

/**
 * The verdict, and why.
 *
 * The average domain score used to be the largest number on this page. It does
 * not decide the band and never did: `classifyFacility` takes the *minimum* of
 * the two core themes and cuts at 2.9, so a facility can average 3.83 and still
 * be Not ready because Technical Infrastructure came in at 2.70. Leading with
 * the average put a decoy in the biggest type on the screen.
 *
 * So the panel leads with the gates — one row per theme, the cut marked, the
 * failing one washed — and states the arithmetic underneath. The average is
 * still there, demoted to the line that explains why it does not matter.
 */
function GatePanel({ facility }: { facility: Facility }) {
  const byTheme = new Map(facility.themeScores.map((t) => [t.themeId, t.score]));
  const coreScores = FACILITY_CORE_THEMES.map((t) => byTheme.get(t) ?? null).filter(
    (v): v is number => v != null,
  );
  const core = coreScores.length ? Math.min(...coreScores) : null;

  return (
    <div className="card mb-4">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-4 py-3.5">
        <div className="min-w-0">
          <p className="mono text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
            {facility.lga} LGA · {facility.state} · {facility.functionalityLevel} ·{' '}
            {facility.geography}
            {facility.isBHCPF && ' · BHCPF'}
          </p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            {facility.name}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <BandBadge band={facility.archetype} />
          <div className="mt-1.5 flex justify-end">
            <MaturityBadge score={facility.averageDomainScore} size="sm" />
          </div>
        </div>
      </header>

      <div className="px-4 py-2">
        {FACILITY_THEMES.map((theme) => {
          const score = byTheme.get(theme.id) ?? null;
          const isCore = (FACILITY_CORE_THEMES as readonly string[]).includes(theme.id);
          const cut = isCore ? BAND_LOWER_CUT : SUPPORTING_FLOOR;
          const failing = isCore && score != null && score <= BAND_LOWER_CUT;
          const band = toBand(score);

          return (
            <div
              key={theme.id}
              className={cn(
                'grid items-center gap-4 border-b border-border py-2.5 last:border-b-0 sm:grid-cols-[176px_1fr_auto]',
                failing && '-mx-4 bg-notready-wash px-4',
              )}
            >
              <div>
                <p className="text-[13px] font-semibold text-foreground">{theme.label}</p>
                <p className="mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                  {isCore ? `core gate · cut ${BAND_LOWER_CUT}` : `supporting · floor ${SUPPORTING_FLOOR.toFixed(1)}`}
                </p>
              </div>

              {score == null ? (
                <div
                  className="hatch-secondary h-2.5 rounded-[1px] bg-surface-sunk"
                  title={`${theme.label} — not scored`}
                />
              ) : (
                <div className="relative h-2.5 rounded-[1px] bg-surface-sunk">
                  <span
                    className={cn(
                      'absolute inset-y-0 left-0 block rounded-r-[3px]',
                      band ? BAND_CLASSES[band].bg : 'bg-nodata',
                    )}
                    style={{ width: `${scorePct(score)}%` }}
                  />
                  <span
                    aria-hidden
                    className="absolute -top-1 -bottom-1 z-10 block w-px bg-muted-foreground"
                    style={{ left: `${scorePct(cut)}%` }}
                  />
                </div>
              )}

              <div className="text-right">
                <p className="mono text-[13px] font-semibold text-foreground">
                  {score == null ? 'n/s' : formatScore(score, 2)}
                </p>
                <div className="mt-1 flex justify-end">
                  <MaturityBadge score={score} size="sm" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="border-t border-border bg-surface-sunk px-4 py-3 text-[13px] text-muted-foreground">
        Average domain score is{' '}
        <strong className="font-semibold text-foreground">
          {formatScore(facility.averageDomainScore, 2)}
        </strong>{' '}
        — and it does not decide the band.{' '}
        {core != null && (
          <>
            The rule takes the lower of the two core themes:{' '}
            <code className="mono border border-border bg-surface px-1.5 py-px text-[11.5px]">
              core = {formatScore(core, 2)}
            </code>
            .{' '}
          </>
        )}
        {explainArchetype(
          Object.fromEntries(facility.themeScores.map((t) => [t.themeId, t.score])) as Record<
            FacilityThemeId,
            number | null
          >,
        )}{' '}
        Hairlines mark the cuts.
      </p>
    </div>
  );
}
