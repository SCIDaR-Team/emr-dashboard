/**
 * Roll facilities up to LGA, state and national.
 *
 * Only the 12 primary states get facility-derived aggregates. The other 25 plus
 * the FCT are emitted as secondary-evidence shells so the map can render them
 * honestly — present, distinguishable, and not drillable — rather than as
 * "no data", which would understate what is actually known about them.
 */

import { bandDistribution, compositeReadiness, meanOrNull, toBand } from './scoring.mjs';

const ALL_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT',
  'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi',
  'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
  'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

const THEME_IDS = [
  'technical_infrastructure',
  'workforce_capacity',
  'workflow_transition',
  'data_use_reporting',
  'leadership_governance',
];

/**
 * Mean sub-theme score across a set of facilities.
 *
 * The key set is taken from the facilities rather than declared, so a sub-theme
 * that turned out to have no weighted indicator is simply absent instead of
 * present and null. Leadership's three never appear here — they are state-level
 * and have no facility instrument behind them.
 */
function aggregateSubThemes(facilities) {
  const ids = new Set();
  for (const f of facilities) for (const id of Object.keys(f.subThemeScores ?? {})) ids.add(id);

  return Object.fromEntries(
    [...ids].sort().map((id) => [
      id,
      meanOrNull(facilities.map((f) => f.subThemeScores?.[id] ?? null)),
    ]),
  );
}

function aggregate({ id, level, name, parentId, facilities }) {
  const archetypes = facilities.map((f) => f.archetype).filter(Boolean);
  const themeScores = Object.fromEntries(
    THEME_IDS.map((themeId) => [
      themeId,
      meanOrNull(
        facilities.map(
          (f) => f.themeScores.find((t) => t.themeId === themeId)?.score ?? null,
        ),
      ),
    ]),
  );
  const averageScore = meanOrNull(facilities.map((f) => f.averageDomainScore));

  return {
    id,
    level,
    name,
    parentId,
    evidenceGrade: 'primary',
    facilityCount: facilities.length,
    archetypeDistribution: bandDistribution(archetypes),
    themeScores,
    subThemeScores: aggregateSubThemes(facilities),
    compositeReadiness: compositeReadiness(archetypes),
    averageScore,
    band: toBand(averageScore),
    investments: [],
    roadmap: [],
  };
}

function groupBy(items, key) {
  const map = new Map();
  for (const item of items) {
    const k = item[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

export function rollUp(facilities) {
  const byState = groupBy(facilities, 'stateId');

  const lgas = [];
  for (const [stateId, stateFacilities] of byState) {
    for (const [lgaId, lgaFacilities] of groupBy(stateFacilities, 'lgaId')) {
      lgas.push(
        aggregate({
          id: `${stateId}.${lgaId}`,
          level: 'lga',
          name: lgaFacilities[0].lga,
          parentId: stateId,
          facilities: lgaFacilities,
        }),
      );
    }
  }

  const assessed = new Set();
  const states = [];
  for (const [stateId, stateFacilities] of byState) {
    assessed.add(stateFacilities[0].state);
    const profile = aggregate({
      id: stateId,
      level: 'state',
      name: stateFacilities[0].state,
      parentId: null,
      facilities: stateFacilities,
    });
    profile.lgaCount = new Set(stateFacilities.map((f) => f.lgaId)).size;
    states.push(profile);
  }

  // Secondary-evidence states: present on the map, no facility aggregates.
  // TODO: populate themeScores and stateReadiness once the state-level
  // instrument output is supplied. Guide section 17.1.
  for (const name of ALL_STATES) {
    if (assessed.has(name)) continue;
    states.push({
      id: name.toLowerCase().replace(/\s+/g, '_'),
      level: 'state',
      name,
      parentId: null,
      evidenceGrade: 'secondary',
      facilityCount: 0,
      archetypeDistribution: { not_ready: 0, moderately_ready: 0, ready: 0 },
      themeScores: Object.fromEntries(THEME_IDS.map((t) => [t, null])),
      subThemeScores: {},
      compositeReadiness: null,
      averageScore: null,
      band: null,
      investments: [],
      roadmap: [],
    });
  }

  const national = aggregate({
    id: 'national',
    level: 'national',
    name: 'Nigeria',
    parentId: null,
    facilities,
  });
  national.lgaCount = lgas.length;

  return { lgas, states, national };
}
