/**
 * The thematic hierarchy: 5 thematic areas → sub-thematic areas → indicators.
 *
 * The four facility-level themes were reshaped by the v2 scoring methodology
 * (`Facility Scoring Rubric_v2_WORK`): 94 scored indicators consolidated to
 * 20, and sub-thematic areas are now close to 1:1 with indicators rather than
 * grouping many questions under one heading. `SUB_THEMES` below lists only
 * the 19 sub-themes that carry a scored (core or supporting) indicator —
 * `computeSubThemeScores` never produces a score for a sub-theme built
 * entirely of contextual indicators, so a contextual-only subdomain would be
 * a rail entry that always resolves to nothing. Leadership & Governance is
 * untouched by v2 — it has no facility instrument and keeps its original
 * three sub-themes.
 *
 * Question *content* is loaded at runtime from the generated indicators.json
 * — this module holds only the structure, which the Drill-Down Explorer
 * navigates.
 */

import type { ThemeId, IndicatorClass, IndicatorDef, ThemeNodeId } from './types';

export interface ThemeDef {
  id: ThemeId;
  /** Letter used in the assessment's archetype rules (A–E). */
  code: 'A' | 'B' | 'C' | 'D' | 'E';
  label: string;
  shortLabel: string;
  role: 'core' | 'supporting';
  /** False for Leadership & Governance, which has no facility instrument. */
  facilityLevel: boolean;
  questionCount: number;
  /** Icon name from lucide-react. */
  icon: string;
}

/**
 * Naming note: the deck says "Leadership & Governance", the rubric says
 * "Leadership and Coordination", the Figma says "Leadership and governance".
 * The FRS wording wins for display; the aliases are resolved during ETL.
 */
export const THEMES: readonly ThemeDef[] = [
  {
    id: 'technical_infrastructure',
    code: 'A',
    label: 'Technical Infrastructure',
    shortLabel: 'Tech. Infrastructure',
    role: 'core',
    facilityLevel: true,
    questionCount: 12,
    icon: 'Network',
  },
  {
    id: 'workforce_capacity',
    code: 'B',
    label: 'Workforce Capacity',
    shortLabel: 'Workforce',
    role: 'core',
    facilityLevel: true,
    questionCount: 9,
    icon: 'Users',
  },
  {
    id: 'workflow_transition',
    code: 'C',
    label: 'Workflow & Transition',
    shortLabel: 'Workflow',
    role: 'supporting',
    facilityLevel: true,
    questionCount: 10,
    icon: 'Workflow',
  },
  {
    id: 'data_use_reporting',
    code: 'D',
    label: 'Data Use & Reporting',
    shortLabel: 'Data Use',
    role: 'supporting',
    facilityLevel: true,
    questionCount: 15,
    icon: 'BarChart3',
  },
  {
    id: 'leadership_governance',
    code: 'E',
    label: 'Leadership & Governance',
    shortLabel: 'Leadership',
    role: 'core',
    facilityLevel: false,
    questionCount: 14,
    icon: 'ShieldCheck',
  },
] as const;

export const FACILITY_THEMES = THEMES.filter((t) => t.facilityLevel);

export const THEME_BY_ID: Record<ThemeId, ThemeDef> = Object.fromEntries(
  THEMES.map((t) => [t.id, t]),
) as Record<ThemeId, ThemeDef>;

// ---------------------------------------------------------------------------
// Sub-thematic areas
// ---------------------------------------------------------------------------

export interface SubThemeDef {
  id: string;
  themeId: ThemeId;
  /** Verbatim Sub-Question text from the rubric. */
  label: string;
  /** Short form for the explorer rail and map legend. */
  shortLabel: string;
  questionCount: number;
}

