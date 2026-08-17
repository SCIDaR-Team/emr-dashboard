/**
 * Indicator catalog for the v2 scoring methodology.
 *
 * Unlike the v1 rubric (a 132-question CSV joined to ODK columns by hand in
 * `indicatorBindings.mjs`), `Facility Scoring Rubric_v2_WORK` names its own
 * indicator IDs, subdomains and Core/Supporting/Contextual class directly —
 * there is no colour-fill recovery problem to solve here. What it does not
 * give is the exact column header on the scoring sheet, so those are
 * transcribed by hand below, verified against every header in
 * `Tech.infr_readiness scoring` and its three siblings.
 *
 * 20 indicators enter a theme mean (8 Technical Infrastructure, 5 Workforce
 * Capacity, 4 Workflow & Transition, 3 Data Use & Reporting) — down from 94.
 * One indicator moved theme entirely: the per-service-point device question
 * (`FLOW-XDOM-01` in the rubric) now feeds `tech_core_04` (device
 * sufficiency) rather than a Workflow sub-score, which is why the Facility
 * Scorecard's service-point grid no longer carries a per-point score.
 *
 * Indicator scores are **not** restricted to {1, 3, 5} here — verified
 * against every column below: `tech_core_02` (wiring), `tech_sup_04` (data
 * backup) and `work_sup_01` (device use) take only {1, 3, 5}; every other
 * indicator genuinely spans {1, 2, 3, 4, 5}.
 */

const suffix = (label, kind) =>
  kind === 'score' ? `${label} — score` : `${label} — actual/derived facility response`;

/**
 * A handful of indicators use "actual facility response" (no "/derived")
 * verbatim in the sheet, rather than the more common "actual/derived
 * facility response". Declared explicitly rather than guessed.
 */
const EXACT_RESPONSE_LABEL = {
  tech_core_02: 'Functional electrical wiring — actual facility response',
  tech_sup_03: 'Routine digital-device maintenance — actual facility response',
  tech_sup_04: 'Data-backup capability — actual facility response',
  flow_sup_01: 'Staff willingness to transition fully to EMR — actual facility response',
};

let nextN = 0;

function scored(id, themeId, subdomain, label, cls) {
  nextN += 1;
  return {
    id,
    n: nextN,
    themeId,
    subThemeId: `${themeId}.${subdomain}`,
    label,
    class: cls,
    sourceColumns: [EXACT_RESPONSE_LABEL[id] ?? suffix(label, 'actual')],
    scoreColumns: [suffix(label, 'score')],
    servicePointIds: null,
    unscoredReason: null,
    rubricUnmatched: false,
    buckets: { 1: [], 2: [], 3: [], 4: [], 5: [] },
    rationale: '',
  };
}

function contextual(id, themeId, subdomain, label, note) {
  nextN += 1;
  return {
    id,
    n: nextN,
    themeId,
    subThemeId: `${themeId}.${subdomain}`,
    label,
    class: 'contextual',
    sourceColumns: [],
    scoreColumns: [],
    servicePointIds: null,
    unscoredReason: note ?? 'descriptive',
    rubricUnmatched: false,
    buckets: { 1: [], 2: [], 3: [], 4: [], 5: [] },
    rationale: '',
  };
}

