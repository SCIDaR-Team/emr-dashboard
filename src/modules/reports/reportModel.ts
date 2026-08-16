/**
 * The report document model.
 *
 * A generated report is data before it is DOM. The builder in `buildReport.ts`
 * produces one of these, `ReportDocument.tsx` renders it, and the PDF is a
 * capture of that same rendered element — so there is exactly one description of
 * what a report contains and one rendering of it.
 *
 * This is the load-bearing difference from the dashboard this layout is ported
 * from. SFM (`../sfm-dashboard/apps/web/app/(app)/reports/page.tsx`) generates a
 * document on a Python backend, renders it to HTML there, and drops the result
 * into an `<iframe srcDoc>`. We have no backend, and an iframe would be the
 * wrong answer even with one: content inside it does not inherit the app's
 * theme, cannot be selected together with the page, is invisible to the app's
 * own accessibility tree, and — the practical objection — cannot be handed to
 * `html2canvas`, which is how every other export in this app already works.
 *
 * So the preview is real DOM in the real document, and `exportElementToPDF`
 * captures the element the reader is looking at. What you see is definitionally
 * what you get.
 */

import type { Band, ThemeId } from '@/lib/types';
import type { ExportNote } from '@/lib/export';

/** A row of figures across the top of a section. */
export interface KpiBlock {
  kind: 'kpis';
  items: { label: string; value: string; sublabel?: string }[];
}

/** Free prose. Kept short — a report nobody reads is a report nobody checks. */
export interface ProseBlock {
  kind: 'prose';
  text: string;
}

/**
 * A caveat, rendered distinctly from prose.
 *
 * These are not decoration. Half of what this dataset has to say is about what
 * it cannot say — 25 states and the FCT carry no facility-level findings at all,
 * two of the 24 minimum requirements are permanently unassessable, and a
 * filtered figure is not a national one. A report that drops those lines is a
 * report that misquotes its own source.
 */
export interface CaveatBlock {
  kind: 'caveat';
  text: string;
}

export interface TableBlock {
  kind: 'table';
  columns: string[];
  /** `null` renders as an em dash — "not measured", never as zero. */
  rows: (string | number | null)[][];
  /** Columns to right-align, by index. Figures right, names left. */
  numericColumns?: number[];
  caption?: string;
}

/** The three-band split, drawn as a proportional bar with its counts. */
export interface DistributionBlock {
  kind: 'distribution';
  counts: Record<Band, number>;
  total: number;
  caption?: string;
}

/** Theme scores as labelled bars on the 1–5 scale. */
export interface ScoreBarsBlock {
  kind: 'scoreBars';
  items: { label: string; score: number | null; note?: string }[];
}

export type ReportBlock =
  | KpiBlock
  | ProseBlock
  | CaveatBlock
  | TableBlock
  | DistributionBlock
  | ScoreBarsBlock;

export interface ReportSection {
  id: string;
  title: string;
  blocks: ReportBlock[];
}

export interface ReportDoc {
  templateId: string;
  title: string;
  subtitle: string;
  /**
   * Provenance, in the same shape every other export in this app uses.
   *
   * Rendered into the document itself *and* passed to `exportElementToPDF` as
   * its header block, so the claim survives both the screen and the file. See
   * the header comment in `src/lib/export.ts` for why this is not optional.
   */
  notes: ExportNote[];
  sections: ReportSection[];
}

/** What a template needs before it can be generated. */
export interface TemplateRequirement {
  met: boolean;
  /** Shown in place of the Generate button when `met` is false. */
  message: string;
}

export interface ReportTemplate {
  id: string;
  title: string;
  subtitle: string;
  sections: { id: string; title: string }[];
  /**
   * Whether the current scope can support this template, and what to say when it
   * cannot. A template that would render an empty document is disabled with the
   * reason rather than generating a page of dashes.
   */
  requirement: (ctx: TemplateContext) => TemplateRequirement;
}

/** Everything a template is allowed to read. */
export interface TemplateContext {
  /** Facilities after the global filters. */
  facilityCount: number;
  /** Distinct states present in the filtered population. */
  states: string[];
  /** Distinct primary (facility-assessed) states present. */
  primaryStates: string[];
  theme: ThemeId | null;
}
