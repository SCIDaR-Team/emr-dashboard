/**
 * Minimum EMR readiness requirements — pass/fail checks, separate from the 1-5
 * scoring, rendered as a per-theme checklist on the Facility Scorecard.
 *
 * The 24 checks are the ones shown in the ERA prototype (six per scored theme);
 * thresholds come from the assessment report's minimum-requirements slides.
 * Guide §3.9.
 *
 * Three kinds of answer, and the difference matters on screen:
 *
 *   met: true / false   measured
 *   met: null           not measurable from the instrument. Rendered "not
 *                       assessed", never as a failure — a requirement that
 *                       always fails looks like a finding rather than a gap in
 *                       the pipeline.
 *
 * Skipped questions need a judgement each time. Most of the Data Use checks are
 * only put to facilities that already run an EMR; a facility without one has not
 * "declined to answer", it demonstrably lacks built-in reporting, so a skip
 * there reads as false. Where a skip genuinely means unknown — the support
 * questions, which are only asked of facilities using digital systems at all —
 * it stays null. Each check below says which it uses and why.
 *
 * Two of the 24 have no source in the instrument at all and stay null: it never
 * asks how many staff were trained (only whether any were), and it never asks
 * about a unique patient identifier.
 */

import { hasOption, toNumber, tokenize } from './normalize.mjs';

const NOT_MEASURED = Symbol('not-measured');

export const REQUIREMENTS = [
  // --- A. Technical Infrastructure ---
  { id: 'ti.electricity', themeId: 'technical_infrastructure', label: '≥ 8–12 hours daily electricity' },
  { id: 'ti.wiring', themeId: 'technical_infrastructure', label: 'Safe wiring with dedicated sockets' },
  { id: 'ti.device_per_point', themeId: 'technical_infrastructure', label: '1 device per service point' },
  { id: 'ti.printer', themeId: 'technical_infrastructure', label: '1 printer per facility' },
  { id: 'ti.backup', themeId: 'technical_infrastructure', label: 'Daily automated data backup' },
  { id: 'ti.environment', themeId: 'technical_infrastructure', label: 'No environmental risks' },

  // --- B. Workforce Capacity ---
  { id: 'wf.all_trained', themeId: 'workforce_capacity', label: 'All staff should receive training' },
  { id: 'wf.role_specific', themeId: 'workforce_capacity', label: 'Training should be role specific' },
  { id: 'wf.literate', themeId: 'workforce_capacity', label: 'Staff should be digitally literate' },
  { id: 'wf.focal_person', themeId: 'workforce_capacity', label: 'Full time EMR focal person' },
  { id: 'wf.ict_support', themeId: 'workforce_capacity', label: 'ICT support person' },
  { id: 'wf.resolution_time', themeId: 'workforce_capacity', label: 'Issues resolved in 24–72h' },

  // --- C. Workflow & Transition ---
  { id: 'wk.digitizable', themeId: 'workflow_transition', label: 'Patient workflow can be digitized' },
  { id: 'wk.sop', themeId: 'workflow_transition', label: 'Documented SOP for workflow' },
  { id: 'wk.point_of_care', themeId: 'workflow_transition', label: 'Data must be captured at point of care' },
  { id: 'wk.records_shared', themeId: 'workflow_transition', label: 'Records shared across points' },
  { id: 'wk.unique_id', themeId: 'workflow_transition', label: 'Unique patient identifier' },
  { id: 'wk.no_duplicates', themeId: 'workflow_transition', label: 'No duplicate patient records' },

  // --- D. Data Use & Reporting ---
  { id: 'du.realtime', themeId: 'data_use_reporting', label: 'Real time data capture' },
  { id: 'du.quality', themeId: 'data_use_reporting', label: 'Data quality assurance' },
  { id: 'du.decisions', themeId: 'data_use_reporting', label: 'Data used for decision making' },
  { id: 'du.reporting', themeId: 'data_use_reporting', label: 'Built in reporting' },
  { id: 'du.exchange', themeId: 'data_use_reporting', label: 'Automated data exchange' },
  { id: 'du.feedback', themeId: 'data_use_reporting', label: 'Feedback improvement' },
];

