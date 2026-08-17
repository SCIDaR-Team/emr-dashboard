/**
 * Domain model for the EMR Readiness Assessment Dashboard.
 *
 * Grounded in `ERA dataset_v4.xlsx` (the scored dataset, 2,804 facilities) and
 * the Facility Scoring Rubric. See EMR_DASHBOARD_BUILD_GUIDE.md §13.
 */

// ---------------------------------------------------------------------------
// Thematic hierarchy
// ---------------------------------------------------------------------------

/**
 * The five assessment thematic areas.
 *
 * A, B and E are *core* — a gap in any of them cannot be offset by strength
 * elsewhere. E (Leadership & Governance) is assessed at state level only; it
 * has no section in the facility instrument and does not participate in the
 * facility archetype rule.
 */
export type ThemeId =
  | 'technical_infrastructure' // A — core
  | 'workforce_capacity' // B — core
  | 'workflow_transition' // C — supporting
  | 'data_use_reporting' // D — supporting
  | 'leadership_governance'; // E — core, state level only

/** Themes scored at facility level (E is excluded). */
export type FacilityThemeId = Exclude<ThemeId, 'leadership_governance'>;

/**
 * Indicator weighting class.
 *
 * Contextual indicators are collected and displayed but contribute nothing to
 * any score — they capture perception or context, not readiness.
 */
export type IndicatorClass = 'core' | 'supporting' | 'contextual';

/**
 * An indicator's score on the 1–5 scale.
 *
 * Under the v2 scoring methodology this is not restricted to {1, 3, 5} — most
 * of the 20 scored indicators (e.g. power runtime, device sufficiency) span
 * the full range, verified against every score column in the v2 workbook.
 * A handful (wiring, data backup, device use) still take only {1, 3, 5},
 * per that indicator's own rubric-defined scale.
 */
export type IndicatorScore = 1 | 2 | 3 | 4 | 5;

// ---------------------------------------------------------------------------
// Readiness bands
// ---------------------------------------------------------------------------

/**
 * The three readiness bands.
 *
 * Not equal terciles under the v2 methodology — the cut points (2.9, 3.9)
 * come from `Updated Readiness Pivots` Table 6.2, which crosswalks the
 * deck's five-band scheme (Nascent → Optimized) onto these three: Nascent +
 * Emerging = Not ready, Developing = Moderately ready, Institutionalized +
 * Optimized = Ready. See src/lib/bands.ts.
 */
export type Band = 'not_ready' | 'moderately_ready' | 'ready';

/** Optional five-band maturity labels, kept behind a flag. Guide §17.2. */
export type MaturityLevel =
  | 'nascent'
  | 'emerging'
  | 'developing'
  | 'institutionalized'
  | 'optimized';

// ---------------------------------------------------------------------------
// Rubric
// ---------------------------------------------------------------------------

export interface SubTheme {
  id: string;
  themeId: ThemeId;
  /** The rubric's Sub-Question text. */
  label: string;
  /** Short label for tight UI (tree rail, map legend). */
  shortLabel: string;
  indicatorIds: string[];
}

/**
 * Why an indicator carries no weight. Only set when `class` is `contextual`, and
 * worth distinguishing on screen: "the instrument asked but never scored this"
 * is a different statement from "this is context, not readiness".
 */
export type UnscoredReason =
  /** The rubric defines no response buckets — context or perception. */
  | 'descriptive'
  /** The rubric defines buckets but the published workbook never scored it. */
  | 'rubric_scored_workbook_did_not'
  /** Scored 1/3/5 in the workbook but excluded from its component mean. */
  | 'scored_but_unweighted'
  /** Leadership & Governance — assessed at state level, no facility instrument. */
  | 'state_level_only';

