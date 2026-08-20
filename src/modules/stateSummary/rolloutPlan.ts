/**
 * Rollout waves — the order the assessed states should be worked in.
 *
 * This is *derived sequencing*, and the distinction matters enough to be said
 * on screen as well as here. The assessment supplies no per-state schedule:
 * `ROADMAP_TEMPLATE` is a fixed activity list keyed on readiness band, and
 * every one of the 12 assessed states classifies to the same state-level band —
 * so a state-by-month grid built the obvious way paints twelve identical rows
 * and encodes nothing.
 *
 * What actually varies between the states is *composition*. The share of
 * facilities in the Not-ready band runs from roughly a fifth to well over four
 * fifths across the same twelve. A state whose facilities are mostly ready can
 * begin onboarding in month 1; a state whose facilities are mostly not ready
 * has to buy and install infrastructure first. That is the real difference, and
 * ordering by it is the one honest state-level plan the data supports.
 *
 * So: rank by composite readiness, cut into three waves, and let each wave say
 * how much of its population goes down the infrastructure track before anyone
 * is onboarded. Nothing here is a client-signed schedule and the UI must not
 * imply that it is.
 */

import type { AreaProfile, Band } from '@/lib/types';

export interface RolloutWave {
  /** 1-based. Wave 1 starts first. */
  n: number;
  /** "Months 1–2" — two months per wave across the template's six. */
  months: string;
  states: AreaProfile[];
  facilityCount: number;
  distribution: Record<Band, number>;
  /**
   * Facilities that cannot be onboarded until infrastructure is procured and
   * installed — everything not in the Ready band, which is what puts a state
   * late in the order in the first place.
   */
  infrastructureFirst: number;
  /** Composite readiness at the top and bottom of the wave, for the range. */
  readinessHigh: number | null;
  readinessLow: number | null;
}

const WAVE_MONTHS = ['Months 1–2', 'Months 3–4', 'Months 5–6'];

/** Composite readiness, falling back to the average score so a state missing
 *  the composite still sorts somewhere sensible rather than to the bottom. */
function rank(state: AreaProfile): number {
  return state.compositeReadiness ?? state.averageScore ?? 0;
}

/**
 * Split `n` items into `w` near-equal groups, larger groups first.
 * 12 into 3 gives 4/4/4; 8 gives 3/3/2; 2 gives 1/1 (two waves, not three with
 * an empty one).
 */
function partition(n: number, w: number): number[] {
  const groups = Math.min(w, n);
  if (groups <= 0) return [];
  const base = Math.floor(n / groups);
  const remainder = n % groups;
  return Array.from({ length: groups }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * @param states  Assessed (primary-evidence) states only. Secondary states have
 *   no facility findings to sequence and must not be waved in — being absent
 *   from the plan is the correct statement about them.
 */
export function buildRolloutWaves(states: AreaProfile[]): RolloutWave[] {
  const ordered = [...states].sort((a, b) => rank(b) - rank(a));
  const sizes = partition(ordered.length, 3);

  const waves: RolloutWave[] = [];
  let cursor = 0;

  sizes.forEach((size, i) => {
    const members = ordered.slice(cursor, cursor + size);
    cursor += size;

    const distribution: Record<Band, number> = {
      ready: 0,
      moderately_ready: 0,
      not_ready: 0,
    };
    for (const state of members) {
      for (const band of Object.keys(distribution) as Band[]) {
        distribution[band] += state.archetypeDistribution[band] ?? 0;
      }
    }

    const facilityCount = members.reduce((sum, s) => sum + s.facilityCount, 0);

    waves.push({
      n: i + 1,
      months: WAVE_MONTHS[i] ?? `Months ${i * 2 + 1}–${i * 2 + 2}`,
      states: members,
      facilityCount,
      distribution,
      infrastructureFirst: distribution.moderately_ready + distribution.not_ready,
      readinessHigh: members.length ? rank(members[0]!) : null,
      readinessLow: members.length ? rank(members[members.length - 1]!) : null,
    });
  });

  return waves;
}
