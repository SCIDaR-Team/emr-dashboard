/**
 * Reshape section M into five ServicePoint objects.
 *
 * The instrument repeats the same nineteen questions for each of five service
 * points, and the export flattens that into 95 columns named M1.x through M5.x.
 * Nothing in the column names says which service point M3 is; the question text
 * does, in parentheses, inconsistently. So the mapping is declared here once.
 *
 * Vocabulary note: the second service point is 'triage' in the M-block, the
 * service-point score columns and H1/H2/H6, but 'examination' in H4 and H5. Both
 * tokens resolve to the canonical id `examination`, matching ServicePointId in
 * src/lib/types.ts. Getting this wrong silently drops the duplicate-documentation
 * flag for one point in five.
 */

import { toNumber, tokenize } from './normalize.mjs';

/**
 * Canonical id → how the source refers to it.
 *
 *   block    the M-block prefix (M1…M5)
 *   suffix   the token used in the per-service-point score column names, which
 *            is not the same word in every family — the laboratory is `lab`
 *            except in `lab_infra_score`, and the pharmacy is `pharm` except in
 *            `pharmacy_infra_score`. Those two are listed explicitly.
 *   tokens   what a multi-select answer calls this point
 */
export const SERVICE_POINTS = [
  {
    id: 'registration',
    label: 'Patient registration',
    block: 'M1',
    tokens: ['registration'],
    columns: {
      device: 'device_registration',
      digitalSkills: 'digital_skills_registration',
      otherPointStaff: 'other_point_staff_registration',
      infra: 'registration_infra_score',
      actionPlan: 'registration_infra_action_plan_score',
    },
  },
  {
    id: 'examination',
    label: 'Examination (triage)',
    block: 'M2',
    tokens: ['triage', 'examination'],
    columns: {
      device: 'device_triage',
      digitalSkills: 'digital_skills_triage',
      otherPointStaff: 'other_point_staff_triage',
      infra: 'triage_infra_score',
      actionPlan: 'triage_infra_action_plan_score',
    },
  },
  {
    id: 'consultation',
    label: 'Consultation',
    block: 'M3',
    tokens: ['consultation'],
    columns: {
      device: 'device_consultation',
      digitalSkills: 'digital_skills_consultation',
      otherPointStaff: 'other_point_staff_consultation',
      infra: 'consultation_infra_score',
      actionPlan: 'consultation_infra_action_plan_score',
    },
  },
  {
    id: 'laboratory',
    label: 'Laboratory',
    block: 'M4',
    tokens: ['laboratory', 'lab'],
    columns: {
      device: 'device_lab',
      digitalSkills: 'digital_skills_lab',
      otherPointStaff: 'other_point_staff_lab',
      infra: 'lab_infra_score',
      actionPlan: 'lab_infra_action_plan_score',
    },
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    block: 'M5',
    tokens: ['pharmacy', 'pharm'],
    columns: {
      device: 'device_pharm',
      digitalSkills: 'digital_skills_pharm',
      otherPointStaff: 'other_point_staff_pharm',
      infra: 'pharmacy_infra_score',
      actionPlan: 'pharm_infra_action_plan_score',
    },
  },
];

/**
 * The M-block question suffixes this reads, with the field each one fills.
 *
 * Two are irregular and are given a disambiguator: the laboratory block numbers
 * both "is there a functional device" and "if yes, what type" as M4.2, and the
 * consultation block numbers "specify other task" M3.1.1.1 rather than M3.1.1.
 */
const FIELDS = [
  ['tasks', '1'],
  ['hasFunctionalDevice', '2', { M4: 'M4.2~Is there a functional device' }],
  ['deviceTypes', '2.1', { M4: 'M4.2~If yes, what type' }],
  ['deviceSharing', '2.2'],
  ['sharedWith', '2.3'],
  ['digitalSystems', '3'],
  ['infrastructure', '4'],
  ['hasActionPlan', '5'],
  ['documentedBy', '6'],
  ['staffAlsoElsewhere', '6.1'],
  ['staffAlsoAt', '6.2'],
  ['totalStaff', '7'],
  ['permanentStaff', '7.1'],
  ['dedicatedStaff', '7.2'],
  ['canPerformDigitalTasks', '8'],
];