export interface IndicatorDef {
  id: string;
  /** Position in etl/lib/indicatorsV2.mjs, for stable ordering. */
  n: number;
  themeId: ThemeId;
  subThemeId: string;
  /** Short indicator label, from Facility Scoring Rubric_v2_WORK. */
  label: string;
  class: IndicatorClass;
  /** ODK response column feeding this indicator. */
  sourceColumns: string[];
  /**
   * The workbook column holding this indicator's score. Empty for contextual
   * indicators. No indicator is asked once per service point under the v2
   * methodology, so this is at most one column — `servicePointIds` is always
   * null now, kept only so a future methodology revision has somewhere to
   * put it again.
   */
  scoreColumns: string[];
  servicePointIds: ServicePointId[] | null;
  unscoredReason: UnscoredReason | null;
  /** True for the one scored column the rubric does not list a question for. */
  rubricUnmatched: boolean;
  /**
   * Facilities carrying a score for this indicator, of 2,804. Zero for
   * contextual indicators, which are never scored.
   *
   * Coverage is wildly uneven and often by design: the EMR-transition questions
   * sit behind a skip pattern and are answered by 158 facilities, and
   * `data_use_reporting.inefficiencies.q106` by 20. A national figure for one of
   * those describes its 158 respondents, not the country — so the explorer's
   * indicator level shows this before a reader selects an indicator, not after.
   */
  answeredCount: number;
  /**
   * Response options belonging to each score bucket. Empty for contextual
   * indicators, which have no bucket definitions in the rubric.
   */
  buckets: Record<IndicatorScore, string[]>;
  rationale: string;
}

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

export interface ThemeScore {
  themeId: ThemeId;
  /** 0.7 x mean(core indicator scores). Range 0.70–3.50. */
  coreComponent: number | null;
  /** 0.3 x mean(supporting indicator scores). Range 0.30–1.50. */
  supportingComponent: number | null;
  /** coreComponent + supportingComponent. Range 1.00–5.00. */
  score: number | null;
  band: Band | null;
  /**
   * Sub-theme scores for this theme's sub-themes only.
   *
   * Each is 0.7·mean(core) + 0.3·mean(supporting) applied *within* the
   * sub-theme, so these do not average to the theme score and must not be
   * presented as a decomposition of it.
   */
  subThemeScores: Record<string, number | null>;
}

// ---------------------------------------------------------------------------
// Facility
// ---------------------------------------------------------------------------

export type FunctionalityLevel =
  | 'Functional L1'
  | 'Functional L2'
  | 'Partially Functional';

export type ServicePointId =
  | 'registration'
  | 'examination'
  | 'consultation'
  | 'laboratory'
  | 'pharmacy';

/**
 * One of the five service points, reshaped from the 95 flat `M1.x`–`M5.x`
 * columns. A point that does not exist at this facility is still present in the
 * array with `present: false`, so the scorecard's grid always has five cells and
 * an absent point reads as absent rather than as missing data.
 */
export interface ServicePoint {
  id: ServicePointId;
  label: string;
  present: boolean;

  tasks: string[];
  /** Null where the question was not put — never conflate that with "no". */
  hasFunctionalDevice: boolean | null;
  deviceTypes: string[];
  deviceShared: boolean;
  sharedWith: ServicePointId[];

  usesDigitalSystems: boolean;
  digitalSystemName: string | null;

  /** Desk, chairs, sockets, fan, lockable door — and the risks, e.g. water_leaks. */
  infrastructure: string[];
  hasActionPlan: boolean;

  documentedBy: string | null;
  staffAlsoElsewhere: boolean | null;
  staffAlsoAt: ServicePointId[];
  totalStaff: number | null;
  permanentStaff: number | null;
  dedicatedStaff: number | null;
  canPerformDigitalTasks: boolean | null;

  hasDuplicateDocumentation: boolean;
  hasHybridDocumentation: boolean;
  hasBottleneck: boolean;
}

/** The definition, served once from requirements.json. */
export interface MinimumRequirementDef {
  id: string;
  themeId: FacilityThemeId;
  label: string;
}

/**
 * One facility's answer to a requirement.
 *
 * `met: null` means the instrument cannot answer it — render "not assessed",
 * never a failure. Two of the 24 are permanently null: the instrument never asks
 * how many staff were trained, only whether any were, and it never asks about a
 * unique patient identifier.
 */
export interface MinimumRequirement {
  id: string;
  met: boolean | null;
  measured: boolean;
}

