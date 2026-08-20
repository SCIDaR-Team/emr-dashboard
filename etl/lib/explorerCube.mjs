/**
 * Precompute the Drill-Down Explorer cube.
 *
 * The other modules read one entity at a time. The explorer needs
 * (geography × thematic node) on demand — 37 states + 305 LGAs + 2,804
 * facilities across 15 thematic nodes. Precomputing turns every interaction
 * into a lookup instead of a scan over the facility list.
 *
 * Shape: cube[geoId][themeNodeId] = { score, band, n, scored, distribution }
 *
 * `n` is carried on every cell and shown in the UI — a value derived from three
 * facilities should not read with the same confidence as one from 444. `scored`
 * is how many of those n facilities actually carry a value for this node, and
 * is what the distribution counts sum to. The two are equal across the current
 * dataset (every facility carries all four theme scores and all ten sub-theme
 * scores) but a later form version could break that, and a distribution bar
 * silently drawn over a smaller denominator than the `n` beside it would
 * overstate its own coverage.
 *
 * The thematic axis is the overall roll-up, the four facility-level themes and
 * their ten facility-level sub-themes. Leadership & Governance and its three
 * sub-themes are absent: they are assessed at state level only and there is no
 * facility population to aggregate. The explorer's rail already disables them
 * and says why, so a cell of nulls here would only invite a chart of nothing.
 */

import { bandDistribution, compositeReadiness, meanOrNull, toBand } from './scoring.mjs';

const THEME_IDS = [
  'technical_infrastructure',
  'workforce_capacity',
  'workflow_transition',
  'data_use_reporting',
];

/**
 * Sub-theme nodes, discovered from the facilities rather than declared.
 *
 * Taking them from the data means the axis cannot drift from what was actually
 * computed: a sub-theme whose indicators all turned out contextual never
 * appears, instead of appearing permanently empty.
 */
function subThemeNodes(facilities) {
  const ids = new Set();
  for (const f of facilities) {
    for (const id of Object.keys(f.subThemeScores ?? {})) ids.add(id);
  }
  return [...ids].filter((id) => THEME_IDS.includes(id.split('.')[0])).sort();
}

/**
 * One facility's value on one thematic node.
 *
 * Guide §8.3's colouring table, per facility: all-themes resolves to the
 * published archetype (encoded on the 1–5 scale by its composite weight, so a
 * facility and an aggregate can share one band scale), a thematic area to that
 * theme's score, a sub-thematic area to its renormalised 70/30 mean.
 *
 * Mirrored by `facilityNodeValue` in src/lib/explorerCube.ts, which recomputes
 * this in the browser when a filter is active. The two must agree.
 */
function facilityNodeValue(facility, themeNodeId, subThemeIds) {
  if (themeNodeId === 'overall') {
    return compositeReadiness([facility.archetype].filter(Boolean));
  }
  if (THEME_IDS.includes(themeNodeId)) {
    return facility.themeScores.find((t) => t.themeId === themeNodeId)?.score ?? null;
  }
  if (subThemeIds.has(themeNodeId)) {
    return facility.subThemeScores?.[themeNodeId] ?? null;
  }
  return null;
}

/**
 * Aggregate one geography × one thematic node.
 *
 * The distribution is banded *on the selected node*, not on the archetype. The
 * two are the same thing only for `overall`; for a thematic area they answer
 * different questions, and captioning a workforce-capacity selection with the
 * archetype split would put a number on screen that has nothing to do with the
 * theme the user picked.
 */
function cellFor(facilities, themeNodeId, subThemeIds) {
  const values = facilities
    .map((f) => facilityNodeValue(f, themeNodeId, subThemeIds))
    .filter((v) => v != null && Number.isFinite(v));

  // Overall is the composite roll-up of encoded archetypes, which is the mean
  // of those same 1/3/5 values — so one mean serves every node.
  const score = meanOrNull(values);

  return {
    score,
    band: toBand(score),
    n: facilities.length,
    scored: values.length,
    distribution: bandDistribution(values.map(toBand)),
  };
}

export function buildExplorerCube({ facilities, lgas, states }) {
  const subThemes = subThemeNodes(facilities);
  const subThemeIds = new Set(subThemes);
  const nodes = ['overall', ...THEME_IDS, ...subThemes];

  const cube = {};
  const put = (geoId, subset) => {
    cube[geoId] = Object.fromEntries(
      nodes.map((n) => [n, cellFor(subset, n, subThemeIds)]),
    );
  };

  put('national', facilities);

  for (const state of states) {
    if (state.evidenceGrade !== 'primary') continue;
    put(state.id, facilities.filter((f) => f.stateId === state.id));
  }

  for (const lga of lgas) {
    put(lga.id, facilities.filter((f) => `${f.stateId}.${f.lgaId}` === lga.id));
  }

  // Facility-level cells are a single row each — cheap, and it means the
  // explorer's deepest level needs no special case.
  for (const f of facilities) {
    put(`${f.stateId}.${f.lgaId}.${f.uuid}`, [f]);
  }

  return { cube, nodes };
}
