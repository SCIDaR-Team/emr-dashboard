/**
 * The browser half of the Drill-Down Explorer's data cube.
 *
 * `etl/lib/explorerCube.mjs` precomputes every (geography × thematic node) cell
 * into `explorer-cube.json`, which makes an unfiltered interaction a lookup
 * rather than a scan over 2,804 facilities. That cube is fixed at build time, so
 * it cannot answer the one question guide §8.3 also requires — *"the same view,
 * but only BHCPF facilities"*. Filters restrict the population **before**
 * aggregation, so a filtered view is a different cube, not a subset of this one.
 *
 * This module recomputes cells from `facilities-summary.json` for exactly that
 * case. It is a deliberate mirror of the ETL's arithmetic, and
 * `explorerCube.test.ts` asserts the two agree cell-for-cell against the shipped
 * cube — a copied formula that silently drifts would make the numbers on screen
 * depend on whether a filter happened to be active, which is worse than not
 * offering the filter.
 *
 * Nothing here recomputes an *indicator* score. The ETL owns scoring; this reads
 * the scores it published and aggregates them.
 */

import { compositeReadiness } from './archetype';
import { toBand } from './bands';
import { FACILITY_THEMES, SUB_THEMES, THEMES } from './themes';
import type {
  Aggregation,
  Band,
  ExplorerCell,
  FacilitySummary,
  FacilityThemeId,
  IndicatorMatrix,
  ThemeNodeId,
} from './types';

const FACILITY_THEME_IDS: readonly string[] = FACILITY_THEMES.map((t) => t.id);

const CUBE_NODE_IDS: ReadonlySet<string> = new Set<string>([
  'overall',
  ...THEMES.map((t) => t.id),
  ...SUB_THEMES.map((s) => s.id),
]);

/**
 * Is this node the on-demand indicator level rather than a cube node?
 *
 * Decided structurally, from the static thematic hierarchy, so it can be
 * answered *before* the indicator matrix has been fetched — which is what lets
 * the explorer know it needs to fetch it at all.
 */
export function isIndicatorNode(node: ThemeNodeId): boolean {
  return !CUBE_NODE_IDS.has(node);
}

export const EMPTY_CELL: ExplorerCell = {
  score: null,
  band: null,
  n: 0,
  scored: 0,
  distribution: { not_ready: 0, moderately_ready: 0, ready: 0 },
};

/**
 * A function reading one facility's value on one thematic node, on the 1–5
 * scale.
 *
 * Built once per cell rather than branching per facility, which matters at the
 * indicator level: resolving the column index once turns 2,804 string lookups
 * into 2,804 array reads.
 *
 * Guide §8.3's colouring table, per facility: all-themes resolves to the
 * published archetype — encoded by its composite weight (1 / 3 / 5) so a
 * facility and an aggregate share one band scale — a thematic area to that
 * theme's score, a sub-thematic area to its renormalised 70/30 mean, and a
 * single indicator to its own score.
 *
 * Returns **null** — as distinct from a resolver that returns nulls — when the
 * node is an indicator and the matrix has not been fetched. "Not loaded yet" and
 * "loaded, and nothing here" are different states, and rendering the first as
 * the second would show an empty distribution as a finding.
 *
 * The cube-node branches mirror `facilityNodeValue` in
 * etl/lib/explorerCube.mjs.
 */
export function nodeValueResolver(
  node: ThemeNodeId,
  indicators?: IndicatorMatrix | null,
): ((facility: FacilitySummary) => number | null) | null {
  if (node === 'overall') {
    return (f) => (f.archetype ? compositeReadiness([f.archetype]) : null);
  }
  if (FACILITY_THEME_IDS.includes(node)) {
    return (f) => f.themeScores?.[node as FacilityThemeId] ?? null;
  }
  if (!isIndicatorNode(node)) {
    return (f) => f.subThemeScores?.[node] ?? null;
  }

  if (!indicators) return null;
  const column = indicators.ids.indexOf(node);
  // A node that is not a cube node and not a known indicator is an unreachable
  // id someone hand-edited into the URL. Resolving every facility to null lets
  // it render as "nothing measured" rather than throwing the page away.
  if (column === -1) return () => null;

  return (f) => {
    const value = indicators.byFacility[f.uuid]?.[column];
    if (value == null || !Number.isFinite(value)) return null;
    // Four scored columns encode their worst case as 0 where the scale's floor
    // is 1 — the same four `computeSubThemeScores` clamps in the ETL, and for
    // the same reason: a national mean of 0.06 rendered against a 1–5 band
    // scale reads as a broken chart, not as a finding. Clamping moves no
    // facility across a band boundary, since 0 and 1 both band Not ready.
    return Math.max(1, value);
  };
}

/**
 * One facility's value on one thematic node.
 *
 * Thin wrapper over `nodeValueResolver` for callers holding a single facility.
 */
export function facilityNodeValue(
  facility: FacilitySummary,
  node: ThemeNodeId,
  indicators?: IndicatorMatrix | null,
): number | null {
  return nodeValueResolver(node, indicators)?.(facility) ?? null;
}

/**
 * Aggregate a facility population on one thematic node.
 *
 * The distribution is banded on the *selected* node rather than on the
 * archetype. The two coincide only for `overall`, where the encoded 1/3/5
 * values band back to the archetype they came from; for a thematic area they
 * answer different questions, and captioning a workforce selection with the
 * archetype split would put a number on screen unrelated to the theme picked.
 *
 * Mirrors `cellFor` in etl/lib/explorerCube.mjs.
 */
