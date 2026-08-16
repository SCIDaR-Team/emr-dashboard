import { useRef } from 'react';
import {
  BarChart3,
  FileImage,
  FileSpreadsheet,
  FileText,
  Network,
  ShieldCheck,
  Table2,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  BandBadge,
  EmptyState,
  ExportMenu,
  LoadError,
  PageSkeleton,
  SectionCard,
} from '@/components/ui';
import { CascadingLocationFilter } from '@/components/filters/CascadingLocationFilter';
import { DomainDonut } from '@/components/charts';
import { MinimumRequirementsChecklist, ServicePointGrid } from '@/components/scorecard';
import { useDataContext } from '@/state/dataContext';
import { useFacility } from '@/hooks/useFacility';
import { isNotFound } from '@/hooks/useFetchJSON';
import { useFilteredData } from '@/hooks/useFilteredData';
import { explainArchetype } from '@/lib/archetype';
import { BAND_LABEL } from '@/lib/bands';
import {
  exportCSV,
  exportElementToPDF,
  exportElementToPNG,
  exportExcel,
  exportFilename,
  type ExportNote,
  type ExportRow,
} from '@/lib/export';
import { FACILITY_THEMES } from '@/lib/themes';
import { formatScore, titleCaseName } from '@/lib/format';
import type { FacilityThemeId } from '@/lib/types';

const THEME_ICONS: Record<string, LucideIcon> = {
  Network,
  Users,
  Workflow,
  BarChart3,
  ShieldCheck,
};

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
        subtitle="Detailed facility readiness, minimum requirements and required actions"
      >
        <CascadingLocationFilter facilities={allFacilities} />
        {exportGroups && <ExportMenu groups={exportGroups} className="ml-auto" />}
      </PageHeader>

      <div className="px-4 pb-8 sm:px-6 lg:px-8">
        {!uuid ? (
          <EmptyState
            title="Select a facility"
            message="Choose a state, LGA and facility above, or arrive here from the Drill-Down Explorer."
          />
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
            message="That facility id does not match anything in the current dataset. Choose a facility above, or return to the Drill-Down Explorer."
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
            <div className="card mb-6 flex flex-wrap items-center justify-between gap-5 p-4 sm:gap-6 sm:p-6">
              <div>
                <p className="text-sm text-muted-foreground">
                  {facility.lga}, {facility.state}
                </p>
                <p className="text-xl font-bold text-brand-700">{facility.name}</p>
                {facility.archetypeIsOverride && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Readiness level carried verbatim from the published assessment; it does not
                    follow the standard rule for this facility.
                  </p>
                )}
              </div>
              <div className="text-left sm:text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Readiness level
                </p>
                <BandBadge band={facility.archetype} className="mt-1.5" />
              </div>
              <div className="text-left sm:text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Average domain score
                </p>
                <p className="text-3xl font-bold text-brand-700">
                  {formatScore(facility.averageDomainScore)}
                  <span className="text-lg text-muted-foreground">/5</span>
                </p>
              </div>
              <p className="max-w-xs text-sm text-muted-foreground">
                {explainArchetype(
                  Object.fromEntries(
                    facility.themeScores.map((t) => [t.themeId, t.score]),
                  ) as Record<FacilityThemeId, number | null>,
                )}
              </p>
            </div>

            {/* One column per scored theme */}
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
              {FACILITY_THEMES.map((theme) => {
                const themeScore = facility.themeScores.find((t) => t.themeId === theme.id);
                const Icon = THEME_ICONS[theme.icon];
                const requirements = requirementDefs.data
                  .filter((r) => r.themeId === theme.id)
                  .map((r) => {
                    const answer = facility.minimumRequirements.find((m) => m.id === r.id);
                    return { id: r.id, label: r.label, met: answer?.met ?? null };
                  });

                return (
                  <div key={theme.id} className="space-y-4">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-brand-700">
                      {Icon && <Icon className="h-4 w-4" aria-hidden />}
                      {theme.label}
                    </h2>
                    <SectionCard title="Score" bodyClassName="grid place-items-center gap-3 py-6">
                      <DomainDonut
                        score={themeScore?.score ?? null}
                        band={themeScore?.band ?? null}
                        ariaLabel={`${theme.label} score, ${formatScore(themeScore?.score ?? null)} of 5`}
                      />
                      <BandBadge band={themeScore?.band ?? null} size="sm" />
                    </SectionCard>
                    <SectionCard title="Minimum requirements">
                      {requirements.length ? (
                        <MinimumRequirementsChecklist items={requirements} />
                      ) : (
                        <EmptyState title="No requirements defined for this theme" />
                      )}
                    </SectionCard>
                    <SectionCard title="Investments">
                      <EmptyState
                        title="Awaiting cost table"
                        message="Item list and quantities are derivable from the data; unit costs need client sign-off (guide §9.1, §17.4)."
                      />
                    </SectionCard>
                  </div>
                );
              })}
            </div>

            <SectionCard
              title="Service points"
              subtitle="Device, digital system and staffing at each point of care"
              className="mt-6"
            >
              <ServicePointGrid servicePoints={facility.servicePoints} />
            </SectionCard>
          </div>
        )}
      </div>
    </>
  );
}
