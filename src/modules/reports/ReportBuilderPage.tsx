/**
 * Module 6 — Report Builder.
 *
 * ## What is ported and what is not
 *
 * The layout and interaction model come from
 * `../sfm-dashboard/apps/web/app/(app)/reports/page.tsx`: a 12-column grid with
 * a 4-column stack of control cards (Scope → Template → Download) beside an
 * 8-column preview pane that stretches to the row height, and a single `busy`
 * state machine rather than a boolean per button.
 *
 * Nothing else is ported. SFM is Next 15 / React 19 and builds its reports on a
 * Python backend (`apps/api/app/reports/` — `builders.py`, `render_pdf.py`,
 * Jinja templates), then previews the result in an `<iframe srcDoc>`. This
 * dashboard is static React + Vite with no server, so every report is built and
 * rendered in the browser, the preview is real DOM (see `ReportDocument.tsx`),
 * and the PDF is a capture of that same element through `lib/export.ts`.
 *
 * Its "Refine with AI" card is absent. It calls a backend endpoint; an API key
 * shipped in a static client bundle is a leaked key, and there is no server to
 * put one behind. See docs/PHASES.md — this is now gated on the same
 * infrastructure decision as RBAC.
 *
 * ## Formats
 *
 * PDF, plus PNG of the same capture. Word and PowerPoint would mean `docx` and
 * `pptxgenjs` — roughly another megabyte and, more to the point, a second and
 * third rendering path that could disagree with the preview. PNG costs nothing
 * extra: it shares `html2canvas` with the PDF path and is already in
 * `lib/export.ts`. Removing it is deleting one entry from `FORMATS`.
 */

