/**
 * Programme constants.
 *
 * Coverage figures come from the ERA Figma home screen; state lists from the
 * scored dataset and the XLSForm `choices` sheet.
 */

import type { EvidenceGrade } from './types';

export const PROGRAMME = {
  title: 'EMR Readiness Assessment',
  subtitle:
    'Readiness findings across 36 states, 205 LGAs, and 2,808 healthcare facilities',
  partners: ['NPHCDA', 'NTBLCP', 'The Global Fund', 'Solina'],
} as const;

export const COVERAGE = {
  statesTotal: 37, // 36 + FCT
  statesPrimary: 12,
  statesSecondary: 25, // + FCT
  lgas: 205,
  facilitiesSampled: 2808,
  /** Rows carrying a computed archetype in ERA dataset_v4.xlsx. */
  facilitiesScored: 2804,
} as const;

/**
 * The 12 states with primary facility data collection.
 *
 * Everywhere else in Nigeria was covered by secondary desk review, which yields
 * state-level findings only. The distinction is load-bearing: a user comparing
 * Kano (444 facilities assessed) with a desk-reviewed state is comparing two
 * different kinds of claim, and the UI has to say so.
 */
export const PRIMARY_STATES = [
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Imo',
  'Jigawa',
  'Kano',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Oyo',
  'Rivers',
] as const;

export type PrimaryState = (typeof PRIMARY_STATES)[number];

/** Facilities per primary state, from the ODK export. Used for sanity checks. */
export const PRIMARY_STATE_FACILITY_COUNTS: Record<PrimaryState, number> = {
  Kano: 444,
  Anambra: 282,
  Jigawa: 267,
  Niger: 257,
  Oyo: 257,
  'Akwa Ibom': 250,
  Imo: 229,
  Adamawa: 201,
  Bauchi: 181,
  Lagos: 159,
  Nasarawa: 152,
  Rivers: 146,
};

export const ALL_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT',
  'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi',
  'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
  'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
] as const;

export const ZONES = [
  'north_central',
  'north_east',
  'north_west',
  'south_east',
  'south_south',
  'south_west',
] as const;

export const ZONE_LABELS: Record<(typeof ZONES)[number], string> = {
  north_central: 'North Central',
  north_east: 'North East',
  north_west: 'North West',
  south_east: 'South East',
  south_south: 'South South',
  south_west: 'South West',
};

export function evidenceGrade(state: string): EvidenceGrade {
  return (PRIMARY_STATES as readonly string[]).includes(state)
    ? 'primary'
    : 'secondary';
}

export const FUNCTIONALITY_LEVELS = [
  'Functional L1',
  'Functional L2',
  'Partially Functional',
] as const;

export const SERVICE_POINTS = [
  { id: 'registration', label: 'Registration' },
  { id: 'examination', label: 'Examination / triage' },
  { id: 'consultation', label: 'Consultation' },
  { id: 'laboratory', label: 'Laboratory' },
  { id: 'pharmacy', label: 'Pharmacy' },
] as const;

// ---------------------------------------------------------------------------
// Validation targets
// ---------------------------------------------------------------------------

/**
 * Published national figures from the assessment report.
 *
 * The ETL asserts against these. If a recomputed figure drifts, either the
 * inclusion rule or an indicator mapping is wrong — and stakeholders will be
 * holding the report next to the dashboard on day one.
 */
export const VALIDATION_TARGETS = {
  electricityAccessPct: 85.2,
  reliablePowerPct: 42.3,
  powerReadyPct: 34.8,
  internetAccessPct: 83,
  computingDevicePct: 82,
  emrTransitionedPct: 6,
  anyDigitalSystemPct: 44,
  /** Published archetype split across the 2,804 scored facilities. */
  archetypeCounts: { ready: 533, moderately_ready: 1838, not_ready: 433 },
  /** Minimum acceptable agreement between recomputed and published archetype. */
  minArchetypeAgreement: 0.99,
} as const;

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export const CURRENCY = { code: 'NGN', symbol: '₦', locale: 'en-NG' } as const;

/** Facility detail is fetched per-UUID; summary and aggregates load up front. */
export const DATA_PATHS = {
  snapshot: '/data/snapshot.json',
  facilitiesSummary: '/data/facilities-summary.json',
  facility: (uuid: string) => `/data/facilities/${uuid}.json`,
  states: '/data/states.json',
  lgas: '/data/lgas.json',
  national: '/data/national.json',
  indicators: '/data/indicators.json',
  requirements: '/data/requirements.json',
  labels: '/data/labels.json',
  explorerCube: '/data/explorer-cube.json',
  /** Fetched lazily — only when the explorer's indicator level is opened. */
  indicatorScores: '/data/indicator-scores.json',
  statesGeo: '/geo/nigeria-states.geojson',
  lgasGeo: '/geo/nigeria-lgas.geojson',
} as const;
