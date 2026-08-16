/**
 * The indicator matrix — the explorer's fourth thematic level.
 *
 * The cube (explorerCube.mjs) stops at sub-thematic areas: 15 nodes across
 * 3,122 geographies. Guide §8.1 puts one more level below that, single
 * indicators, and precomputing those into the cube is not the way to get them —
 * 50 more nodes over the same geographies would roughly quadruple a file that is
 * already 6.7 MB, to serve a level most sessions never open.
 *
 * So indicator cells are computed in the browser, from this: one row per
 * facility, one column per scored indicator. 537 KB raw, ~100 KB gzipped, and
 * the explorer fetches it only when a reader actually selects an indicator.
 *
 * Shape:
 *   {
 *     ids:        [indicatorId, ...]            column order
 *     answered:   [count, ...]                  facilities carrying a value
 *     byFacility: { uuid: [value | null, ...] } aligned to `ids`
 *   }
 *
 * The column order lives in this file's own `ids` — not in a separate constant
 * the client would have to keep in step — so a positional row can never be read
 * against the wrong header.
 *
 * **Values are deliberately unrounded.** They are means over the score columns
 * a facility actually answered, so a question asked once per service point at a
 * facility with three of the five present yields 11/3 — which is exactly
 * `BAND_UPPER_CUT`, and therefore Moderately ready. Rounded to *any* number of
 * decimal places 11/3 lands above the cut and the facility silently becomes
 * Ready. The long floats this preserves are 0.1% of the values and cost nothing
 * after gzip.
 */

/**
 * Every indicator the workbook actually scored.
 *
 * Keyed on having a score column rather than on weighting class, which admits
 * one indicator the four theme means exclude — `emr_transition_status`, carried
 * as contextual with `unscoredReason: 'scored_but_unweighted'`. It holds real
 * 1/3/5 data on the question most likely to be asked of this dashboard ("how
 * many facilities have already moved to an EMR?"), so it is offered and labelled
 * rather than dropped. Its class travels with it; the rail says which
 * indicators carry no weight.
 */
export function scoredIndicators(indicators) {
  return indicators.filter((i) => i.scoreColumns.length > 0);
}

export function buildIndicatorMatrix({ facilities, indicators }) {
  const scored = scoredIndicators(indicators);
  const ids = scored.map((i) => i.id);

  const answered = new Array(ids.length).fill(0);
  const byFacility = {};

  for (const facility of facilities) {
    const row = ids.map((id) => {
      const value = facility.indicatorScores?.[id];
      return typeof value === 'number' && Number.isFinite(value) ? value : null;
    });
    row.forEach((v, k) => {
      if (v !== null) answered[k] += 1;
    });
    byFacility[facility.uuid] = row;
  }

  return { ids, answered, byFacility };
}

/**
 * How many facilities carry a score for each indicator, folded back into the
 * indicator definitions.
 *
 * `indicators.json` is loaded up front; the matrix is not. Without this the
 * explorer's rail could only warn that an indicator is unanswerable *after* the
 * reader selected it and waited for a 100 KB download to resolve to nothing —
 * and a blank panel reads as "not ready", not as "never asked". Six indicators
 * are answered by fewer than a fifth of facilities and one
 * (`data_use_reporting.inefficiencies.q106`) by none at all, so this is a real
 * case, not a defensive one.
 */
export function attachAnsweredCounts(indicators, matrix) {
  const counts = new Map(matrix.ids.map((id, k) => [id, matrix.answered[k]]));
  return indicators.map((indicator) => ({
    ...indicator,
    answeredCount: counts.get(indicator.id) ?? 0,
  }));
}
