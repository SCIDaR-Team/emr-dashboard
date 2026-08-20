/**
 * Scale helpers shared by the measurement components.
 *
 * Split out of `components/ui/Meter.tsx` for the same reason `dataContext.ts`
 * is split out of `DataProvider.tsx`: Vite's Fast Refresh cannot preserve state
 * across an edit to a file that mixes components with other exports.
 */

import { stepFor } from '@/components/map/mapTypes';
import type { GeoDatum } from '@/components/map/mapTypes';
import { BAND_LABEL } from './bands';
import { formatCount } from './format';
import type { AreaProfile } from './types';

/** The 1–5 rubric floor. Bars are anchored here, not at zero: no facility can
 *  score 0, and anchoring at zero compresses the whole scale into its top
 *  four-fifths. Every axis that uses it says so. */
export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

export function scorePct(v: number, lo = SCORE_MIN, hi = SCORE_MAX): number {
  return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
}

/**
 * Share-not-ready per state, as a sequential choropleth keyed by state id.
 *
 * The domain is fitted to the assessed states rather than to 0–100. Two
 * reasons, and the first is the important one: every assessed state classifies
 * to the *same* state-level band, so a band choropleth here paints twelve
 * identical polygons and encodes exactly one value. Share varies — 21% to 86% —
 * so the ramp has something to say. And over a fixed 0–100 domain eight of the
 * twelve fall in one step, which throws that away again; the legend prints the
 * fitted bounds so nothing is hidden.
 */
/**
 * State readiness band per state, as a categorical choropleth keyed by state id.
 *
 * The counterpart to `buildShareMap` below, and deliberately not the default:
 * it ships **no** `step`, so each polygon fills from its own readiness band
 * rather than from the sequential ramp.
 *
 * Every one of the 12 assessed states currently classifies to the same
 * state-level band, so this paints twelve polygons in one colour. That is the
 * encoding doing its job, not failing at it — the map says "the assessed
 * country is uniformly moderately ready", which is the actual finding, where
 * the ramp says how the not-ready facilities are distributed inside it. Pick
 * the one that matches the sentence the card is making.
 *
 * Pair with `BandLegend`, never `ScaleLegend`: there is no domain to print.
 */
export function buildBandMap(states: AreaProfile[]): Record<string, GeoDatum> {
  const data: Record<string, GeoDatum> = {};
  for (const s of states) {
    data[s.id] = {
      band: s.band,
      n: s.facilityCount,
      evidenceGrade: s.evidenceGrade,
      label: s.name,
      valueLabel:
        s.band && s.averageScore != null
          ? `${BAND_LABEL[s.band]} — ${s.averageScore.toFixed(2)} average across ${formatCount(
              s.facilityCount,
            )} facilities`
          : undefined,
    };
  }
  return data;
}

export function buildShareMap(states: AreaProfile[]) {
  const shares = new Map<string, number>();
  for (const s of states) {
    if (s.evidenceGrade !== 'primary' || !s.facilityCount) continue;
    shares.set(s.id, ((s.archetypeDistribution.not_ready ?? 0) / s.facilityCount) * 100);
  }
  const values = [...shares.values()];
  const lo = values.length ? Math.floor(Math.min(...values)) : 0;
  const hi = values.length ? Math.ceil(Math.max(...values)) : 100;

  const data: Record<string, GeoDatum> = {};
  for (const s of states) {
    const share = shares.get(s.id) ?? null;
    data[s.id] = {
      band: s.band,
      n: s.facilityCount,
      evidenceGrade: s.evidenceGrade,
      label: s.name,
      step: stepFor(share, lo, hi),
      valueLabel:
        share != null
          ? `${share.toFixed(1)}% not ready (${formatCount(
              s.archetypeDistribution.not_ready,
            )} of ${formatCount(s.facilityCount)})`
          : undefined,
    };
  }
  return { data, lo, hi };
}