export interface Facility {
  /** ODK UUID. The primary key — 2,783 distinct names for 2,804 rows, so
   *  never key on name. */
  uuid: string;
  name: string;
  databaseName: string;

  state: string;
  lga: string;
  zone: string;
  geography: 'rural' | 'urban';
  lat: number;
  lon: number;

  functionalityLevel: FunctionalityLevel;
  isBHCPF: boolean;
  oicName: string;
  oicCadre: string;
  servicesOffered: string[];
  operatingDays: string;
  operatingHours: string;
  patientConsultations: string;

  /** Themes A–D. E is state level and absent here. */
  themeScores: ThemeScore[];
  /** All ten facility-level sub-themes, flattened across the four themes. */
  subThemeScores: Record<string, number | null>;
  /** Indicator id → score. Multi-column indicators hold the mean of their columns. */
  indicatorScores: Record<string, number | null>;
  averageDomainScore: number | null;

  /**
   * Computed via `classifyFacility()`, not carried from a published column.
   * The v2 workbook's own archetype field is explicitly labelled "pending
   * revised archetype rerun" — the assessment team has not re-run their own
   * classification against the revised scores yet, so there is nothing
   * authoritative to carry verbatim. See docs/SCORING.md.
   */
  archetype: Band | null;

  minimumRequirements: MinimumRequirement[];
  servicePoints: ServicePoint[];
  investments: InvestmentItem[];

  submissionDate: string;
  /** Seven are in circulation, v6 → v12. Later indicators are null on early ones. */
  formVersion: string;
  reviewState: 'approved' | 'hasIssues' | 'rejected' | 'edited' | null;
}

/** The lean row shipped in facilities-summary.json — drives maps and lists. */
export interface FacilitySummary {
  uuid: string;
  name: string;
  state: string;
  stateId: string;
  lga: string;
  lgaId: string;
  zone: string;
  geography: 'rural' | 'urban';
  lat: number;
  lon: number;
  functionalityLevel: FunctionalityLevel;
  isBHCPF: boolean;
  archetype: Band | null;
  averageDomainScore: number | null;
  themeScores: Record<FacilityThemeId, number | null>;
  /**
   * All ten facility-level sub-theme scores.
   *
   * Present on the lean summary row purely so the Drill-Down Explorer can
   * recompute its cube in the browser when a filter is active (guide §8.4) —
   * every sub-theme node on its thematic rail has to keep resolving under a
   * filter, and the precomputed cube cannot. Leadership's three sub-themes are
   * absent, not null: they are state-level and have no facility instrument.
   */
  subThemeScores: Record<string, number | null>;
}

// ---------------------------------------------------------------------------
// Investment and roadmap
// ---------------------------------------------------------------------------

export type InvestmentPriority = 'high' | 'medium' | 'low';

export type InvestmentCategory =
  | 'infrastructure'
  | 'workforce'
  | 'workflow'
  | 'data_use';

export interface InvestmentItem {
  id: string;
  /** Action-phrased, e.g. "Install inverter or solar backup power system". */
  label: string;
  themeId: ThemeId;
  category: InvestmentCategory;
  /** No client-specified rule yet (guide §17.4) — a documented default, see etl/lib/investment.mjs. */
  priority: InvestmentPriority;
  /** Real — derived from what actually failed at this facility. */
  quantity: number;
  /** Null throughout: no unit-cost table has been signed off (guide §9.1, §17.4). */
  unitCostNGN: number | null;
  totalCostNGN: number | null;
  /** Minimum-requirement ids whose failure triggered this item. */
  triggeredBy: string[];
  /** Set only on rolled-up (LGA/state/national) items: how many facilities
   *  in scope contributed to this line's quantity. */
  facilityCount?: number;
}

export interface RoadmapCell {
  month: 1 | 2 | 3 | 4 | 5 | 6;
  activity: string;
  costNGN: number;
}

