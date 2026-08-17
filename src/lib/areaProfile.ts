/**
 * Combine several AreaProfiles (states) into one, weighted by facility count.
 *
 * Needed wherever a page lets a reader narrow to an arbitrary *subset* of
 * states — not just "all" (the precomputed national profile) or "exactly
 * one" (a single precomputed state profile), both of which already exist in
 * `states.json`/`national.json`. Selecting two states, or filtering by a
 * readiness band that several states happen to share, lands in between —
 * without this, that combination silently fell back to showing the full
 * national figures, which read as the filter doing nothing.
 */

import { toBand } from './bands';
import { THEMES } from './themes';
import type { AreaProfile, Band, InvestmentItem, ThemeId } from './types';

const BANDS: Band[] = ['ready', 'moderately_ready', 'not_ready'];

function weightedMean(
  profiles: AreaProfile[],
  pick: (p: AreaProfile) => number | null,
): number | null {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const p of profiles) {
    const value = pick(p);
    if (value == null || p.facilityCount <= 0) continue;
    weightedSum += value * p.facilityCount;
    weightTotal += p.facilityCount;
  }
  return weightTotal ? weightedSum / weightTotal : null;
}

function sumInvestments(profiles: AreaProfile[]): InvestmentItem[] {
  const byId = new Map<string, InvestmentItem>();
  for (const p of profiles) {
    for (const item of p.investments) {
      const existing = byId.get(item.id);
      if (existing) {
        existing.quantity += item.quantity;
        existing.facilityCount = (existing.facilityCount ?? 0) + (item.facilityCount ?? 0);
      } else {
        byId.set(item.id, { ...item });
      }
    }
  }
  return [...byId.values()].sort((a, b) => b.quantity - a.quantity);
}

/**
 * A partial AreaProfile — enough for every panel that reads one (domain
 * scores, investments, roadmap). Not a real geography, so no `id`/`level`/
 * `parentId`/`evidenceGrade` — callers that need those already have the
 * individual profiles this was built from.
 */
export interface AggregatedProfile {
  facilityCount: number;
  averageScore: number | null;
  band: Band | null;
  themeScores: Record<ThemeId, number | null>;
  archetypeDistribution: Record<Band, number>;
  compositeReadiness: number | null;
  investments: InvestmentItem[];
}

export function aggregateAreaProfiles(profiles: AreaProfile[]): AggregatedProfile {
  const facilityCount = profiles.reduce((sum, p) => sum + p.facilityCount, 0);
  const averageScore = weightedMean(profiles, (p) => p.averageScore);

  const themeScores = Object.fromEntries(
    THEMES.map((t) => [t.id, weightedMean(profiles, (p) => p.themeScores[t.id])]),
  ) as Record<ThemeId, number | null>;

  const archetypeDistribution: Record<Band, number> = {
    ready: 0,
    moderately_ready: 0,
    not_ready: 0,
  };
  for (const p of profiles) {
    for (const band of BANDS) archetypeDistribution[band] += p.archetypeDistribution[band];
  }

  return {
    facilityCount,
    averageScore,
    band: toBand(averageScore),
    themeScores,
    archetypeDistribution,
    compositeReadiness: weightedMean(profiles, (p) => p.compositeReadiness),
    investments: sumInvestments(profiles),
  };
}
