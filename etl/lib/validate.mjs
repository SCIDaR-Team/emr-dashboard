/**
 * Validation gate — v2 methodology.
 *
 * The old gate compared every figure against the published assessment report,
 * because the workbook that produced it was the workbook this dashboard read.
 * That anchor is gone: the v2 workbook's own theme scores are marked "REVISED
 * — QA ONLY" and its archetype column "pending revised archetype rerun" — the
 * assessment team has not finished validating this methodology against
 * itself yet, so there is no external figure for the dashboard to reproduce.
 *
 * What still has an anchor:
 *
 *  - The raw-response flags (reliable power, power-ready, internet access,
 *    computing devices) read fields that did not change between workbook
 *    versions, and reproduce the same national report figures as before.
 *  - The device-gap figures in `ERA Data Analysis_Pivot Table` (row 475) are
 *    the workbook's own precomputed national total — a real cross-check even
 *    though it postdates the report.
 *  - The 20-indicator recomputation must reproduce each theme sheet's own
 *    "weighted Core/Supporting score" columns exactly — the same invariant
 *    the old gate held indicatorBindings.mjs to, now held against
 *    indicatorsV2.mjs instead.
 *
 * What has no anchor: the archetype distribution. It is reported for the
 * record, not checked against an expected count — flagged loudly below
 * rather than silently passing.
 *
 * Run with `--strict` in CI to make drift fatal.
 */

/** Raw-response figures — unaffected by the theme-scoring revision, since the
 *  fields validate.mjs reads for them (C1–C4, D1, E1) did not change. */
export const TARGETS = {
  electricityAccessPct: 85.2,
  reliablePowerPct: 42.3,
  powerReadyPct: 34.8,
  internetAccessPct: 83,
  computingDevicePct: 82,
};

const TOLERANCE_PP = 3.0;

function check(lines, label, actual, expected, tolerance = TOLERANCE_PP) {
  if (actual == null) {
    lines.push(`⚠ ${label}: not computed`);
    return false;
  }
  const delta = Math.abs(actual - expected);
  const ok = delta <= tolerance;
  lines.push(
    `${ok ? '✓' : '✗'} ${label}: ${actual.toFixed(1)} (report ${expected}, Δ${delta.toFixed(1)})`,
  );
  return ok;
}

/** The workbook's own national device-gap total — `ERA Data Analysis_Pivot
 *  Table` row 475, "SUM of Total number of EMR-compliant device" /
 *  "SUM of Minimum device required" / "Gap" / "Proportion met", Grand Total
 *  row: 4,331 / 10,316 / 5,985 / 42.0%. */
const DEVICE_GAP_TARGET = { available: 4331, required: 10316, metPct: 41.98 };

