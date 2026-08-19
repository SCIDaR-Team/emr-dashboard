/**
 * State → geopolitical zone.
 *
 * Nigeria's six zones are a fixed administrative fact, not something the
 * assessment measured, so they are declared here the same way `ALL_STATES` is
 * declared in rollup.mjs rather than read from a workbook. The facility rows do
 * carry a zone column, but only for the 12 assessed states — a national page
 * that filters by zone needs all 37, including the 25 that were desk-reviewed.
 *
 * Labels are title case to match the `zone` string on facility rows exactly:
 * the zone filter compares state profiles and facility rows against the same
 * selected value, and "North West" vs "north_west" would silently match
 * neither.
 *
 * `assertZonesAgreeWithFacilities` holds this table to the dataset for the 12
 * states the dataset can speak for — a hand-maintained map that has drifted
 * from its source is worse than no map.
 */

export const ZONE_NAMES = [
  'North Central',
  'North East',
  'North West',
  'South East',
  'South South',
  'South West',
];

/** All 37 (36 states + FCT), keyed by the state name used throughout the ETL. */
export const STATE_ZONE = {
  // North Central
  Benue: 'North Central',
  Kogi: 'North Central',
  Kwara: 'North Central',
  Nasarawa: 'North Central',
  Niger: 'North Central',
  Plateau: 'North Central',
  FCT: 'North Central',
  // North East
  Adamawa: 'North East',
  Bauchi: 'North East',
  Borno: 'North East',
  Gombe: 'North East',
  Taraba: 'North East',
  Yobe: 'North East',
  // North West
  Jigawa: 'North West',
  Kaduna: 'North West',
  Kano: 'North West',
  Katsina: 'North West',
  Kebbi: 'North West',
  Sokoto: 'North West',
  Zamfara: 'North West',
  // South East
  Abia: 'South East',
  Anambra: 'South East',
  Ebonyi: 'South East',
  Enugu: 'South East',
  Imo: 'South East',
  // South South
  'Akwa Ibom': 'South South',
  Bayelsa: 'South South',
  'Cross River': 'South South',
  Delta: 'South South',
  Edo: 'South South',
  Rivers: 'South South',
  // South West
  Ekiti: 'South West',
  Lagos: 'South West',
  Ogun: 'South West',
  Ondo: 'South West',
  Osun: 'South West',
  Oyo: 'South West',
};

export function zoneOf(stateName) {
  return STATE_ZONE[stateName] ?? null;
}

/**
 * Cross-check the table against the zone column on the facility rows.
 *
 * Returns the disagreements rather than throwing — the caller decides whether a
 * mismatch is fatal, in line with how the rest of the ETL reports drift.
 */
export function zoneDisagreements(facilities) {
  const observed = new Map();
  for (const f of facilities) {
    if (f.zone) observed.set(f.state, f.zone);
  }
  const out = [];
  for (const [state, zone] of observed) {
    if (STATE_ZONE[state] !== zone) {
      out.push({ state, declared: STATE_ZONE[state] ?? '(absent)', observed: zone });
    }
  }
  return out;
}
