/**
 * The thematic hierarchy: 5 thematic areas → 13 sub-thematic areas → 132 rubric
 * questions (94 scored, 38 contextual).
 *
 * Labels and question counts are transcribed from
 * `Facility Scoring Rubric - Facility Scoring Rubric.csv`. Question *content*
 * is loaded at runtime from the generated indicators.json — this module holds
 * only the structure, which the Drill-Down Explorer navigates.
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
    questionCount: 44,
    icon: 'Network',
  },
  {
    id: 'workforce_capacity',
    code: 'B',
    label: 'Workforce Capacity',
    shortLabel: 'Workforce',
    role: 'core',
    facilityLevel: true,
    questionCount: 17,
    icon: 'Users',
  },
  {
    id: 'workflow_transition',
    code: 'C',
    label: 'Workflow & Transition',
    shortLabel: 'Workflow',
    role: 'supporting',
    facilityLevel: true,
    questionCount: 42,
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
    label:
      'How can power at facilities be stabilized or upgraded to ensure continuous EMR functionality?',
    shortLabel: 'Power',
    questionCount: 6,
  },
  {
    id: 'technical_infrastructure.network',
    themeId: 'technical_infrastructure',
    label:
      'How can internet and network capacity at facilities be improved or configured to support real-time EMR use?',
    shortLabel: 'Internet & network',
    questionCount: 7,
  },
  {
    id: 'technical_infrastructure.hardware',
    themeId: 'technical_infrastructure',
    label:
      'How can hardware, storage, and security systems be made available or enhanced to meet EMR requirements?',
    shortLabel: 'Hardware & security',
    questionCount: 31,
  },

  // B — Workforce Capacity
  {
    id: 'workforce_capacity.competency',
    themeId: 'workforce_capacity',
    label:
      'How can existing staff competencies be built upon to ensure routine and effective EMR use?',
    shortLabel: 'Staff competencies',
    questionCount: 11,
  },
  {
    id: 'workforce_capacity.roles',
    themeId: 'workforce_capacity',
    label:
      'How can staffing roles and accountability structures be clarified or reinforced to support EMR operations?',
    shortLabel: 'Roles & accountability',
    questionCount: 6,
  },

  // C — Workflow & Transition
  {
    id: 'workflow_transition.digitization',
    themeId: 'workflow_transition',
    label:
      'How can existing workflows be digitized and redesigned through EMR system implementation to improve efficiency?',
    shortLabel: 'Workflow digitisation',
    questionCount: 6,
  },
  {
    id: 'workflow_transition.transition',
    themeId: 'workflow_transition',
    label:
      'How can transition approaches, staff readiness, and workflow adaptations be optimized to ensure smooth and sustainable migration?',
    shortLabel: 'Transition readiness',
    questionCount: 22,
  },
  {
    id: 'workflow_transition.service_points',
    themeId: 'workflow_transition',
    label:
      'To what extent are facility service points configured to support routine point-of-care EMR use?',
    shortLabel: 'Service points',
    questionCount: 14,
  },

  // D — Data Use & Reporting
  {
    id: 'data_use_reporting.inefficiencies',
    themeId: 'data_use_reporting',
    label:
      'What inefficiencies exist in current data collection and reporting processes that EMRs can address?',
    shortLabel: 'Current inefficiencies',
    questionCount: 4,
  },
  {
    id: 'data_use_reporting.strengthening',
    themeId: 'data_use_reporting',
    label:
      'How can EMR deployment strengthen data management, reporting accuracy, and decision-making across facilities?',
    shortLabel: 'Data management',
    questionCount: 11,
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