export const INDICATORS_V2 = [
  // --- A. Technical Infrastructure ---------------------------------------
  scored('tech_core_01', 'technical_infrastructure', 'power', 'Operational power availability', 'core'),
  scored('tech_core_02', 'technical_infrastructure', 'power', 'Functional electrical wiring', 'core'),
  scored('tech_core_03', 'technical_infrastructure', 'connectivity', 'Connectivity readiness', 'core'),
  scored('tech_core_04', 'technical_infrastructure', 'devices', 'Supported computing-device sufficiency', 'core'),
  scored('tech_sup_01', 'technical_infrastructure', 'power_resilience', 'Secondary power resilience', 'supporting'),
  scored('tech_sup_02', 'technical_infrastructure', 'connectivity_resilience', 'Alternative internet resilience', 'supporting'),
  scored('tech_sup_03', 'technical_infrastructure', 'device_sustainability', 'Routine digital-device maintenance', 'supporting'),
  scored('tech_sup_04', 'technical_infrastructure', 'data_resilience', 'Data-backup capability', 'supporting'),
  contextual('tech_ctx_01', 'technical_infrastructure', 'connectivity_context', 'Network provider, coverage and speed-test evidence'),
  contextual('tech_ctx_02', 'technical_infrastructure', 'digital_use_context', 'Existing digital-health exposure and system type'),
  contextual('tech_ctx_03', 'technical_infrastructure', 'emr_context', 'Existing EMR status, architecture and reliability'),
  contextual('tech_ctx_04', 'technical_infrastructure', 'data_governance_context', 'Backup frequency, SOPs and stored-data security'),

  // --- B. Workforce Capacity ----------------------------------------------
  scored('work_core_01', 'workforce_capacity', 'digital_competency', 'Permanent-staff digital competency', 'core'),
  scored('work_core_02', 'workforce_capacity', 'roles_and_accountability', 'Health-records and digital-system oversight', 'core'),
  scored('work_sup_01', 'workforce_capacity', 'digital_familiarity', 'Regular staff digital-device use', 'supporting'),
  scored('work_sup_02', 'workforce_capacity', 'training_readiness', 'Recent and relevant digital-health training', 'supporting'),
  scored('work_sup_03', 'workforce_capacity', 'technical_support', 'Technical-issue resolution pathway', 'supporting'),
  contextual('work_ctx_01', 'workforce_capacity', 'digital_exposure', 'Devices staff commonly use'),
  contextual('work_ctx_02', 'workforce_capacity', 'training_design', 'Training frequency, modality and perceived effectiveness'),
  contextual('work_ctx_03', 'workforce_capacity', 'skills_and_barriers', 'Skills needing improvement and barriers to building capacity'),
  contextual('work_ctx_04', 'workforce_capacity', 'equity', 'Male and female technical-staff distribution'),

  // --- C. Workflow & Transition --------------------------------------------
  scored('flow_core_01', 'workflow_transition', 'documentation_integration', 'Repeated or parallel documentation', 'core'),
  scored('flow_core_02', 'workflow_transition', 'workflow_efficiency', 'Workflow delays or bottlenecks', 'core'),
  scored('flow_core_03', 'workflow_transition', 'service_point_environment', 'Minimum service-point physical conditions', 'core'),
  scored('flow_sup_01', 'workflow_transition', 'change_readiness', 'Staff willingness to transition fully to EMR', 'supporting'),
  contextual('flow_ctx_02', 'workflow_transition', 'remediation_planning', 'Plans to address identified service-point issues'),
  contextual('flow_ctx_03', 'workflow_transition', 'prior_implementation', 'Previous EMR transition and current implementation status'),
  contextual('flow_ctx_04', 'workflow_transition', 'staff_concerns', 'Staff concerns and support required during rollout'),
  contextual('flow_ctx_05', 'workflow_transition', 'digitisation_priorities', 'Service points that would benefit most from EMR'),
  contextual('flow_ctx_06', 'workflow_transition', 'patient_experience', 'Anticipated patient response and effect on experience'),
  contextual(
    'flow_xdom_01',
    'workflow_transition',
    'service_point_devices',
    'Functional devices, sharing and digital systems used at each service point',
    'scored_but_unweighted',
  ),

  // --- D. Data Use & Reporting ----------------------------------------------
  scored('data_core_01', 'data_use_reporting', 'routine_data_use', 'Structured routine-data use', 'core'),
  scored('data_core_02', 'data_use_reporting', 'data_quality_review', 'Data-validation meeting frequency', 'core'),
  scored('data_sup_01', 'data_use_reporting', 'use_of_routine_reports', 'Discussion of PHC service reports', 'supporting'),
  contextual('data_ctx_01', 'data_use_reporting', 'data_capture_modality', 'How routine data is primarily collected'),
  contextual('data_ctx_02', 'data_use_reporting', 'paper_system_constraints', 'Challenges with paper registers'),
  contextual('data_xdom_01', 'data_use_reporting', 'transition_planning', 'Plan to transition from paper to digital systems'),
  contextual('data_ctx_03', 'data_use_reporting', 'digital_platforms', 'Platforms used to store routine data'),
  contextual('data_xdom_02', 'data_use_reporting', 'data_backup_capability', 'Method used to back up routine data'),
  contextual('data_ctx_04', 'data_use_reporting', 'backup_practice', 'Frequency of digital data backup'),
  contextual('data_ctx_05', 'data_use_reporting', 'digital_operations', 'Documented SOPs for digital-system operations'),
  contextual('data_ctx_06', 'data_use_reporting', 'data_security', 'Security measures protecting stored data'),
  contextual('data_ctx_07', 'data_use_reporting', 'digital_system_constraints', 'Challenges using digital systems for data entry'),
  contextual('data_ctx_08', 'data_use_reporting', 'dashboards', 'Use and type of digital dashboards'),
  contextual('data_ctx_09', 'data_use_reporting', 'indicators_reviewed', 'Indicators most frequently reviewed'),
  contextual('data_ctx_10', 'data_use_reporting', 'existing_emr_functionality', 'EMR data-quality checks, reporting and analytics'),
];

/** id -> the theme sheet's own weighted-rollup column names. */
export const THEME_ROLLUP_COLUMNS = {
  technical_infrastructure: {
    core: 'Revised Technical Infrastructure weighted Core score (70%)',
    supporting: 'Revised Technical Infrastructure weighted Supporting score (30%)',
    score: 'Revised Technical Infrastructure final score',
    band: 'Revised Technical Infrastructure maturity band',
    readinessLevel: 'Revised Technical Infrastructure readiness level',
  },
  workforce_capacity: {
    core: 'Revised Workforce Capacity weighted Core score (70%)',
    supporting: 'Revised Workforce Capacity weighted Supporting score (30%)',
    score: 'Revised Workforce Capacity final score',
    band: 'Revised Workforce Capacity maturity band',
    readinessLevel: 'Revised Workforce Capacity readiness level',
  },
  workflow_transition: {
    core: 'Revised Workflow and Transition weighted Core score (70%)',
    supporting: 'Revised Workflow and Transition weighted Supporting score (30%)',
    score: 'Revised Workflow and Transition final score',
    band: 'Revised Workflow and Transition maturity band',
    readinessLevel: 'Revised Workflow and Transition readiness level',
  },
  data_use_reporting: {
    core: 'Revised Data Use and Reporting weighted Core score (70%)',
    supporting: 'Revised Data Use and Reporting weighted Supporting score (30%)',
    score: 'Revised Data Use and Reporting final score',
    band: 'Revised Data Use and Reporting maturity band',
    readinessLevel: 'Revised Data Use and Reporting readiness level',
  },
};

/** Sub-theme id -> short label, for the UI (Explorer rail, sub-theme legends). */
export const SUB_THEME_LABELS = Object.fromEntries(
  INDICATORS_V2.map((i) => [
    i.subThemeId,
    i.subThemeId
      .split('.')[1]
      .replace(/_/g, ' ')
      .replace(/^./, (c) => c.toUpperCase()),
  ]),
);