export interface RoadmapRow {
  archetype: Band;
  cells: RoadmapCell[];
  totalNGN: number;
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

export type GeoLevel = 'national' | 'state' | 'lga';

/**
 * Whether a geography's findings rest on primary facility assessment or on
 * secondary desk review. 12 states were physically visited; the remaining 25
 * plus the FCT were reviewed from secondary sources. The two must never render
 * in the same visual language.
 */
export type EvidenceGrade = 'primary' | 'secondary';

export interface AreaProfile {
  id: string;
  level: GeoLevel;
  name: string;
  parentId: string | null;
  evidenceGrade: EvidenceGrade;

  facilityCount: number;
  lgaCount?: number;
  archetypeDistribution: Record<Band, number>;
  themeScores: Record<ThemeId, number | null>;
  subThemeScores: Record<string, number | null>;

  /** (5·ready + 3·moderate + 1·notReady) / total. Null for secondary states. */
  compositeReadiness: number | null;
  averageScore: number | null;
  band: Band | null;

  investments: InvestmentItem[];
  roadmap: RoadmapRow[];
}

// ---------------------------------------------------------------------------
// Drill-Down Explorer
// ---------------------------------------------------------------------------

/**
 * A node on the thematic axis: the overall roll-up, a thematic area, a
 * sub-thematic area, or a single indicator.
 */
export type ThemeNodeId = 'overall' | string;

export interface ExplorerCell {
  score: number | null;
  band: Band | null;
  /** Facilities behind this cell — always shown, so a value from n=3 is not
   *  read with the same confidence as one from n=444. */
  n: number;
  /**
   * How many of those `n` carry a value for this thematic node — the
   * denominator `distribution` sums to. Equal to `n` throughout the current
   * dataset; a later form version could make it smaller, and a distribution
   * drawn over a smaller denominator than the `n` printed beside it would
   * overstate its own coverage.
   */
  scored: number;
  /**
   * Facility counts per band **on the selected node**, not the archetype split.
   * The two coincide only for `overall`; for a thematic area they answer
   * different questions.
   */
  distribution: Record<Band, number>;
}

/** explorer-cube.json — [geoId][themeNodeId]. Guide §8.4. */
export type ExplorerCube = Record<string, Record<ThemeNodeId, ExplorerCell>>;

/**
 * indicator-scores.json — the explorer's fourth thematic level.
 *
 * One row per facility, one column per scored indicator, `ids` giving the column
 * order. Deliberately *not* in the cube: 50 more nodes across 3,122 geographies
 * would roughly quadruple a 6.7 MB file to serve a level most sessions never
 * open, so indicator cells are computed in the browser from this and the file is
 * fetched only when an indicator is actually selected.
 *
 * Values are unrounded on purpose — see etl/lib/indicatorMatrix.mjs.
 */
export interface IndicatorMatrix {
  ids: string[];
  /** Facilities carrying a value for each id, aligned to `ids`. */
  answered: number[];
  byFacility: Record<string, (number | null)[]>;
}

/** How child units are aggregated. The two answer different questions and rank
 *  differently, so the active choice is always labelled in the UI. */
export type Aggregation = 'mean_score' | 'pct_ready';

export interface ExplorerSelection {
  /** Dot path: "" | "kano" | "kano.dala" | "kano.dala.<uuid>" */
  geo: string;
  /** "overall" | "<themeId>" | "<themeId>.<subThemeId>" | indicator id */
  theme: ThemeNodeId;
  aggregation: Aggregation;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface FilterState {
  states: string[];
  lgas: string[];
  zones: string[];
  geography: ('rural' | 'urban')[];
  funding: ('BHCPF' | 'non-BHCPF')[];
  functionalityLevels: FunctionalityLevel[];
  archetypes: Band[];
  bandByTheme: Partial<Record<ThemeId, Band[]>>;
  search: string;
}

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

export interface SnapshotMeta {
  /** ISO timestamp of the ETL run that produced public/data. */
  builtAt: string;
  sourceFile: string;
  facilityCount: number;
  statesPrimary: number;
  statesSecondary: number;
  /** Indicators by weighting class — 20 scored (core + supporting) under v2. */
  indicatorCounts: Record<IndicatorClass, number>;
  /** Nodes on the explorer's thematic axis: overall + 4 themes + 19 sub-themes. */
  thematicNodes: number;
}
