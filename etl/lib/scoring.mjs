/**
 * Scoring engine — the Node mirror of src/lib/{bands,archetype,themes}.ts.
 *
 * Kept deliberately separate rather than shared: the ETL runs against the
 * published workbook and must be able to *disagree* with it visibly, which is
 * how the validation gate earns its keep. The browser copy only ever recomputes
 * under user filters.
 */

// ---------------------------------------------------------------------------
// Bands
// ---------------------------------------------------------------------------

/**
 * Cut points under the v2 methodology.
 *
 * Not equal terciles — they come from `Updated Readiness Pivots` Table 6.2,
 * which crosswalks the deck's five-band scheme onto the three-band one:
 * Nascent (1.0–1.9) + Emerging (2.0–2.9) = Not ready; Developing (3.0–3.9) =
 * Moderately ready; Institutionalized (4.0–4.5) + Optimized (4.6–5.0) =
 * Ready. Verified against a sample row: a final score of exactly 2.9 carries
 * the sheet's own "Emerging" / "Not Ready" labels, confirming the lower cut
 * is inclusive at 2.9.
 */
export const BAND_LOWER_CUT = 2.9;
export const BAND_UPPER_CUT = 3.9;

export function toBand(score) {
  if (score == null || !Number.isFinite(score)) return null;
  if (score <= BAND_LOWER_CUT) return 'not_ready';
  if (score <= BAND_UPPER_CUT) return 'moderately_ready';
  return 'ready';
}

// ---------------------------------------------------------------------------
// Theme scores
// ---------------------------------------------------------------------------

export const CLASS_WEIGHT = { core: 0.7, supporting: 0.3, contextual: 0 };

function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/**
 * 0.7·mean(core) + 0.3·mean(supporting).
 *
 * A null indicator is *excluded* from its mean, never scored zero. Seven form
 * versions are in circulation (v6 → v12) and indicators added later are null
 * for early submissions — zeroing those would systematically penalise the
 * facilities visited first.
 */
export function computeThemeScore(indicators) {
  const core = mean(
    indicators.filter((i) => i.class === 'core' && i.score != null).map((i) => i.score),
  );
  const supporting = mean(
    indicators
      .filter((i) => i.class === 'supporting' && i.score != null)
      .map((i) => i.score),
  );

  if (core == null && supporting == null) {
    return { coreComponent: null, supportingComponent: null, score: null };
  }

  const coreComponent = core == null ? null : core * CLASS_WEIGHT.core;
  const supportingComponent =
    supporting == null ? null : supporting * CLASS_WEIGHT.supporting;

  return {
    coreComponent,
    supportingComponent,
    score: (coreComponent ?? 0) + (supportingComponent ?? 0),
  };
}

/**
 * The unit of every mean is a score *column*, not an indicator.
 *
 * Six of the workflow questions are asked once per service point and so carry
 * five score columns each. The published component columns average those five
 * individually — a facility with a device at four points out of five scores 4.2
 * on the device question's contribution, not one entry of 4.2 against one entry
 * for every other indicator. Averaging per indicator instead reweights the
 * service-point block by a factor of five and stops reproducing the published
 * theme score.
 */
export function readIndicatorCells(row, indicators) {
  const cells = [];
  for (const ind of indicators) {
    for (const column of ind.scoreColumns) {
      const v = row[column];
      cells.push({
        indicatorId: ind.id,
        themeId: ind.themeId,
        subThemeId: ind.subThemeId,
        class: ind.class,
        column,
        score: typeof v === 'number' ? v : null,
      });
    }
  }
  return cells;
}

/**
 * Sub-theme score — 70/30, renormalised by the weights actually present.
 *
 * ```
 * (0.7·mean(core) + 0.3·mean(supporting)) ÷ (0.7·hasCore + 0.3·hasSupporting)
 * ```
 *
 * The divisor is the difference from computeThemeScore, and it matters here in a
 * way it does not there. Six of the ten facility sub-themes hold indicators of
 * only one class. Applying the theme formula unchanged caps a core-only
 * sub-theme at 3.5 and a supporting-only one at 1.5, so
 * `workflow_transition.transition` — every one of whose indicators is supporting
 * — scored 0.08 nationally and rendered "not ready" on a 1–5 band scale. That is
 * an artefact of a missing denominator, not a finding, and it would have been
 * read as one.
 *
 * Renormalising keeps the 70/30 relative weighting, keeps the result on 1–5, and
 * collapses to the theme formula exactly when both classes are present. It does
 * mean a sub-theme score and a theme score are not computed identically — the
 * theme formula is fixed by the published workbook and cannot be touched. See
 * docs/SCORING.md, "Sub-theme scores are ours, not the workbook's".
 *
 * Sub-themes with no weighted indicator at all — Leadership's three, which are
 * state-level — are absent from the result rather than present as null, so the
 * explorer can tell "not scored here" from "scored, no answer".
 */