export const SUB_THEMES: readonly SubThemeDef[] = [
  // A — Technical Infrastructure
  {
    id: 'technical_infrastructure.power',
    themeId: 'technical_infrastructure',
    label: 'Operational power availability and functional electrical wiring.',
    shortLabel: 'Power',
    questionCount: 2,
  },
  {
    id: 'technical_infrastructure.connectivity',
    themeId: 'technical_infrastructure',
    label: 'Connectivity readiness based on primary internet method, speed and reliability.',
    shortLabel: 'Connectivity',
    questionCount: 1,
  },
  {
    id: 'technical_infrastructure.devices',
    themeId: 'technical_infrastructure',
    label: "Supported computing devices against the facility's minimum requirement.",
    shortLabel: 'Devices',
    questionCount: 1,
  },
  {
    id: 'technical_infrastructure.power_resilience',
    themeId: 'technical_infrastructure',
    label: 'A secondary power pathway when the principal one fails.',
    shortLabel: 'Power resilience',
    questionCount: 1,
  },
  {
    id: 'technical_infrastructure.connectivity_resilience',
    themeId: 'technical_infrastructure',
    label: 'An alternative internet pathway when the primary one fails.',
    shortLabel: 'Connectivity resilience',
    questionCount: 1,
  },
  {
    id: 'technical_infrastructure.device_sustainability',
    themeId: 'technical_infrastructure',
    label: 'A routine maintenance arrangement for digital devices.',
    shortLabel: 'Device maintenance',
    questionCount: 1,
  },
  {
    id: 'technical_infrastructure.data_resilience',
    themeId: 'technical_infrastructure',
    label: 'A data-backup capability for routine service-delivery data.',
    shortLabel: 'Data backup',
    questionCount: 1,
  },

  // B — Workforce Capacity
  {
    id: 'workforce_capacity.digital_competency',
    themeId: 'workforce_capacity',
    label: 'The proportion of permanent staff with basic digital skills.',
    shortLabel: 'Digital competency',
    questionCount: 1,
  },
  {
    id: 'workforce_capacity.roles_and_accountability',
    themeId: 'workforce_capacity',
    label: 'A clearly assigned, sufficiently dedicated person responsible for digital-system oversight.',
    shortLabel: 'Roles & accountability',
    questionCount: 1,
  },
  {
    id: 'workforce_capacity.digital_familiarity',
    themeId: 'workforce_capacity',
    label: 'Regular staff use of digital devices for basic work or personal tasks.',
    shortLabel: 'Digital familiarity',
    questionCount: 1,
  },
  {
    id: 'workforce_capacity.training_readiness',
    themeId: 'workforce_capacity',
    label: 'How recent and relevant the most recent digital-health training was.',
    shortLabel: 'Training readiness',
    questionCount: 1,
  },
  {
    id: 'workforce_capacity.technical_support',
    themeId: 'workforce_capacity',
    label: 'How quickly and through what pathway digital-system issues are resolved.',
    shortLabel: 'Technical support',
    questionCount: 1,
  },

  // C — Workflow & Transition
  {
    id: 'workflow_transition.documentation_integration',
    themeId: 'workflow_transition',
    label: 'The share of documenting service points affected by repeated or parallel documentation.',
    shortLabel: 'Documentation integration',
    questionCount: 1,
  },
  {
    id: 'workflow_transition.workflow_efficiency',
    themeId: 'workflow_transition',
    label: 'The share of documenting service points experiencing delays or bottlenecks.',
    shortLabel: 'Workflow efficiency',
    questionCount: 1,
  },
  {
    id: 'workflow_transition.service_point_environment',
    themeId: 'workflow_transition',
    label: 'The share of applicable service points meeting all minimum physical conditions.',
    shortLabel: 'Service-point environment',
    questionCount: 1,
  },
  {
    id: 'workflow_transition.change_readiness',
    themeId: 'workflow_transition',
    label: 'How willing staff are to fully transition to an EMR system.',
    shortLabel: 'Change readiness',
    questionCount: 1,
  },

  // D — Data Use & Reporting
  {
    id: 'data_use_reporting.routine_data_use',
    themeId: 'data_use_reporting',
    label: 'How many structured mechanisms routine service-delivery data is used through.',
    shortLabel: 'Routine data use',
    questionCount: 1,
  },
  {
    id: 'data_use_reporting.data_quality_review',
    themeId: 'data_use_reporting',
    label: 'How frequently structured data-validation meetings are held.',
    shortLabel: 'Data-quality review',
    questionCount: 1,
  },
  {
    id: 'data_use_reporting.use_of_routine_reports',
    themeId: 'data_use_reporting',
    label: 'How often PHC service reports are discussed during data-review processes.',
    shortLabel: 'Use of routine reports',
    questionCount: 1,
  },

  // E — Leadership & Governance (state level)
  {
    id: 'leadership_governance.policy',
    themeId: 'leadership_governance',
    label:
      'What policy and strategic requirements are needed at national and state levels to enable scalable EMR implementation?',
    shortLabel: 'Policy & strategy',
    questionCount: 4,
  },
  {
    id: 'leadership_governance.governance',
    themeId: 'leadership_governance',
    label:
      'What governance strengthening initiatives are required to support a successful EMR deployment at all levels?',
    shortLabel: 'Governance',
    questionCount: 4,
  },
  {
    id: 'leadership_governance.resourcing',
    themeId: 'leadership_governance',
    label:
      'What opportunities exist to resource (financial and technical) EMR deployment across PHCs?',
    shortLabel: 'Resourcing',
    questionCount: 6,
  },
] as const;

export const SUB_THEMES_BY_THEME: Record<ThemeId, SubThemeDef[]> = THEMES.reduce(
  (acc, t) => {
    acc[t.id] = SUB_THEMES.filter((s) => s.themeId === t.id);
    return acc;
  },
  {} as Record<ThemeId, SubThemeDef[]>,
);

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

/** Contextual indicators are displayed but never scored. */
export const CLASS_WEIGHT: Record<IndicatorClass, number> = {
  core: 0.7,
  supporting: 0.3,
  contextual: 0,
};

/**
 * Compute a theme score: 0.7·mean(core) + 0.3·mean(supporting).
 *
 * A skipped question is excluded from its mean, not scored zero. Seven form
 * versions are in circulation and later-added indicators are null for early
 * submissions; treating those as zeros would systematically penalise the
 * facilities visited first.
 */
