/**
 * Build the facility records the dashboard serves.
 *
 * Reads the master sheet of ERA dataset_v4.xlsx and produces one object per
 * facility, carrying the published scores through unchanged and adding the
 * derived flags, indicator scores and service points the scorecard needs.
 *
 * Design rule: the published `final_facility_archetype` is authoritative and is
 * copied verbatim. The recomputed classification is stored alongside it so the
 * two can be compared, never so one silently overwrites the other. The same
 * holds for the theme scores — the published component columns are what ship,
 * and the recomputation from bound indicator columns is carried beside them and
 * asserted equal on every build.
 */

import {
  classifyFacility,
  computeIndicatorScores,
  computeSubThemeScores,
  computeThemeScore,
  meanOrNull,
  readIndicatorCells,
} from './scoring.mjs';
import { deriveMinimumRequirements } from './minimumRequirements.mjs';
import { deriveInvestments } from './investment.mjs';
import { buildServicePoints } from './servicePoints.mjs';
import { fixMojibake, hasOption, slugify, titleCaseName, toNumber } from './normalize.mjs';
import { normalizeBand, THEME_COLUMN_PREFIX } from '../sources/eraDataset.mjs';

const THEME_IDS = Object.keys(THEME_COLUMN_PREFIX);

/** Locate this theme's score / band columns by their name fragment. */
function themeColumns(columns, themeId) {
  const prefix = THEME_COLUMN_PREFIX[themeId];
  const find = (needle) =>
    columns.find(
      (c) => c.toLowerCase().startsWith(prefix) && c.toLowerCase().includes(needle),
    ) ?? null;
  return {
    core: find('core'),
    supporting: find('supporting'),
    score: find('final score'),
    band: find('maturity level'),
  };
}

function buildThemeScores(row, themeCols, cellsByTheme, indicatorScores) {
  return THEME_IDS.map((themeId) => {
    const cols = themeCols[themeId];
    const cells = cellsByTheme[themeId] ?? [];
    const recomputed = computeThemeScore(cells);

    return {
      themeId,
      coreComponent: cols.core ? toNumber(row[cols.core]) : null,
      supportingComponent: cols.supporting ? toNumber(row[cols.supporting]) : null,
      score: cols.score ? toNumber(row[cols.score]) : null,
      band: cols.band ? normalizeBand(row[cols.band]) : null,

      /**
       * Recomputed from the bound indicator columns and asserted equal to the
       * published components in validate.mjs. Build-time only — stripped by
       * toFacilityJSON() rather than shipped, since it is by construction the
       * same numbers as the two fields above it.
       */
      recomputed,

      subThemeScores: computeSubThemeScores(cells),
    };
  });
}

/**
 * Project a facility to the shape written to `public/data/facilities/<uuid>.json`.
 *
 * Two things are dropped: the recomputed theme components, which the validation
 * gate has already compared against the published ones, and the labels on the 24
 * minimum requirements, which are identical for every facility and are served
 * once from `requirements.json` instead. Together they are about half the bytes
 * of a facility shard, and the scorecard fetches one per page view.
 */
export function toFacilityJSON(facility) {
  return {
    ...facility,
    themeScores: facility.themeScores.map(({ recomputed, ...rest }) => rest),
    minimumRequirements: facility.minimumRequirements.map((r) => ({
      id: r.id,
      met: r.met,
      measured: r.measured,
    })),
  };
}

