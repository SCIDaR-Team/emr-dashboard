/**
 * Build the facility records the dashboard serves — v2 methodology.
 *
 * Reads the merged master+theme-sheet row (see eraDatasetV2.mjs) and produces
 * one object per facility. Two things differ from the v1 pipeline this
 * replaces:
 *
 *  - Theme scores are read directly from each theme sheet's own "Revised
 *    ... weighted Core/Supporting/final score" columns, not recomputed from
 *    indicator cells and compared against a "published" figure — this
 *    workbook's own theme sheet *is* the computation. The 20-indicator
 *    recomputation in scoring.mjs still runs and is asserted equal in
 *    validate.mjs, catching a wrong indicatorsV2.mjs binding the same way
 *    the old published-vs-recomputed check caught a wrong
 *    indicatorBindings.mjs entry.
 *  - There is no verbatim "published archetype" to carry through. The
 *    workbook's own archetype column is explicitly labelled "pending revised
 *    archetype rerun" — the assessment team has not re-run their own
 *    classification against these revised scores yet. So `archetype` here is
 *    computed, not copied, using the same core/supporting rule as before
 *    with the v2 cut points. There is nothing to flag as an "override"
 *    against, so that field is gone.
 */

import {
  classifyFacility,
  computeIndicatorScores,
  computeSubThemeScores,
  computeThemeScore,
  meanOrNull,
  readIndicatorCells,
  toBand,
} from './scoring.mjs';
import { deriveMinimumRequirements } from './minimumRequirements.mjs';
import { deriveInvestments } from './investment.mjs';
import { buildServicePoints } from './servicePoints.mjs';
import { normalizeBand } from '../sources/eraDataset.mjs';
import { INDICATORS_V2, THEME_ROLLUP_COLUMNS } from './indicatorsV2.mjs';
import { fixMojibake, hasOption, slugify, titleCaseName, toNumber } from './normalize.mjs';

const THEME_IDS = Object.keys(THEME_ROLLUP_COLUMNS);

function buildThemeScores(row, cellsByTheme) {
  return THEME_IDS.map((themeId) => {
    const cols = THEME_ROLLUP_COLUMNS[themeId];
    const cells = cellsByTheme[themeId] ?? [];
    const recomputed = computeThemeScore(cells);

    return {
      themeId,
      coreComponent: toNumber(row[cols.core]),
      supportingComponent: toNumber(row[cols.supporting]),
      score: toNumber(row[cols.score]),
      band: normalizeBand(row[cols.band]) ?? toBand(toNumber(row[cols.score])),

      /** Build-time only — stripped by toFacilityJSON(). Asserted equal to
       *  the sheet's own weighted components in validate.mjs. */
      recomputed,

      subThemeScores: computeSubThemeScores(cells),
    };
  });
}

/**
 * Project a facility to the shape written to `public/data/facilities/<uuid>.json`.
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

/** Column names on the merged row — raw ODK block, unchanged from v1. */
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
  backupInternet: 'E6. Is there another internet option available when the main one is not working?',
  priorDigitalUse: 'D3. Has this facility used any digital health system before?',
  transitionedToEMR:
    'I1. Has this facility previously transitioned from paper-based records to an EMR system?',
  devicesAvailable: 'Total supported computing devices',
  verifiedCompliantDevices: 'Verified compliant desktops, laptops and tablets',
  minimumDevicesRequired: 'Minimum devices required',
  servicePoints: 'Number of documenting service points',
};

const ANY_HOURS = new Set(['1_4_hours', '5_8_hours', '9_12_hours', 'gt_12_hours']);
const NINE_PLUS_HOURS = new Set(['9_12_hours', 'gt_12_hours']);

const str = (v) => (v == null ? '' : String(v).trim());

/**
 * Descriptive flags, computed from raw responses rather than from scores —
 * the same definitions as v1, since the raw ODK block these read did not
 * change between workbook versions. `reliablePower`/`powerReady` reproduce
 * the new workbook's own "Six Key Readiness Indicators" pivot exactly
 * (34.8% power-ready, verified against `ERA Data Analysis_Pivot Table`
 * row 31), confirming the raw fields carried over unchanged.
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
    hasBackupInternet: str(row[COL.backupInternet]) === 'yes',

    hasComputingDevice:
      hasOption(devices, 'laptop') ||
      hasOption(devices, 'tablet') ||
      hasOption(devices, 'desktop') ||
      hasOption(devices, 'desktop_computers'),
    deviceCount: toNumber(row[COL.devicesAvailable]) ?? 0,
    /** The device-per-point requirement's own numbers — "1 device per service
     *  point" reads as one *usable* device, so the gap for investment
     *  purposes is against the verified-compliant count, not the raw total. */
    verifiedCompliantDeviceCount: toNumber(row[COL.verifiedCompliantDevices]) ?? 0,
    minimumRequiredDeviceCount: toNumber(row[COL.minimumDevicesRequired]) ?? 0,
    servicePointCount: toNumber(row[COL.servicePoints]) ?? 0,
    printerCount: toNumber(row[COL.printers]) ?? 0,

    hasTransitionedToEMR: str(row[COL.transitionedToEMR]) === 'yes',
    usesAnyDigitalSystem: str(row[COL.priorDigitalUse]) === 'yes',
  };
}

const REVIEW_STATES = {
  approved: 'approved',
  hasissues: 'hasIssues',
  rejected: 'rejected',
  edited: 'edited',
};

export function buildFacilities({ dataset, form, servicePointColumns, requirementColumns }) {
  const { rows } = dataset;
  const facilities = [];

  const indicatorsByTheme = Object.fromEntries(
    THEME_IDS.map((themeId) => [
      themeId,
      INDICATORS_V2.filter((i) => i.themeId === themeId && i.scoreColumns.length),
    ]),
  );

  for (const row of rows) {
    const uuid = String(row['UUID'] ?? '').trim();
    if (!uuid) continue;

    const cellsByTheme = Object.fromEntries(
      THEME_IDS.map((themeId) => [
        themeId,
        readIndicatorCells(row, indicatorsByTheme[themeId]),
      ]),
    );
    const allCells = Object.values(cellsByTheme).flat();
    const indicatorScores = computeIndicatorScores(allCells);

    const themeScores = buildThemeScores(row, cellsByTheme);
    const scoreMap = Object.fromEntries(themeScores.map((t) => [t.themeId, t.score]));
    const archetype = classifyFacility(scoreMap);

    const state = String(row['State'] ?? '').trim();
    const lga = String(row['LGA'] ?? '').trim();
    const derived = deriveFlags(row);
    const servicePoints = buildServicePoints(row, servicePointColumns);
    const minimumRequirements = deriveMinimumRequirements(
      row,
      derived,
      servicePoints,
      requirementColumns,
    );

    facilities.push({
      uuid,
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

      archetype,

      minimumRequirements,
      servicePoints,
      investments: deriveInvestments(minimumRequirements, derived, servicePoints),

      derived,
      submissionDate: String(row['Submission date'] ?? ''),
      formVersion: String(row['FormVersion'] ?? '').trim(),
      reviewState:
        REVIEW_STATES[String(row['ReviewState'] ?? '').trim().toLowerCase()] ?? null,
    });
  }

  return facilities;
}
