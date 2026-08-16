/**
 * The four report templates.
 *
 * SFM serves its templates from an API (`endpoints.reports.templates()`); ours
 * have to be authored, and each one here exists because the data actually
 * supports it. The constraint that shaped the set: `ERA dataset_v4.xlsx` is
 * facility-level and covers 12 states. Anything that would need the state-level
 * instrument — Leadership & Governance scores, Overall State Readiness, a
 * finding for the 25 desk-reviewed states — cannot be written yet, which is the
 * same blocker holding the State Summary module (guide §17.1) and Phase 6.
 *
 * So there is no "state-level findings" template, and the state brief below is
 * explicit that it reports facility findings aggregated to a state rather than a
 * state assessment.
 */

import { PRIMARY_STATES } from '@/lib/constants';
import type { ReportTemplate, TemplateContext } from './reportModel';

/**
 * Facilities per report in the scorecard pack.
 *
 * Each facility's full record is a separate ~9.5 kB shard fetched by UUID
 * (`DATA_PATHS.facility`), because the summary row carries scores but not the
 * minimum requirements or service points a scorecard is mostly made of. 40 of
 * them is ~380 kB and a few seconds on a slow connection; 2,804 would be 26 MB
 * and a document nobody opens. The cap is stated in the report itself — a
 * truncated pack that does not say it was truncated reads as a complete one.
 */
export const FACILITY_PACK_CAP = 40;

const ALL_STATES_HINT =
  'Narrow to one state with the filter bar, then generate.';

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'national',
    title: 'National readiness summary',
    subtitle: 'Headline findings across the assessed population',
    sections: [
      { id: 'overview', title: 'Overview' },
      { id: 'distribution', title: 'Readiness distribution' },
      { id: 'themes', title: 'Thematic area scores' },
      { id: 'states', title: 'State ranking' },
      { id: 'coverage', title: 'Coverage and evidence' },
    ],
    requirement: (ctx) =>
      ctx.facilityCount > 0
        ? { met: true, message: '' }
        : { met: false, message: 'No facilities match the current filters.' },
  },

  {
    id: 'state',
    title: 'State readiness brief',
    subtitle: 'One state, its LGAs and its facility population',
    sections: [
      { id: 'overview', title: 'State overview' },
      { id: 'distribution', title: 'Readiness distribution' },
      { id: 'themes', title: 'Thematic area scores' },
      { id: 'lgas', title: 'LGA ranking' },
      { id: 'coverage', title: 'Evidence note' },
    ],
    requirement: (ctx) => {
      if (ctx.facilityCount === 0) {
        return { met: false, message: 'No facilities match the current filters.' };
      }
      if (ctx.states.length !== 1) {
        return {
          met: false,
          message:
            ctx.states.length === 0
              ? 'No state in scope.'
              : `${ctx.states.length} states are in scope. This brief covers one. ${ALL_STATES_HINT}`,
        };
      }
      return { met: true, message: '' };
    },
  },

  {
    id: 'thematic',
    title: 'Thematic deep-dive',
    subtitle: 'One thematic area, its sub-themes and where it is weakest',
    sections: [
      { id: 'overview', title: 'Theme overview' },
      { id: 'distribution', title: 'Band distribution on this theme' },
      { id: 'subthemes', title: 'Sub-thematic breakdown' },
      { id: 'geographies', title: 'Ranked geographies' },
      { id: 'coverage', title: 'Method note' },
    ],
    requirement: (ctx) => {
      if (ctx.facilityCount === 0) {
        return { met: false, message: 'No facilities match the current filters.' };
      }
      if (!ctx.theme) {
        return { met: false, message: 'Choose a thematic area above.' };
      }
      return { met: true, message: '' };
    },
  },

  {
    id: 'facility',
    title: 'Facility scorecard pack',
    subtitle: `Per-facility scorecards, up to ${FACILITY_PACK_CAP} per report`,
    sections: [
      { id: 'overview', title: 'Pack summary' },
      { id: 'roster', title: 'Facility roster' },
      { id: 'scorecards', title: 'Individual scorecards' },
      { id: 'coverage', title: 'Method note' },
    ],
    requirement: (ctx) => {
      if (ctx.facilityCount === 0) {
        return { met: false, message: 'No facilities match the current filters.' };
      }
      if (ctx.primaryStates.length === 0) {
        return {
          met: false,
          message:
            'No facility-assessed state in scope. Scorecards exist only for the ' +
            `${PRIMARY_STATES.length} states with primary data collection.`,
        };
      }
      return { met: true, message: '' };
    },
  },
];

export function templateById(id: string): ReportTemplate | undefined {
  return REPORT_TEMPLATES.find((t) => t.id === id);
}

/** Build the context a template's `requirement` is tested against. */
export function templateContext(
  facilityStates: string[],
  facilityCount: number,
  theme: TemplateContext['theme'],
): TemplateContext {
  const states = [...new Set(facilityStates)].sort();
  return {
    facilityCount,
    states,
    primaryStates: states.filter((s) =>
      (PRIMARY_STATES as readonly string[]).includes(s),
    ),
    theme,
  };
}