/** ODK question codes the checks read, resolved once per build. */
const COLUMN_REFS = {
  minimumRequiredDevices: '=Minimum devices required',
  // "Verified compliant desktops, laptops and tablets" — deployable devices,
  // not "Total supported computing devices" (DI), which also counts
  // smartphones and devices needing repair. The requirement is "1 device per
  // service point", which reads as one *usable* device, not any device.
  computingDevices: '=Verified compliant desktops, laptops and tablets',
  backupMethod: 'L5',
  backupFrequency: 'L5.1',
  documentedSop: 'L6',
  collectionMethod: 'L1',
  dataUse: 'L9',
  qualityChecks: 'L13',
  emrReports: 'L14',
  dhis2Integration: 'L17.1',
  serviceImprovements: 'L16',
  priorDigitalUse: 'D3',
  trainingHeld: 'F4',
  trainingTopic: 'F4.3',
  totalStaff: 'G1',
  staffWithDigitalSkills: 'G5',
  digitalOverseer: 'G7',
  overseerFullTime: 'G7.1',
  issueResolutionRoute: 'G8',
  issueResolutionTime: 'G9',
  duplicateAcrossPoints: 'H3',
};

export function buildRequirementColumns(index, resolveColumn) {
  return Object.fromEntries(
    Object.entries(COLUMN_REFS).map(([key, ref]) => {
      const col = resolveColumn(ref, index);
      if (!col) throw new Error(`Minimum requirements: no column for ${ref} (${key})`);
      return [key, col];
    }),
  );
}

/** Conditions in the service-point checklist that are risks, not amenities. */
const ENVIRONMENTAL_RISKS = ['water_leaks', 'poor_ventilation'];

/** Training topics that bear on the job rather than on computers in general. */
const ROLE_SPECIFIC_TRAINING = [
  'emr_ehr_systems',
  'health_information_systems_dhis2',
  'digital_data_collection_tools',
  'service_delivery_telemedicine',
];

const str = (row, col) => String(row[col] ?? '').trim();

/**
 * id -> (context) => boolean | NOT_MEASURED
 *
 * `points` is the facility's five ServicePoint objects; `present` is the subset
 * that exists and routinely documents.
 */