const yesNo = (v) => {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'yes') return true;
  if (s === 'no') return false;
  return null;
};

/** The section-H columns that say which points exist, and in what state. */
const ROSTER_REFS = {
  present: 'H1',
  digital: 'H2',
  duplicated: 'H4',
  hybrid: 'H5',
  bottleneck: 'H6',
};

/**
 * Resolve every section-M and section-H column once, at build time rather than
 * per facility.
 */
export function buildServicePointColumns(index, resolveColumn) {
  const need = (ref, what) => {
    const col = resolveColumn(ref, index);
    if (!col) throw new Error(`Service points: no column for ${ref} (${what})`);
    return col;
  };

  const roster = Object.fromEntries(
    Object.entries(ROSTER_REFS).map(([key, ref]) => [key, need(ref, key)]),
  );

  const points = SERVICE_POINTS.map((sp) => {
    const refs = {};
    for (const [field, suffix, irregular] of FIELDS) {
      refs[field] = need(irregular?.[sp.block] ?? `${sp.block}.${suffix}`, `${sp.id}.${field}`);
    }
    return { ...sp, refs };
  });

  return { roster, points };
}

/**
 * Which service points a multi-select answer names.
 *
 * `H1` and friends answer with space-delimited tokens; `not_applicable` and
 * `none` are answers, not service points.
 */
export function pointsNamed(cell) {
  const tokens = new Set(tokenize(cell));
  return new Set(
    SERVICE_POINTS.filter((sp) => sp.tokens.some((t) => tokens.has(t))).map((sp) => sp.id),
  );
}

/**
 * Build the five service points for one facility.
 *
 * `present` comes from H1 — the points that exist *and* routinely document.
 * A point that is absent still gets an object, with `present: false` and null
 * scores, so the scorecard's grid always has five cells and an absent point
 * reads as absent rather than as a gap in the data.
 */
export function buildServicePoints(row, { roster, points }) {
  const present = pointsNamed(row[roster.present]);
  const digital = pointsNamed(row[roster.digital]);
  const duplicated = pointsNamed(row[roster.duplicated]);
  const hybrid = pointsNamed(row[roster.hybrid]);
  const bottleneck = pointsNamed(row[roster.bottleneck]);

  return points.map((sp) => {
    const r = sp.refs;
    const num = (field) => toNumber(row[r[field]]);
    const score = (key) => {
      const v = row[sp.columns[key]];
      return typeof v === 'number' ? v : null;
    };

    return {
      id: sp.id,
      label: sp.label,
      present: present.has(sp.id),

      tasks: tokenize(row[r.tasks]),
      hasFunctionalDevice: yesNo(row[r.hasFunctionalDevice]),
      deviceTypes: tokenize(row[r.deviceTypes]),
      deviceShared: String(row[r.deviceSharing] ?? '').trim() === 'shared',
      sharedWith: tokenize(row[r.sharedWith]),

      usesDigitalSystems: digital.has(sp.id),
      digitalSystemName: String(row[r.digitalSystems] ?? '').trim() || null,

      infrastructure: tokenize(row[r.infrastructure]),
      hasActionPlan: String(row[r.hasActionPlan] ?? '').trim() === 'planned',

      documentedBy: String(row[r.documentedBy] ?? '').trim() || null,
      staffAlsoElsewhere: yesNo(row[r.staffAlsoElsewhere]),
      staffAlsoAt: tokenize(row[r.staffAlsoAt]),
      totalStaff: num('totalStaff'),
      permanentStaff: num('permanentStaff'),
      dedicatedStaff: num('dedicatedStaff'),
      canPerformDigitalTasks: yesNo(row[r.canPerformDigitalTasks]),

      hasDuplicateDocumentation: duplicated.has(sp.id),
      hasHybridDocumentation: hybrid.has(sp.id),
      hasBottleneck: bottleneck.has(sp.id),

      // The four indicator scores the workflow theme computes per service point.
      scores: {
        device: score('device'),
        digitalSkills: score('digitalSkills'),
        infrastructure: score('infra'),
        actionPlan: score('actionPlan'),
        sharedStaff: score('otherPointStaff'),
      },
    };
  });
}