export function computeThemeScore(
  indicators: { score: number | null; class: IndicatorClass }[],
): { core: number | null; supporting: number | null; score: number | null } {
  const mean = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

  const coreScores = indicators
    .filter((i) => i.class === 'core' && i.score != null)
    .map((i) => i.score as number);
  const supportingScores = indicators
    .filter((i) => i.class === 'supporting' && i.score != null)
    .map((i) => i.score as number);

  const coreMean = mean(coreScores);
  const supportingMean = mean(supportingScores);
  if (coreMean == null && supportingMean == null) {
    return { core: null, supporting: null, score: null };
  }

  const core = coreMean == null ? null : coreMean * CLASS_WEIGHT.core;
  const supporting =
    supportingMean == null ? null : supportingMean * CLASS_WEIGHT.supporting;

  return { core, supporting, score: (core ?? 0) + (supporting ?? 0) };
}

// ---------------------------------------------------------------------------
// Explorer thematic axis
// ---------------------------------------------------------------------------

export interface ThemeNode {
  id: string;
  label: string;
  level: 'overall' | 'theme' | 'subtheme';
  themeId?: ThemeId;
  childIds: string[];
  /** Sub-themes of Leadership & Governance resolve only at state level. */
  facilityLevel: boolean;
}

export interface ThemeNodeDescription {
  id: ThemeNodeId;
  level: 'overall' | 'theme' | 'subtheme' | 'indicator';
  /** Short form, for a heading or a table column: "Power". */
  label: string;
  /** Qualified by its parent: "Technical Infrastructure › Power". */
  path: string;
  /** The rubric's own sub-question text. Null for the overall roll-up. */
  question: string | null;
  theme: ThemeDef | null;
  /** False for Leadership & Governance, assessed at state level only. */
  facilityLevel: boolean;
  /** Set on indicator nodes only — the rubric question behind the number. */
  indicator: IndicatorDef | null;
}

/**
 * Resolve a node on the explorer's thematic axis to something displayable.
 *
 * The first three levels come from the static hierarchy above. The fourth —
 * single indicators — cannot: their labels are the rubric's own question text,
 * which is generated into `indicators.json` and loaded at runtime, so callers
 * that can reach the indicator level pass the definitions in.
 *
 * Both axes of the module are addressable from the URL, so an unrecognised id is
 * reachable by hand-editing a shared link. It resolves to the overall roll-up —
 * the one node that is always valid — rather than rendering a half-labelled
 * panel. That also covers the window before `indicators.json` has loaded, in
 * which an indicator id is momentarily unrecognisable.
 */
export function describeThemeNode(
  id: ThemeNodeId,
  indicators: IndicatorDef[] = [],
): ThemeNodeDescription {
  const indicator = indicators.find((i) => i.id === id);
  if (indicator) {
    const theme = THEME_BY_ID[indicator.themeId];
    const sub = SUB_THEMES.find((s) => s.id === indicator.subThemeId);
    return {
      id,
      level: 'indicator',
      // The rubric's questions run to a full sentence, so the short label is
      // the question number — "Q31" — with the sentence itself carried in
      // `question` for the places that have room for it.
      label: `Q${indicator.n}`,
      path: [theme.label, sub?.shortLabel, `Q${indicator.n}`]
        .filter(Boolean)
        .join(' › '),
      question: indicator.label,
      theme,
      facilityLevel: theme.facilityLevel,
      indicator,
    };
  }

  const sub = SUB_THEMES.find((s) => s.id === id);
  if (sub) {
    const theme = THEME_BY_ID[sub.themeId];
    return {
      id,
      level: 'subtheme',
      label: sub.shortLabel,
      path: `${theme.label} › ${sub.shortLabel}`,
      question: sub.label,
      theme,
      facilityLevel: theme.facilityLevel,
      indicator: null,
    };
  }

  const theme = THEMES.find((t) => t.id === id);
  if (theme) {
    return {
      id,
      level: 'theme',
      label: theme.label,
      path: theme.label,
      question: null,
      theme,
      facilityLevel: theme.facilityLevel,
      indicator: null,
    };
  }

  return {
    id: 'overall',
    level: 'overall',
    label: 'All themes',
    path: 'All themes (overall readiness)',
    question: null,
    theme: null,
    facilityLevel: true,
    indicator: null,
  };
}

/** Flat, indexable tree for the explorer's left rail. */
export function buildThemeTree(): ThemeNode[] {
  const nodes: ThemeNode[] = [
    {
      id: 'overall',
      label: 'All themes (overall readiness)',
      level: 'overall',
      childIds: THEMES.map((t) => t.id),
      facilityLevel: true,
    },
  ];

  for (const theme of THEMES) {
    const subs = SUB_THEMES_BY_THEME[theme.id];
    nodes.push({
      id: theme.id,
      label: theme.label,
      level: 'theme',
      themeId: theme.id,
      childIds: subs.map((s) => s.id),
      facilityLevel: theme.facilityLevel,
    });
    for (const sub of subs) {
      nodes.push({
        id: sub.id,
        label: sub.shortLabel,
        level: 'subtheme',
        themeId: theme.id,
        childIds: [],
        facilityLevel: theme.facilityLevel,
      });
    }
  }

  return nodes;
}