const EVALUATORS = {
  // --- Technical Infrastructure ---
  'ti.electricity': ({ derived }) => derived.hasReliablePower,
  'ti.wiring': ({ derived }) => derived.hasFunctionalWiring,

  // The report's own rule, and the workbook does the arithmetic for us:
  // `minimum_required_devices` is one device per documenting service point.
  'ti.device_per_point': ({ row, cols }) => {
    const required = toNumber(row[cols.minimumRequiredDevices]);
    const available = toNumber(row[cols.computingDevices]);
    if (required == null || available == null) return NOT_MEASURED;
    return available >= required;
  },

  'ti.printer': ({ derived }) => derived.printerCount >= 1,

  // L5/L5.1 are only put to facilities that already run a digital system. A
  // facility that runs none has no automated backup — that is a fact, not a
  // skip — so it reads false. A facility that runs one and left the question
  // blank is genuinely unknown.
  'ti.backup': ({ row, cols }) => {
    const method = str(row, cols.backupMethod);
    if (!method) {
      return str(row, cols.priorDigitalUse) === 'no' ? false : NOT_MEASURED;
    }
    return method === 'automated' && str(row, cols.backupFrequency) === 'daily';
  },

  // Asked per service point, in the same checklist as desks and sockets.
  'ti.environment': ({ present }) => {
    const assessed = present.filter((p) => p.infrastructure.length);
    if (!assessed.length) return NOT_MEASURED;
    return !assessed.some((p) =>
      ENVIRONMENTAL_RISKS.some((risk) => p.infrastructure.includes(risk)),
    );
  },

  // --- Workforce Capacity ---
  // The instrument asks whether *any* staff were trained (F4), never how many.
  // "All staff" is not answerable from it, and answering it from F4 would report
  // one facility-wide yes as full coverage.
  'wf.all_trained': () => NOT_MEASURED,

  'wf.role_specific': ({ row, cols }) => {
    if (str(row, cols.trainingHeld) !== 'yes') return false;
    const topic = row[cols.trainingTopic];
    return ROLE_SPECIFIC_TRAINING.some((t) => hasOption(topic, t));
  },

  // G5 counts staff with basic digital skills, G1 the total technical
  // establishment. "Digitally literate" is read as full coverage of the latter.
  'wf.literate': ({ row, cols }) => {
    const skilled = toNumber(row[cols.staffWithDigitalSkills]);
    const total = toNumber(row[cols.totalStaff]);
    if (skilled == null || total == null || total === 0) return NOT_MEASURED;
    return skilled >= total;
  },

  // G7 is only asked where digital systems are in use; elsewhere nobody has been
  // assigned, which is the answer.
  'wf.focal_person': ({ row, cols }) => {
    const overseer = str(row, cols.digitalOverseer);
    if (!overseer || overseer === 'no_assigned') return false;
    return str(row, cols.overseerFullTime) === 'yes';
  },

  'wf.ict_support': ({ row, cols }) => {
    if (str(row, cols.digitalOverseer) === 'it_staff') return true;
    const route = str(row, cols.issueResolutionRoute);
    if (!route) return NOT_MEASURED;
    return route === 'resolved_internally';
  },

  // The requirement is 24–72h. The instrument's buckets stop at 48, so the two
  // fastest both clear it and `after_48h` is the only one that might not — it is
  // counted as a failure, which is the conservative reading.
  'wf.resolution_time': ({ row, cols }) => {
    const speed = str(row, cols.issueResolutionTime);
    if (!speed) return NOT_MEASURED;
    return speed === 'within_24h' || speed === '24_48h';
  },

  // --- Workflow & Transition ---
  // Digitisable means the documentation done at each point is enumerable — every
  // present service point named the tasks it performs.
  'wk.digitizable': ({ present }) => {
    if (!present.length) return NOT_MEASURED;
    return present.every((p) => p.tasks.length > 0);
  },

  'wk.sop': ({ row, cols }) => {
    const sop = str(row, cols.documentedSop);
    if (!sop) return str(row, cols.priorDigitalUse) === 'no' ? false : NOT_MEASURED;
    return sop === 'yes';
  },

  'wk.point_of_care': ({ present }) => {
    if (!present.length) return NOT_MEASURED;
    return present.every((p) => p.hasFunctionalDevice === true);
  },

  // Records can only move between points if every point is on the same system.
  // H2 lists the points that use one; the requirement is that it covers them all.
  'wk.records_shared': ({ present }) => {
    if (!present.length) return NOT_MEASURED;
    return present.every((p) => p.usesDigitalSystems);
  },

  // Never asked. No column in the instrument carries a patient identifier scheme.
  'wk.unique_id': () => NOT_MEASURED,

  'wk.no_duplicates': ({ row, cols }) => {
    const dup = str(row, cols.duplicateAcrossPoints);
    if (!dup) return NOT_MEASURED;
    return dup === 'no';
  },

  // --- Data Use & Reporting ---
  'du.realtime': ({ row, cols }) => {
    const method = str(row, cols.collectionMethod);
    if (!method) return NOT_MEASURED;
    return method === 'digital' || method === 'hybrid' || method === 'both';
  },

  // L13/L14/L17.1/L16 are EMR-only questions. No EMR means no built-in quality
  // checks, no built-in reporting and no DHIS2 exchange — false, not unknown.
  'du.quality': ({ row, cols }) => {
    const checks = tokenize(row[cols.qualityChecks]).filter((t) => t !== 'none');
    return checks.length > 0;
  },

  'du.decisions': ({ row, cols }) => {
    const uses = tokenize(row[cols.dataUse]).filter((t) => t !== 'rarely_used');
    if (!tokenize(row[cols.dataUse]).length) return NOT_MEASURED;
    return uses.length > 0;
  },

  'du.reporting': ({ row, cols }) => str(row, cols.emrReports) === 'yes',
  'du.exchange': ({ row, cols }) => str(row, cols.dhis2Integration) === 'yes',
  'du.feedback': ({ row, cols }) => str(row, cols.serviceImprovements) === 'yes',
};

export function deriveMinimumRequirements(row, derived, servicePoints, cols) {
  const present = servicePoints.filter((p) => p.present);
  const context = { row, derived, cols, points: servicePoints, present };

  return REQUIREMENTS.map((req) => {
    const evaluate = EVALUATORS[req.id];
    const result = evaluate ? evaluate(context) : NOT_MEASURED;
    return {
      ...req,
      met: result === NOT_MEASURED ? null : Boolean(result),
      measured: result !== NOT_MEASURED,
    };
  });
}