export function computeCell(
  facilities: FacilitySummary[],
  node: ThemeNodeId,
  indicators?: IndicatorMatrix | null,
): ExplorerCell {
  const values: number[] = [];
  const distribution: Record<Band, number> = {
    not_ready: 0,
    moderately_ready: 0,
    ready: 0,
  };

  const valueOf = nodeValueResolver(node, indicators);
  // Indicator node, matrix still in flight. An empty cell with n=0 would read
  // as "no facilities here"; the caller distinguishes the two by asking
  // `isIndicatorNode` and whether the matrix has arrived.
  if (!valueOf) return { ...EMPTY_CELL, n: facilities.length };

  for (const facility of facilities) {
    const value = valueOf(facility);
    if (value == null || !Number.isFinite(value)) continue;
    values.push(value);
    const band = toBand(value);
    if (band) distribution[band] += 1;
  }

  const score = values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;

  return {
    score,
    band: toBand(score),
    n: facilities.length,
    scored: values.length,
    distribution,
  };
}

// ---------------------------------------------------------------------------
// The aggregation choice
// ---------------------------------------------------------------------------

/**
 * Share of the scored population in the Ready band, 0–100.
 *
 * Denominated on `scored`, not `n`: with an unscored facility in the population
 * the two differ, and dividing by `n` would report a share of a denominator the
 * numerator was never drawn from.
 */
export function pctReady(cell: ExplorerCell): number | null {
  if (!cell.scored) return null;
  return (cell.distribution.ready / cell.scored) * 100;
}

/**
 * The number the active aggregation puts on screen.
 *
 * Mean score and % Ready rank the same set of LGAs differently — an area can
 * hold a respectable mean while almost nothing in it clears the Ready
 * threshold — so which one is in force is stated in the UI, never implied.
 */
export function metricValue(
  cell: ExplorerCell,
  aggregation: Aggregation,
): number | null {
  return aggregation === 'pct_ready' ? pctReady(cell) : cell.score;
}

export const AGGREGATION_LABEL: Record<Aggregation, string> = {
  mean_score: 'Mean score',
  pct_ready: '% Ready',
};

/** Formatted for a table cell or a headline figure. */
export function formatMetric(
  value: number | null,
  aggregation: Aggregation,
): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return aggregation === 'pct_ready'
    ? `${value.toFixed(0)}%`
    : value.toFixed(2);
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/**
 * Group a population by a key, then aggregate each group on one node.
 *
 * One pass over the facilities regardless of how many groups come out, so the
 * national view's 37 states and an LGA's handful of facilities cost the same
 * per facility.
 */
export function cellsByGroup(
  facilities: FacilitySummary[],
  node: ThemeNodeId,
  keyOf: (facility: FacilitySummary) => string | null,
  indicators?: IndicatorMatrix | null,
): Map<string, ExplorerCell> {
  const groups = new Map<string, FacilitySummary[]>();
  for (const facility of facilities) {
    const key = keyOf(facility);
    if (!key) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(facility);
    else groups.set(key, [facility]);
  }

  const out = new Map<string, ExplorerCell>();
  for (const [key, group] of groups) {
    out.set(key, computeCell(group, node, indicators));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

export interface PeerRank {
  /** 1 is best on the active metric. */
  rank: number;
  /** Peers carrying a value — the denominator the rank is out of. */
  of: number;
  /** Peers with no value on this node, excluded from the ranking. */
  unranked: number;
  /**
   * Other peers holding the identical value.
   *
   * Load-bearing on the overall node, where a facility's value is its archetype
   * encoded as 1, 3 or 5: all ten facilities of an LGA that are Moderately ready
   * hold 3, so all ten are "1st of 10". Reported as first *equal* rather than
   * best, because the second reading is what the reader would otherwise take.
   */
  tiedWith: number;
}

/**
 * Rank one unit among its peers on the active metric.
 *
 * Units with no value are excluded rather than ranked last: "no data" and
 * "worst" are different findings, and a state with nothing measured should not
 * be reported as bottom of the table. The count of those excluded is returned
 * so the UI can say the rank is out of the measured peers only.
 *
 * Ties share the better rank — two units on 3.40 are both 4th, and the next is
 * 6th, which is the convention a reader brings to a league table. The tie test
 * is exact equality, which is what catches the cases that matter: the discrete
 * 1/3/5 archetype codes, and aggregates that genuinely computed to the same
 * number.
 */
export function rankAmong(
  unitId: string,
  values: Map<string, number | null>,
  { higherIsBetter = true }: { higherIsBetter?: boolean } = {},
): PeerRank | null {
  const own = values.get(unitId);
  if (own == null || !Number.isFinite(own)) return null;

  let better = 0;
  let ranked = 0;
  let unranked = 0;
  let tied = 0;
  for (const value of values.values()) {
    if (value == null || !Number.isFinite(value)) {
      unranked += 1;
      continue;
    }
    ranked += 1;
    if (higherIsBetter ? value > own : value < own) better += 1;
    else if (value === own) tied += 1;
  }

  // `tied` counted this unit itself.
  return { rank: better + 1, of: ranked, unranked, tiedWith: tied - 1 };
}

/** "3rd of 34" — the ordinal a reader expects, not "rank 3". */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const suffix: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
  return `${n}${suffix[n % 10] ?? 'th'}`;
}