/** Column names on the master sheet, verified against ERA dataset_v4.xlsx. */
const COL = {
  gridConnected: 'C1. Is this facility connected to the national electricity grid?',
  gridHours:
    'C2. On average, how many hours per day does the facility receive electricity from the national grid?',
  backupStatus:
    'C3. Does the facility have a functional backup power source when electricity from the national grid is unavailable?',
  backupRuntime:
    'C3.2 When fully operational, how long does each backup power source typically provide electricity?',
  wiring:
    'C4. Does the facility have functional electrical wiring to support ICT and other digital equipment?',
  devices: 'D1. Which of the following digital devices are available in the facility?',
  printers: 'D1.13 How many printers are available?',
  internetAccess: 'E1. How does the facility primarily access the internet?',
  internetSpeed: 'Internet speed (download)',
  emrStatus: 'emr_status',
  priorDigitalUse: 'prior_use_digital_systems',
  devicesAvailable: 'computing_devices_available',
  servicePoints: 'number_service_points',
};

const ANY_HOURS = new Set(['1_4_hours', '5_8_hours', '9_12_hours', 'gt_12_hours']);
const NINE_PLUS_HOURS = new Set(['9_12_hours', 'gt_12_hours']);

const str = (v) => (v == null ? '' : String(v).trim());

/**
 * Descriptive flags, computed from raw responses rather than from scores.
 *
 * These validate the ingest independently of the scoring engine — if they match
 * the published national figures, the rows were read correctly whatever the
 * rubric mapping does. Definitions are the report's own:
 *
 *   reliable power  ≥9 hrs/day from grid, or a fully functional backup that
 *                   runs ≥9 hrs                                      → 42.3% ✓
 *   power-ready     reliable power AND fully functional wiring       → 34.8% ✓
 *
 * Both reproduce exactly on the 2,804-facility base. Electricity access does
 * not — the report computes that one on its 2,696 denominator, so it lands at
 * ~83% here. See build guide §17.3; do not bend the definition to close it.
 */
function deriveFlags(row) {
  const gridHours = str(row[COL.gridHours]);
  const backup = str(row[COL.backupStatus]);
  const backupRuntime = str(row[COL.backupRuntime]);
  const wiring = str(row[COL.wiring]);
  const internet = str(row[COL.internetAccess]);
  const devices = row[COL.devices];

  const hasBackup = backup !== '' && backup !== 'none';
  const backupIsFunctional = backup === 'fully_functional';
  const hasReliablePower =
    NINE_PLUS_HOURS.has(gridHours) ||
    (backupIsFunctional && NINE_PLUS_HOURS.has(backupRuntime));

  return {
    hasGridConnection: str(row[COL.gridConnected]) === 'yes',
    hasElectricityAccess: ANY_HOURS.has(gridHours) || hasBackup,
    hasReliablePower,
    isPowerReady: hasReliablePower && wiring === 'fully_functional',
    hasFunctionalWiring: wiring === 'fully_functional',

    hasInternetAccess: internet !== '' && internet !== 'no_internet',
    hasBackupInternet: str(row['E6. Is there another internet option available when the main one is not working?']) === 'yes',

    // "Computing device" excludes smartphones — the report counts laptops,
    // desktops and tablets only.
    hasComputingDevice:
      hasOption(devices, 'laptop') ||
      hasOption(devices, 'tablet') ||
      hasOption(devices, 'desktop') ||
      hasOption(devices, 'desktop_computers'),
    deviceCount: toNumber(row[COL.devicesAvailable]) ?? 0,
    servicePointCount: toNumber(row[COL.servicePoints]) ?? 0,
    printerCount: toNumber(row[COL.printers]) ?? 0,

    // emr_status is only populated (5) for facilities that have transitioned.
    hasTransitionedToEMR: toNumber(row[COL.emrStatus]) === 5,
    // Note: the report's 44% uses a 2,278 denominator, not 2,804.
    usesAnyDigitalSystem: toNumber(row[COL.priorDigitalUse]) === 5,
  };
}

/** ODK writes review state lower-case; the domain type is camelCase. */
const REVIEW_STATES = {
  approved: 'approved',
  hasissues: 'hasIssues',
  rejected: 'rejected',
  edited: 'edited',
};