export function validate({ facilities }) {
  const lines = [];
  let ok = true;

  // --- Descriptive national figures -------------------------------------
  const n = facilities.length;
  const pct = (predicate) => (n ? (facilities.filter(predicate).length / n) * 100 : null);

  const derived = {
    electricityAccessPct: pct((f) => f.derived?.hasElectricityAccess),
    reliablePowerPct: pct((f) => f.derived?.hasReliablePower),
    powerReadyPct: pct((f) => f.derived?.isPowerReady),
    internetAccessPct: pct((f) => f.derived?.hasInternetAccess),
    computingDevicePct: pct((f) => f.derived?.hasComputingDevice),
  };

  for (const [key, expected] of Object.entries(TARGETS)) {
    ok = check(lines, key.replace(/Pct$/, ''), derived[key], expected) && ok;
  }

  // --- Device gap, against the workbook's own national pivot -------------
  // Informational, not a pass/fail gate: the pivot's 42.0% "proportion met"
  // is computed from the rubric's full TECH-CORE-04 rule (which provisionally
  // credits unverified-but-functional smartphones under some conditions —
  // see Facility Scoring Rubric_v2_WORK). `ti.device_per_point` uses the
  // stricter "verified compliant devices ≥ minimum required" reading, which
  // is the more defensible one for a pass/fail checklist item but will not
  // reproduce the pivot's figure exactly.
  const measurable = facilities.filter((f) =>
    f.minimumRequirements?.find((r) => r.id === 'ti.device_per_point')?.measured,
  );
  const metCount = measurable.filter(
    (f) => f.minimumRequirements.find((r) => r.id === 'ti.device_per_point').met,
  ).length;
  const metPct = measurable.length ? (metCount / measurable.length) * 100 : null;
  lines.push(
    `· ti.device_per_point met (verified devices ≥ minimum): ${metPct?.toFixed(1) ?? '—'}% ` +
      `— pivot's "proportion met" (fuller TECH-CORE-04 rule, incl. provisional smartphones): ${DEVICE_GAP_TARGET.metPct}%`,
  );

  // --- Recomputed vs the theme sheet's own weighted components -----------
  // The join in indicatorsV2.mjs is the thing most likely to be wrong, and a
  // wrong binding produces theme scores that look entirely reasonable. Every
  // facility's 20-indicator recomputation is compared against the theme
  // sheet's own "weighted Core/Supporting score" columns — not a published
  // figure, but the same sheet the indicator scores were read from.
  //
  // The sheet's own rule blanks a whole component when *any* of its
  // indicators is missing ("leave blank only when the required source
  // responses are genuinely missing" — Facility Scoring Rubric_v2_WORK).
  // computeThemeScore() instead means over whatever indicators are present,
  // by design (guide: seven form versions are in circulation and an
  // indicator added later is null on early submissions — treating that as a
  // gap to exclude, not a zero to average in). So a facility missing exactly
  // one indicator in an otherwise-populated class is EXPECTED to disagree —
  // the sheet leaves it blank, we fill in the mean of the rest — and that is
  // not a binding bug. Only a numeric disagreement where both sides have a
  // value is.
  const drift = [];
  let expectedGap = 0;
  for (const f of facilities) {
    for (const t of f.themeScores) {
      const compare = (recomputed, published) => {
        if (recomputed == null && published == null) return 'match';
        if (recomputed != null && published == null) return 'gap'; // sheet blanked it; expected
        if (recomputed == null && published != null) return 'drift'; // we have nothing the sheet does
        return Math.abs(recomputed - published) < 1e-6 ? 'match' : 'drift';
      };
      const results = [
        compare(t.recomputed?.coreComponent ?? null, t.coreComponent),
        compare(t.recomputed?.supportingComponent ?? null, t.supportingComponent),
      ];
      if (results.includes('drift')) drift.push(`${f.uuid}/${t.themeId}`);
      else if (results.includes('gap')) expectedGap += 1;
    }
  }
  const bindingOk = drift.length === 0;
  ok = ok && bindingOk;
  lines.push(
    `${bindingOk ? '✓' : '✗'} indicator binding: recomputed theme components ` +
      `agree with the sheet's own weighted components for ` +
      `${facilities.length * 4 - drift.length}/${facilities.length * 4} ` +
      `facility-themes${drift.length ? ` (first mismatch ${drift[0]})` : ''}` +
      (expectedGap ? ` · ${expectedGap} have a partial-data gap the sheet blanks and we fill in (expected)` : ''),
  );

  // --- Archetype distribution — reported, not checked ---------------------
  const counts = { ready: 0, moderately_ready: 0, not_ready: 0, null: 0 };
  for (const f of facilities) counts[f.archetype ?? 'null'] += 1;
  lines.push(
    `⚠ archetype distribution (computed, no external anchor — the workbook's ` +
      `own rerun is still pending): ready ${counts.ready} · moderately ready ` +
      `${counts.moderately_ready} · not ready ${counts.not_ready}` +
      (counts.null ? ` · unclassified ${counts.null}` : ''),
  );

  // --- Minimum requirement coverage --------------------------------------
  const first = facilities[0]?.minimumRequirements ?? [];
  const measured = first.filter((r) => r.measured).length;
  lines.push(
    `· minimum requirements wired: ${measured}/${first.length} ` +
      `(${first.filter((r) => !r.measured).map((r) => r.id).join(', ') || 'none unwired'})`,
  );

  // --- Sub-theme scores stay on the 1–5 scale ----------------------------
  const offScale = new Map();
  for (const f of facilities) {
    for (const [id, score] of Object.entries(f.subThemeScores ?? {})) {
      if (score != null && (score < 1 || score > 5)) {
        offScale.set(id, (offScale.get(id) ?? 0) + 1);
      }
    }
  }
  const scaleOk = offScale.size === 0;
  ok = ok && scaleOk;
  lines.push(
    scaleOk
      ? '✓ sub-theme scores: all within 1.0–5.0'
      : `✗ sub-theme scores outside 1.0–5.0: ${[...offScale]
          .map(([id, n]) => `${id} (${n})`)
          .join(', ')}`,
  );

  return { ok, lines };
}
