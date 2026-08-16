/**
 * Facility archetype classification and state roll-up.
 *
 * The rule below was recovered empirically from the 2,804 scored facilities in
 * `ERA dataset_v4.xlsx` and reproduces the published `final_facility_archetype`
 * column for 2,773 of them (98.89%).
 *
 * Alternatives tested, with the exact tercile cut points:
 *   no supporting-floor clause ........ 95.19%
 *   supporting floor fitted to 2.46 ... 99.00%  (3 better; overfit, not used)
 *   mean(all four themes) ............. 72.6%
 *   min(all four themes) .............. 69.3%
 *
 * The facilities that a core-only rule misses all fail the same way: their core
 * scores say Ready but the published column says Moderately ready. The
 * supporting floor captures most of them. The 31 residual facilities follow no
 * tested formulation and are presumed manual overrides in the source
 * spreadsheet.
 *
 * Consequence: the ETL carries the published column through verbatim. This
 * module exists to *explain* an archetype and to recompute one when the user
 * filters the facility population — not to overwrite what was published.
 */

import type { Band, FacilityThemeId } from './types';
import { BAND_RANK, BAND_LOWER_CUT, BAND_UPPER_CUT, toBand } from './bands';

/**
 * Themes that gate readiness at facility level.
 *
 * The governing principle from the assessment: strong performance in
 * supporting domains cannot compensate for gaps in technical infrastructure or
 * workforce capacity. Leadership & Governance is also a core domain, but it is
 * assessed at state level only and so does not appear here.
 */
export const FACILITY_CORE_THEMES: readonly FacilityThemeId[] = [
  'technical_infrastructure',
  'workforce_capacity',
] as const;

export const FACILITY_SUPPORTING_THEMES: readonly FacilityThemeId[] = [
  'workflow_transition',
  'data_use_reporting',
] as const;

/** Floor the supporting themes must clear before a facility can be Ready. */
export const SUPPORTING_FLOOR = 2.5;

export type ThemeScoreMap = Partial<Record<FacilityThemeId, number | null>>;

function minDefined(scores: (number | null | undefined)[]): number | null {
  const present = scores.filter(
    (s): s is number => s != null && Number.isFinite(s),
  );
  return present.length ? Math.min(...present) : null;
}

/**
 * Classify a facility from its four theme scores.
 *
 * Returns null when neither core theme has a score — an unclassifiable
 * facility, which is not the same as a Not ready one.
 */
export function classifyFacility(scores: ThemeScoreMap): Band | null {
  const core = minDefined(FACILITY_CORE_THEMES.map((t) => scores[t]));
  if (core == null) return null;

  const supporting = minDefined(FACILITY_SUPPORTING_THEMES.map((t) => scores[t]));

  if (core <= BAND_LOWER_CUT) return 'not_ready';
  if (core > BAND_UPPER_CUT && supporting != null && supporting >= SUPPORTING_FLOOR) {
    return 'ready';
  }
  return 'moderately_ready';
}

/**
 * Plain-language reason for an archetype, for the Facility Scorecard.
 *
 * Users act on these classifications, so the dashboard should say why a
 * facility landed where it did rather than presenting the label as a given.
 */
export function explainArchetype(scores: ThemeScoreMap): string {
  const core = minDefined(FACILITY_CORE_THEMES.map((t) => scores[t]));
  const supporting = minDefined(FACILITY_SUPPORTING_THEMES.map((t) => scores[t]));
  if (core == null) return 'Not enough scored indicators to classify this facility.';

  if (core <= BAND_LOWER_CUT) {
    return 'A core theme (technical infrastructure or workforce capacity) is Not ready. Foundational investment is required before EMR deployment, regardless of performance in the supporting themes.';
  }
  if (core > BAND_UPPER_CUT && (supporting == null || supporting < SUPPORTING_FLOOR)) {
    return `Both core themes are Ready, but a supporting theme scores below ${SUPPORTING_FLOOR.toFixed(1)}. Targeted intervention is needed before deployment.`;
  }
  if (core > BAND_UPPER_CUT) {
    return 'Both core themes are Ready and the supporting themes clear the minimum floor. This facility is positioned for immediate deployment.';
  }
  return 'Core themes are above the Not ready threshold but not yet Ready. Targeted intervention is needed to close the remaining gaps.';
}

// ---------------------------------------------------------------------------
// Roll-up
// ---------------------------------------------------------------------------

const COMPOSITE_WEIGHT: Record<Band, number> = {
  ready: 5,
  moderately_ready: 3,
  not_ready: 1,
};

/**
 * Composite facility readiness for an LGA or state.
 *
 *   (5·ready + 3·moderatelyReady + 1·notReady) / totalFacilities
 *
 * Yields a 1–5 value on the same scale as a theme score, so it can be banded
 * with the same terciles.
 */
export function compositeReadiness(archetypes: Band[]): number | null {
  if (archetypes.length === 0) return null;
  const total = archetypes.reduce((sum, a) => sum + COMPOSITE_WEIGHT[a], 0);
  return total / archetypes.length;
}

export function archetypeDistribution(archetypes: Band[]): Record<Band, number> {
  const dist: Record<Band, number> = {
    not_ready: 0,
    moderately_ready: 0,
    ready: 0,
  };
  for (const a of archetypes) dist[a] += 1;
  return dist;
}

/**
 * Final state deployment level: state-level enabling environment combined with
 * the composite facility readiness of that state.
 *
 * The three diagonal cells and their timelines are stated explicitly in the
 * assessment; the off-diagonal cells are inferred from the surrounding text and
 * should be confirmed against the source deck before this is relied on for
 * planning. See build guide §3.8.
 */
export function stateDeploymentLevel(
  stateReadiness: Band,
  compositeScore: number | null,
): Band | null {
  const composite = toBand(compositeScore);
  if (!composite) return null;
  const worst = Math.min(BAND_RANK[stateReadiness], BAND_RANK[composite]);
  const best = Math.max(BAND_RANK[stateReadiness], BAND_RANK[composite]);
  if (worst === 1) return best === 3 ? 'moderately_ready' : 'not_ready';
  if (worst === 3) return 'ready';
  return 'moderately_ready';
}