export function buildFacilities({
  dataset,
  rubric,
  form,
  servicePointColumns,
  requirementColumns,
}) {
  const { rows, columns } = dataset;
  const facilities = [];

  // Resolve the theme score columns once rather than per facility — the lookup
  // is a scan over 379 headers and there are 2,804 rows.
  const themeCols = Object.fromEntries(
    THEME_IDS.map((themeId) => [themeId, themeColumns(columns, themeId)]),
  );
  const indicatorsByTheme = Object.fromEntries(
    THEME_IDS.map((themeId) => [
      themeId,
      rubric.indicators.filter((i) => i.themeId === themeId && i.scoreColumns.length),
    ]),
  );

  for (const row of rows) {
    const uuid = String(row['UUID'] ?? '').trim();
    if (!uuid) continue; // no stable key -> cannot be addressed or linked

    const cellsByTheme = Object.fromEntries(
      THEME_IDS.map((themeId) => [
        themeId,
        readIndicatorCells(row, indicatorsByTheme[themeId]),
      ]),
    );
    const allCells = Object.values(cellsByTheme).flat();
    const indicatorScores = computeIndicatorScores(allCells);

    const themeScores = buildThemeScores(row, themeCols, cellsByTheme, indicatorScores);
    const scoreMap = Object.fromEntries(themeScores.map((t) => [t.themeId, t.score]));

    const published = normalizeBand(row['final_facility_archetype']);
    const recomputed = classifyFacility(scoreMap);

    const state = String(row['State'] ?? '').trim();
    const lga = String(row['LGA'] ?? '').trim();
    const derived = deriveFlags(row);
    const servicePoints = buildServicePoints(row, servicePointColumns);

    facilities.push({
      uuid,
      // 2,783 distinct names across 2,804 rows — display only, never a key.
      name: form?.choiceLists?.facility?.[row['database_name']]
        ?? titleCaseName(row['database_name'] ?? row['Name of facility']),
      databaseName: String(row['Name of facility'] ?? ''),

      state: form?.choiceLists?.state?.[state] ?? titleCaseName(state),
      stateId: slugify(state),
      lga: form?.choiceLists?.lga?.[lga] ?? titleCaseName(lga),
      lgaId: slugify(lga),
      zone: titleCaseName(row['Geopolitical zone']),
      geography: String(row['Geography'] ?? '').toLowerCase() === 'urban' ? 'urban' : 'rural',
      lat: toNumber(row['Latitude']),
      lon: toNumber(row['Longitude']),

      functionalityLevel: String(row['Functionality level'] ?? '').trim(),
      isBHCPF: String(row['BHCPF/NON-BHCPF'] ?? '').trim().toUpperCase() === 'BHCPF',
      oicName: String(row['B1. What is the name of the officer in charge of the health facility?'] ?? ''),
      oicCadre: titleCaseName(row['B3. What is the cadre of the Officer-in-Charge of the health facility?']),
      patientConsultations: fixMojibake(String(row['B7. How many patient consultations does this facility conduct on a typical day?'] ?? '')),

      themeScores,
      subThemeScores: computeSubThemeScores(allCells),
      indicatorScores,
      averageDomainScore: meanOrNull(themeScores.map((t) => t.score)),

      archetype: published,
      recomputedArchetype: recomputed,
      // 31 of 2,804 follow no tested rule — presumed manual overrides. Flagged
      // so a later recompute cannot silently "correct" them.
      archetypeIsOverride: Boolean(published && recomputed && published !== recomputed),

      minimumRequirements: deriveMinimumRequirements(
        row,
        derived,
        servicePoints,
        requirementColumns,
      ),
      servicePoints,
      investments: deriveInvestments(row, derived),

      derived,
      submissionDate: String(row['Submission date'] ?? ''),
      formVersion: String(row['FormVersion'] ?? '').trim(),
      reviewState:
        REVIEW_STATES[String(row['ReviewState'] ?? '').trim().toLowerCase()] ?? null,
    });
  }

  return facilities;
}