import { useMemo, useRef, useState } from 'react';
import { Download, FileText, Image, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { FilterBar } from '@/components/filters/FilterBar';
import { Card, EmptyState, LoadError, Skeleton } from '@/components/ui';
import { useFilteredData } from '@/hooks/useFilteredData';
import { useDataContext } from '@/state/dataContext';
import { useFilterStore } from '@/store/filterStore';
import { toast } from '@/store/toastStore';
import { cn } from '@/lib/cn';
import { BAND_LABEL } from '@/lib/bands';
import { DATA_PATHS } from '@/lib/constants';
import { FACILITY_THEMES, THEME_BY_ID } from '@/lib/themes';
import { exportFilename } from '@/lib/export';
import type { Facility, ThemeId } from '@/lib/types';
import { buildReport } from './buildReport';
import { ReportDocument } from './ReportDocument';
import {
  FACILITY_PACK_CAP,
  REPORT_TEMPLATES,
  templateById,
  templateContext,
} from './reportTemplates';
import type { ReportDoc } from './reportModel';

type Format = 'pdf' | 'png';

const FORMATS: { id: Format; label: string; icon: typeof FileText; hint: string }[] = [
  { id: 'pdf', label: 'PDF', icon: FileText, hint: 'Paginated, with header and footer' },
  { id: 'png', label: 'PNG', icon: Image, hint: 'One image, for slides' },
];

/** null | 'generate' | 'export' — one machine, not a boolean per button. */
type Busy = null | 'generate' | 'export';

export default function ReportBuilderPage() {
  const { facilities, allFacilities, isLoading, error, retry, isFiltered } = useFilteredData();
  const { snapshot, states } = useDataContext();
  const filters = useFilterStore();

  const [templateId, setTemplateId] = useState<string>(REPORT_TEMPLATES[0]!.id);
  const [sectionIds, setSectionIds] = useState<Set<string>>(
    () => new Set(REPORT_TEMPLATES[0]!.sections.map((s) => s.id)),
  );
  const [theme, setTheme] = useState<ThemeId | null>(FACILITY_THEMES[0]?.id ?? null);
  const [format, setFormat] = useState<Format>('pdf');
  const [doc, setDoc] = useState<ReportDoc | null>(null);
  const [busy, setBusy] = useState<Busy>(null);

  const previewRef = useRef<HTMLDivElement>(null);

  const template = templateById(templateId)!;
  const ctx = useMemo(
    () => templateContext(facilities.map((f) => f.state), facilities.length, theme),
    [facilities, theme],
  );
  const requirement = template.requirement(ctx);

  const scopeChips = useMemo(() => {
    const chips: string[] = [];
    if (filters.states.length) chips.push(...filters.states.map((s) => `State: ${s}`));
    if (filters.lgas.length) chips.push(...filters.lgas.map((l) => `LGA: ${l}`));
    if (filters.zones.length) chips.push(...filters.zones.map((z) => `Zone: ${z}`));
    if (filters.geography.length) chips.push(...filters.geography.map((g) => `Setting: ${g}`));
    if (filters.funding.length) chips.push(...filters.funding);
    if (filters.functionalityLevels.length) chips.push(...filters.functionalityLevels);
    if (filters.archetypes.length) chips.push(...filters.archetypes.map((b) => BAND_LABEL[b]));
    for (const [themeId, bands] of Object.entries(filters.bandByTheme)) {
      if (bands?.length) {
        chips.push(
          `${THEME_BY_ID[themeId as ThemeId].shortLabel}: ${bands.map((b) => BAND_LABEL[b]).join(', ')}`,
        );
      }
    }
    if (filters.search.trim()) chips.push(`Search: "${filters.search.trim()}"`);
    return chips;
  }, [filters]);

  function pickTemplate(id: string) {
    const t = templateById(id);
    if (!t) return;
    setTemplateId(id);
    setSectionIds(new Set(t.sections.map((s) => s.id)));
    // The previous document belongs to the previous template. Leaving it in the
    // pane while the controls say something else is the one state this page
    // must not sit in — the reader would download the old one.
    setDoc(null);
  }

  function toggleSection(id: string) {
    setSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /**
   * The scorecard pack is the one template that needs more than the summary
   * rows: minimum requirements and service points live in the per-UUID shards.
   * Fetched here rather than in the builder so the builder stays pure.
   */
  async function loadFacilityDetail(): Promise<Facility[]> {
    const wanted = facilities.slice(0, FACILITY_PACK_CAP);
    const settled = await Promise.allSettled(
      wanted.map(async (f) => {
        const res = await fetch(DATA_PATHS.facility(f.uuid));
        if (!res.ok) throw new Error(`${f.name} (${res.status})`);
        return (await res.json()) as Facility;
      }),
    );
    const loaded = settled
      .filter((r): r is PromiseFulfilledResult<Facility> => r.status === 'fulfilled')
      .map((r) => r.value);

    // A pack quietly missing a third of its facilities is worse than one that
    // says so — the reader would otherwise read the roster as the whole set.
    const failed = settled.length - loaded.length;
    if (failed > 0) {
      toast.error(
        `${failed} of ${settled.length} scorecards could not be loaded`,
        'They are listed in the roster but have no individual scorecard in this pack.',
      );
    }
    return loaded;
  }

  async function handleGenerate() {
    if (!requirement.met || sectionIds.size === 0) return;
    setBusy('generate');
    try {
      const facilityDetail =
        templateId === 'facility' ? await loadFacilityDetail() : undefined;

      setDoc(
        buildReport({
          templateId,
          sectionIds: template.sections.map((s) => s.id).filter((id) => sectionIds.has(id)),
          facilities,
          allFacilities,
          states: states.data,
          snapshot: snapshot.data,
          filters,
          isFiltered,
          theme,
          facilityDetail,
        }),
      );
    } catch (err) {
      toast.error(
        'Report could not be generated',
        err instanceof Error ? err.message : 'Try a narrower selection.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload() {
    const el = previewRef.current;
    if (!doc || !el) return;
    setBusy('export');
    try {
      const name = exportFilename('emr', doc.templateId, doc.notes[0]?.[1]);
      // Dynamic import, same as every other export in this app: `jspdf` and
      // `html2canvas` must not reach the initial bundle.
      const mod = await import('@/lib/export');
      if (format === 'pdf') {
        await mod.exportElementToPDF(el, name, {
          title: doc.title,
          subtitle: doc.subtitle,
          notes: doc.notes,
        });
      } else {
        // The document already prints its provenance, but a PNG gets cropped —
        // so the caption strip repeats it below the image where a crop to the
        // figures alone cannot take it with them.
        await mod.exportElementToPNG(el, name, {
          caption: [doc.title, ...doc.notes.map(([label, value]) => `${label}: ${value}`)],
        });
      }
    } catch (err) {
      toast.error(
        `${format.toUpperCase()} export failed`,
        err instanceof Error
          ? err.message
          : 'The file could not be generated. Try a smaller selection, or another format.',
      );
    } finally {
      setBusy(null);
    }
  }

  const hasData = allFacilities.length > 0;

  return (
    <>
      <PageHeader
        title="Report Builder"
        subtitle="Generate a scoped, stakeholder-ready report — preview it, then download it"
      >
        <FilterBar
          facilities={allFacilities}
          show={['state', 'lga', 'archetype', 'level', 'search']}
        />
      </PageHeader>

      <div className="px-4 pb-8 sm:px-6 lg:px-8">
        {error && <LoadError what="the facility summary" error={error} onRetry={retry} />}

        {isLoading && !hasData ? (
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-4">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-72 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
            <Skeleton className="h-[600px] w-full xl:col-span-8" />
          </div>
        ) : !hasData ? (
          !error && (
            <EmptyState
              title="No facility data in this build"
              message="public/data is present but holds no facilities. Run `npm run data:refresh` to regenerate it from ERA dataset_v4.xlsx."
            />
          )
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            {/* ── Controls ── */}
            <div className="space-y-4 xl:col-span-4">
              {/* Scope */}
              <Card>
                <h2 className="text-sm font-semibold text-foreground">Scope</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Controlled by the filter bar above. The report covers exactly this
                  selection.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {scopeChips.length ? (
                    scopeChips.map((c) => (
                      <span
                        key={c}
                        className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-foreground/80"
                      >
                        {c}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      All assessed facilities
                    </span>
                  )}
                </div>
                <p className="mt-3 text-xs font-medium text-brand-600">
                  {facilities.length.toLocaleString()} of{' '}
                  {allFacilities.length.toLocaleString()} facilities in scope
                </p>
              </Card>

              {/* Template */}
              <Card>
                <h2 className="text-sm font-semibold text-foreground">Template</h2>
                <div className="mt-3 space-y-2">
                  {REPORT_TEMPLATES.map((t) => {
                    const selected = t.id === templateId;
                    return (
                      <div key={t.id}>
                        <button
                          type="button"
                          onClick={() => pickTemplate(t.id)}
                          aria-pressed={selected}
                          className={cn(
                            'w-full rounded-lg border p-3 text-left transition-colors',
                            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                            selected
                              ? 'border-brand-500 bg-brand-50'
                              : 'border-border hover:border-brand-500/50 hover:bg-muted',
                          )}
                        >
                          <span className="block text-sm font-medium text-foreground">
                            {t.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {t.subtitle}
                          </span>
                        </button>

                        {selected && (
                          <div className="mt-3 pl-1">
                            {t.id === 'thematic' && (
                              <label className="mb-3 block">
                                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                  Thematic area
                                </span>
                                <select
                                  value={theme ?? ''}
                                  onChange={(e) => {
                                    setTheme(e.target.value as ThemeId);
                                    setDoc(null);
                                  }}
                                  className="h-9 w-full rounded-lg border border-input bg-surface px-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                >
                                  {FACILITY_THEMES.map((th) => (
                                    <option key={th.id} value={th.id}>
                                      {th.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}

                            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                              Sections
                            </p>
                            <div className="space-y-1.5">
                              {t.sections.map((s) => (
                                <label
                                  key={s.id}
                                  className="flex cursor-pointer items-center gap-2 text-sm text-foreground/85"
                                >
                                  <input
                                    type="checkbox"
                                    checked={sectionIds.has(s.id)}
                                    onChange={() => toggleSection(s.id)}
                                    className="h-4 w-4 rounded border-input accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                  />
                                  {s.title}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!requirement.met && (
                  <p className="mt-3 rounded-md border-l-2 border-moderate bg-moderate-wash px-3 py-2 text-xs text-foreground/80">
                    {requirement.message}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={busy !== null || !requirement.met || sectionIds.size === 0}
                  className={cn(
                    // `text-surface`, never `text-white` — the brand ramp
                    // inverts between schemes and white does not, which is the
                    // rule globals.css states beside the ramp. White here
                    // measured 1.97:1 against dark-mode brand-600.
                    'mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-3 text-sm font-semibold text-surface transition-colors',
                    'hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  {busy === 'generate' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <FileText className="h-4 w-4" aria-hidden />
                  )}
                  <span aria-live="polite">
                    {busy === 'generate'
                      ? 'Generating…'
                      : doc
                        ? 'Regenerate report'
                        : 'Generate report'}
                  </span>
                </button>
              </Card>

              {/* Download */}
              <Card>
                <h2 className="text-sm font-semibold text-foreground">Download</h2>
                <div
                  role="radiogroup"
                  aria-label="Download format"
                  className="mt-3 grid grid-cols-2 gap-2"
                >
                  {FORMATS.map((f) => {
                    const Icon = f.icon;
                    const selected = format === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setFormat(f.id)}
                        title={f.hint}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-lg border py-2.5 text-xs font-medium transition-colors',
                          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                          selected
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                            : 'border-border text-muted-foreground hover:border-brand-500/50',
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                        {f.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => void handleDownload()}
                  disabled={!doc || busy !== null}
                  className={cn(
                    'mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-input px-3 text-sm font-semibold text-foreground transition-colors',
                    'hover:border-brand-500/50 hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  {busy === 'export' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden />
                  )}
                  <span aria-live="polite">
                    {busy === 'export'
                      ? `Preparing ${format.toUpperCase()}…`
                      : `Download ${format.toUpperCase()}`}
                  </span>
                </button>
                {!doc && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Generate a report first.
                  </p>
                )}
              </Card>
            </div>

            {/* ── Preview ──
                The col-span-8 cell stretches to the grid row height, which the
                taller controls column drives, so the preview ends level with the
                Download card. min-h keeps it usable once stacked. */}
            <div className="xl:col-span-8">
              <Card className="h-full min-h-[600px] overflow-hidden p-0">
                {doc ? (
                  <div className="h-full overflow-y-auto">
                    <ReportDocument doc={doc} innerRef={previewRef} />
                  </div>
                ) : (
                  <div className="flex h-full min-h-[600px] flex-col items-center justify-center gap-3 px-6 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground/40" aria-hidden />
                    <p className="text-sm text-muted-foreground">
                      {busy === 'generate'
                        ? 'Generating report…'
                        : 'Choose a template and generate a report to preview it here.'}
                    </p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
