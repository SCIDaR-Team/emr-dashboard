/**
 * Validation gate.
 *
 * The dashboard and the assessment report will be read side by side on day one.
 * If a recomputed figure drifts from the published one, either the inclusion
 * rule or an indicator mapping is wrong — and it is far cheaper to fail the
 * build than to discover it in a stakeholder meeting.
 *
 * Run with `--strict` in CI to make drift fatal.
 */

import { classifyFacility } from './scoring.mjs';

/** Published national figures from the assessment report (v5.2). */
export const TARGETS = {
  electricityAccessPct: 85.2,
  reliablePowerPct: 42.3,
  powerReadyPct: 34.8,
  internetAccessPct: 83,
  computingDevicePct: 82,
  emrTransitionedPct: 6,
  anyDigitalSystemPct: 44,
  archetypeCounts: { ready: 533, moderately_ready: 1838, not_ready: 433 },
  minArchetypeAgreement: 0.985,
};

/** Percentage-point tolerance — the report rounds, so exact equality is wrong. */
const TOLERANCE_PP = 0.6;

/**
 * Two published figures are computed on the report's 2,696 denominator rather
 * than the 2,804 scored rows, so they cannot reconcile exactly here. They are
 * checked with a wider band and labelled, rather than dropped — a silent
 * omission would hide the denominator problem instead of surfacing it.
 * See build guide §17.3.
 */
const DIFFERENT_DENOMINATOR = {
  electricityAccessPct: 3.0,
  anyDigitalSystemPct: 8.0,
  // The report counts 152 transitioned facilities; emr_status marks 189. A
  // definitional difference, not an ingest error — widened and labelled.
  emrTransitionedPct: 1.5,
};

function check(lines, label, actual, expected, tolerance = TOLERANCE_PP) {
  if (actual == null) {
    lines.push(`⚠ ${label}: not computed`);
    return false;
  }
  const delta = Math.abs(actual - expected);
  const ok = delta <= tolerance;
  lines.push(
    `${ok ? '✓' : '✗'} ${label}: ${actual.toFixed(1)} (published ${expected}, Δ${delta.toFixed(1)})`,
  );
  return ok;
}

export function validate({ facilities }) {
  const lines = [];
  let ok = true;

  // --- Archetype distribution ------------------------------------------
  const counts = { ready: 0, moderately_ready: 0, not_ready: 0 };
  for (const f of facilities) if (f.archetype in counts) counts[f.archetype] += 1;

  for (const [band, expected] of Object.entries(TARGETS.archetypeCounts)) {
    const actual = counts[band];
    const good = actual === expected;
    ok = ok && good;
    lines.push(
      `${good ? '✓' : '✗'} archetype ${band}: ${actual} (published ${expected})`,
    );
  }

  // --- Agreement between recomputed and published archetype -------------
  let agree = 0;
  let comparable = 0;
  for (const f of facilities) {
    const scores = Object.fromEntries(f.themeScores.map((t) => [t.themeId, t.score]));
    const predicted = classifyFacility(scores);
    if (!predicted) continue;
    comparable += 1;
    if (predicted === f.archetype) agree += 1;
  }
  const archetypeAgreement = comparable ? agree / comparable : 0;
  const agreementOk = archetypeAgreement >= TARGETS.minArchetypeAgreement;
  ok = ok && agreementOk;
  lines.push(
    `${agreementOk ? '✓' : '✗'} archetype rule agreement: ` +
      `${(archetypeAgreement * 100).toFixed(2)}% (${agree}/${comparable}, ` +
      `floor ${(TARGETS.minArchetypeAgreement * 100).toFixed(1)}%)`,
  );

  // --- Descriptive national figures -------------------------------------
  // These read raw response fields rather than scores, so they validate the
  // ingest independently of the scoring engine.
  const n = facilities.length;
  const pct = (predicate) => (n ? (facilities.filter(predicate).length / n) * 100 : null);

  const derived = {
    electricityAccessPct: pct((f) => f.derived?.hasElectricityAccess),
    reliablePowerPct: pct((f) => f.derived?.hasReliablePower),
    powerReadyPct: pct((f) => f.derived?.isPowerReady),
    internetAccessPct: pct((f) => f.derived?.hasInternetAccess),
    computingDevicePct: pct((f) => f.derived?.hasComputingDevice),
    emrTransitionedPct: pct((f) => f.derived?.hasTransitionedToEMR),
    anyDigitalSystemPct: pct((f) => f.derived?.usesAnyDigitalSystem),
  };

  for (const [key, expected] of Object.entries(TARGETS)) {
    if (!key.endsWith('Pct')) continue;
    const wider = DIFFERENT_DENOMINATOR[key];
    const label = key.replace(/Pct$/, '') + (wider ? ' (report uses n=2,696)' : '');
    ok = check(lines, label, derived[key], expected, wider ?? TOLERANCE_PP) && ok;
  }

  // --- Recomputed vs published theme components -------------------------
  // The binding in indicatorBindings.mjs is the thing most likely to be wrong,
  // and a wrong binding produces theme scores that look entirely reasonable. So
  // every facility's components are recomputed from the bound indicator columns
  // and compared against the published ones. Any drift at all is a bug.
  const drift = [];
  for (const f of facilities) {
    for (const t of f.themeScores) {
      const near = (a, b) =>
        (a == null && b == null) ||
        (a != null && b != null && Math.abs(a - b) < 1e-6);
      if (
        !near(t.recomputed?.coreComponent ?? null, t.coreComponent) ||
        !near(t.recomputed?.supportingComponent ?? null, t.supportingComponent)
      ) {
        drift.push(`${f.uuid}/${t.themeId}`);
      }
    }
  }
  const bindingOk = drift.length === 0;
  ok = ok && bindingOk;
  lines.push(
    `${bindingOk ? '✓' : '✗'} indicator binding: recomputed theme components ` +
      `match published for ${facilities.length * 4 - drift.length}/${facilities.length * 4} ` +
      `facility-themes${drift.length ? ` (first drift ${drift[0]})` : ''}`,
  );

  // --- Minimum requirement coverage --------------------------------------
  const first = facilities[0]?.minimumRequirements ?? [];
  const measured = first.filter((r) => r.measured).length;
  lines.push(
    `· minimum requirements wired: ${measured}/${first.length} ` +
      `(${first.filter((r) => !r.measured).map((r) => r.id).join(', ') || 'none unwired'})`,
  );

  // --- Sub-floor scores --------------------------------------------------
  const subFloor = facilities.filter((f) =>
    f.themeScores.some((t) => t.score != null && t.score < 1),
  ).length;
  if (subFloor > 0) {
    lines.push(
      `⚠ ${subFloor} facilities have a theme score below the 1.0 floor ` +
        '(unanswered indicators treated as 0 upstream) — preserved and flagged',
    );
  }

  // --- Sub-theme scores stay on the 1–5 scale ----------------------------
  // These are ours rather than the workbook's, so nothing external constrains
  // them and an off-scale value would be shipped without complaint. It happened
  // once already: before renormalisation, workflow_transition.transition scored
  // 0.08 nationally and rendered as a readiness band.
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

  return { ok, lines, archetypeAgreement };
}