export function computeSubThemeScores(cells) {
  const bySubTheme = new Map();
  for (const cell of cells) {
    if (cell.class === 'contextual') continue;
    if (!bySubTheme.has(cell.subThemeId)) bySubTheme.set(cell.subThemeId, []);
    // Four columns encode their worst case as 0 where the scale's floor is 1:
    // paper_digital_transition (2,504 rows), the two
    // patient_info_duplicates_* columns, service_delivery_method and G6. The
    // published theme scores carry those zeros through, so computeThemeScore
    // must too — but a sub-theme built mostly from one of them lands below 1 and
    // is then rendered against a 1–5 band scale it is not on. Clamped to the
    // floor here, which does not change any facility's band and does keep the
    // number inside the range it is displayed in.
    bySubTheme
      .get(cell.subThemeId)
      .push(cell.score === 0 ? { ...cell, score: 1 } : cell);
  }

  const out = {};
  for (const [subThemeId, group] of bySubTheme) {
    const { coreComponent, supportingComponent } = computeThemeScore(group);
    const divisor =
      (coreComponent == null ? 0 : CLASS_WEIGHT.core) +
      (supportingComponent == null ? 0 : CLASS_WEIGHT.supporting);

    out[subThemeId] =
      divisor === 0 ? null : ((coreComponent ?? 0) + (supportingComponent ?? 0)) / divisor;
  }
  return out;
}

/** indicator id → its score, averaged over its columns where it has several. */
export function computeIndicatorScores(cells) {
  const byIndicator = new Map();
  for (const cell of cells) {
    if (!byIndicator.has(cell.indicatorId)) byIndicator.set(cell.indicatorId, []);
    if (cell.score != null) byIndicator.get(cell.indicatorId).push(cell.score);
  }

  const out = {};
  for (const [id, values] of byIndicator) {
    out[id] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Archetype
// ---------------------------------------------------------------------------

export const FACILITY_CORE_THEMES = ['technical_infrastructure', 'workforce_capacity'];
export const FACILITY_SUPPORTING_THEMES = ['workflow_transition', 'data_use_reporting'];
export const SUPPORTING_FLOOR = 2.5;

function minDefined(values) {
  const present = values.filter((v) => v != null && Number.isFinite(v));
  return present.length ? Math.min(...present) : null;
}

/**
 * Reproduces `final_facility_archetype` for 2,773 of 2,804 facilities (98.89%).
 *
 * Tested alternatives, with the exact tercile cut points:
 *   no supporting clause at all ....... 95.19%
 *   supporting floor fitted to 2.46 ... 99.00%   (3 facilities better; overfit)
 *   mean(all four themes) ............. 72.6%
 *   min(all four themes) .............. 69.3%
 *
 * The floor is held at a round 2.50 rather than the fitted 2.46 — the extra
 * three facilities are noise, and a fitted constant invites the reader to
 * believe the rule is more exact than it is. The 31 residual facilities follow
 * no tested formulation and are presumed manual overrides in the source
 * spreadsheet.
 *
 * The published column is what ships — this exists to explain a classification
 * and to recompute one when the user filters the population.
 */
export function classifyFacility(themeScores) {
  const core = minDefined(FACILITY_CORE_THEMES.map((t) => themeScores[t]));
  if (core == null) return null;
  const supporting = minDefined(FACILITY_SUPPORTING_THEMES.map((t) => themeScores[t]));

  if (core <= BAND_LOWER_CUT) return 'not_ready';
  if (core > BAND_UPPER_CUT && supporting != null && supporting >= SUPPORTING_FLOOR) {
    return 'ready';
  }
  return 'moderately_ready';
}

// ---------------------------------------------------------------------------
// Roll-up
// ---------------------------------------------------------------------------

const COMPOSITE_WEIGHT = { ready: 5, moderately_ready: 3, not_ready: 1 };

export function compositeReadiness(archetypes) {
  if (!archetypes.length) return null;
  return (
    archetypes.reduce((sum, a) => sum + (COMPOSITE_WEIGHT[a] ?? 0), 0) /
    archetypes.length
  );
}

/**
 * Count a list of bands into the three buckets.
 *
 * Called with facility archetypes for the overall roll-up and with banded theme
 * or sub-theme scores for a thematic node. Nulls are dropped rather than
 * bucketed, so the counts can sum to less than the population — which is why
 * every caller carries the population size separately.
 */
export function bandDistribution(bands) {
  const dist = { not_ready: 0, moderately_ready: 0, ready: 0 };
  for (const b of bands) if (b in dist) dist[b] += 1;
  return dist;
}

export function meanOrNull(values) {
  return mean(values.filter((v) => v != null && Number.isFinite(v)));
}
