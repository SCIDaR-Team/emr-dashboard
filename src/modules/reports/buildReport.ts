/**
 * Turn a template + a scope + the loaded data into a `ReportDoc`.
 *
 * Pure, synchronous and side-effect free apart from the one template that needs
 * facility detail (the scorecard pack), which is handed its already-fetched
 * records. Keeping the build pure is what lets the preview and the PDF be the
 * same artefact rather than two renderings that can drift.
 *
 * Every figure here is computed from the *filtered* population, and every
 * document says so in its notes. That is the same rule the context panel, the
 * scope banner and the CSV's columns already follow: a figure without its
 * population is a figure that will be misquoted.
 */

import { BAND_LABEL, BANDS, toBand } from '@/lib/bands';
import { archetypeDistribution, compositeReadiness } from '@/lib/archetype';
import { COVERAGE, PRIMARY_STATES, evidenceGrade } from '@/lib/constants';
import { FACILITY_THEMES, SUB_THEMES, THEME_BY_ID } from '@/lib/themes';
import { formatCount, formatScore, percentOf } from '@/lib/format';
import type { ExportNote } from '@/lib/export';
import type {
  AreaProfile,
  Band,
  Facility,
  FacilitySummary,
  FacilityThemeId,
  FilterState,
  SnapshotMeta,
  ThemeId,
} from '@/lib/types';
import type { ReportBlock, ReportDoc, ReportSection } from './reportModel';
import { FACILITY_PACK_CAP } from './reportTemplates';

export interface BuildInput {
  templateId: string;
  /** Section ids the reader left ticked, in template order. */
  sectionIds: string[];
  facilities: FacilitySummary[];
  allFacilities: FacilitySummary[];
  states: AreaProfile[];
  snapshot: SnapshotMeta | null;
  filters: FilterState;
  isFiltered: boolean;
  theme: ThemeId | null;
  /** Only populated for the scorecard pack. */
  facilityDetail?: Facility[];
}

const DASH = '—';

/** "1 state" / "12 states" — a filtered report often has exactly one of things. */
function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

function mean(values: (number | null | undefined)[]): number | null {
  const ok = values.filter((v): v is number => v != null);
  return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
}

/** Human summary of the active filters, for the provenance block. */
function describeFilters(f: FilterState): string {
  const parts: string[] = [];
  if (f.states.length) parts.push(`States: ${f.states.join(', ')}`);
  if (f.lgas.length) parts.push(`LGAs: ${f.lgas.join(', ')}`);
  if (f.zones.length) parts.push(`Zones: ${f.zones.join(', ')}`);
  if (f.geography.length) parts.push(`Setting: ${f.geography.join(', ')}`);
  if (f.funding.length) parts.push(`Funding: ${f.funding.join(', ')}`);
  if (f.functionalityLevels.length) {
    parts.push(`Functionality: ${f.functionalityLevels.join(', ')}`);
  }
  if (f.archetypes.length) {
    parts.push(`Readiness: ${f.archetypes.map((b) => BAND_LABEL[b]).join(', ')}`);
  }
  for (const [themeId, bands] of Object.entries(f.bandByTheme)) {
    if (bands?.length) {
      parts.push(
        `${THEME_BY_ID[themeId as ThemeId].label}: ${bands.map((b) => BAND_LABEL[b]).join(', ')}`,
      );
    }
  }
  if (f.search.trim()) parts.push(`Search: "${f.search.trim()}"`);
  return parts.length ? parts.join(' · ') : 'None — the full assessed population';
}

/**
 * The provenance block every report carries.
 *
 * Deliberately the same `ExportNote` shape the CSV, Excel, PNG and PDF exports
 * already use, so a report and a table export of the same view make the same
 * claim in the same words.
 */
function buildNotes(input: BuildInput, scopeLabel: string): ExportNote[] {
  const notes: ExportNote[] = [
    ['Scope', scopeLabel],
    [
      'Population',
      `${formatCount(input.facilities.length)} of ${formatCount(input.allFacilities.length)} assessed facilities`,
    ],
    ['Filters', describeFilters(input.filters)],
  ];
  /*
   * Only the deep-dive is scoped by theme.
   *
   * The picker holds a theme at all times so the deep-dive has a default, but
   * listing it on a national summary would claim a narrowing that never
   * happened — provenance that overstates its own scope is the failure this
   * block exists to prevent, not a harmless extra line.
   */
  if (input.theme && input.templateId === 'thematic') {
    notes.push(['Thematic selection', THEME_BY_ID[input.theme].label]);
  }
  if (input.snapshot) {
    notes.push([
      'Data snapshot',
      `${input.snapshot.sourceFile} · built ${new Date(input.snapshot.builtAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    ]);
  }
  return notes;
}

/** The one caveat that belongs on every report drawn from a filtered view. */
function filterCaveat(input: BuildInput): ReportBlock[] {
  if (!input.isFiltered) return [];
  return [
    {
      kind: 'caveat',
      text:
        `Filters are active. Every figure in this report was computed over the ` +
        `${formatCount(input.facilities.length)} facilities that match the selection above, ` +
        `and will not equal the published national figures.`,
    },
  ];
}

function distributionBlock(rows: FacilitySummary[], caption?: string): ReportBlock {
  return {
    kind: 'distribution',
    counts: archetypeDistribution(rows.map((f) => f.archetype)),
    total: rows.length,
    caption,
  };
}

function themeBars(rows: FacilitySummary[]): ReportBlock {
  return {
    kind: 'scoreBars',
    items: FACILITY_THEMES.map((t) => {
      const scores = rows.map((f) => f.themeScores[t.id as FacilityThemeId]);
      const scored = scores.filter((s) => s != null).length;
      return {
        label: t.label,
        score: mean(scores),
        note: `${t.role === 'core' ? 'Core' : 'Supporting'} · ${formatCount(scored)} scored`,
      };
    }),
  };
}

/**
 * Leadership & Governance is absent from every facility-level breakdown, and
 * saying so is not pedantry — it is one of the three *core* themes, so a reader
 * looking at four bars is looking at an incomplete picture of readiness unless
 * the report tells them the fifth is measured elsewhere.
 */
const LEADERSHIP_CAVEAT: ReportBlock = {
  kind: 'caveat',
  text:
    'Leadership & Governance is a core thematic area but is assessed at state level only — ' +
    'it has no section in the facility instrument and does not appear in the scores above.',
};

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

interface Grouped {
  key: string;
  rows: FacilitySummary[];
}

function groupBy(rows: FacilitySummary[], pick: (f: FacilitySummary) => string): Grouped[] {
  const map = new Map<string, FacilitySummary[]>();
  for (const f of rows) {
    const k = pick(f);
    const list = map.get(k);
    if (list) list.push(f);
    else map.set(k, [f]);
  }
  return [...map.entries()].map(([key, group]) => ({ key, rows: group }));
}

/** Ranked table over a grouping — the shape both the state and LGA rankings use. */
function rankedTable(
  groups: Grouped[],
  unitLabel: string,
  scoreOf: (rows: FacilitySummary[]) => number | null,
): ReportBlock {
  const ranked = groups
    .map((g) => ({
      name: g.key,
      n: g.rows.length,
      score: scoreOf(g.rows),
      dist: archetypeDistribution(g.rows.map((f) => f.archetype)),
    }))
    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));

  return {
    kind: 'table',
    columns: [unitLabel, 'Facilities', 'Mean score', 'Ready', 'Moderately ready', 'Not ready'],
    numericColumns: [1, 2, 3, 4, 5],
    rows: ranked.map((r) => [
      r.name,
      r.n,
      r.score == null ? null : formatScore(r.score, 2),
      r.dist.ready,
      r.dist.moderately_ready,
      r.dist.not_ready,
    ]),
  };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function nationalSummary(input: BuildInput): ReportSection[] {
  const rows = input.facilities;
  const dist = archetypeDistribution(rows.map((f) => f.archetype));
  const statesInScope = [...new Set(rows.map((f) => f.state))];

  return [
    {
      id: 'overview',
      title: 'Overview',
      blocks: [
        {
          kind: 'kpis',
          items: [
            { label: 'Facilities', value: formatCount(rows.length) },
            { label: 'States', value: formatCount(statesInScope.length) },
            { label: 'LGAs', value: formatCount(new Set(rows.map((f) => f.lgaId)).size) },
            {
              label: 'Composite readiness',
              value: formatScore(compositeReadiness(rows.map((f) => f.archetype)), 2),
              sublabel: '1–5 scale',
            },
          ],
        },
        {
          kind: 'prose',
          text:
            `This report covers ${plural(rows.length, 'facility', 'facilities')} across ` +
            `${plural(statesInScope.length, 'state')}. ` +
            `${formatCount(dist.ready)} are classified Ready ` +
            `(${percentOf(dist.ready, rows.length)}), ` +
            `${formatCount(dist.moderately_ready)} Moderately ready and ` +
            `${formatCount(dist.not_ready)} Not ready.`,
        },
        ...filterCaveat(input),
      ],
    },
    {
      id: 'distribution',
      title: 'Readiness distribution',
      blocks: [
        distributionBlock(rows, 'Facility archetype across the population in scope'),
      ],
    },
    {
      id: 'themes',
      title: 'Thematic area scores',
      blocks: [themeBars(rows), LEADERSHIP_CAVEAT],
    },
    {
      id: 'states',
      title: 'State ranking',
      blocks: [
        rankedTable(
          groupBy(rows, (f) => f.state),
          'State',
          (r) => mean(r.map((f) => f.averageDomainScore)),
        ),
      ],
    },
    {
      id: 'coverage',
      title: 'Coverage and evidence',
      blocks: [
        {
          kind: 'prose',
          text:
            `The assessment combined primary facility data collection in ` +
            `${COVERAGE.statesPrimary} states with secondary desk review for the remaining ` +
            `${COVERAGE.statesSecondary} states and the FCT.`,
        },
        {
          kind: 'caveat',
          text:
            'Facility-level findings exist only for the 12 primary states: ' +
            `${PRIMARY_STATES.join(', ')}. Every figure in this report is drawn from those ` +
            'facilities. The desk-reviewed states are not represented and their absence is ' +
            'not a finding of low readiness.',
        },
      ],
    },
  ];
}

function stateBrief(input: BuildInput): ReportSection[] {
  const rows = input.facilities;
  const stateName = rows[0]?.state ?? DASH;
  const grade = evidenceGrade(stateName);
  const profile = input.states.find((s) => s.name === stateName);

  return [
    {
      id: 'overview',
      title: 'State overview',
      blocks: [
        {
          kind: 'kpis',
          items: [
            { label: 'Facilities assessed', value: formatCount(rows.length) },
            { label: 'LGAs covered', value: formatCount(new Set(rows.map((f) => f.lgaId)).size) },
            {
              label: 'Mean domain score',
              value: formatScore(mean(rows.map((f) => f.averageDomainScore)), 2),
              sublabel: '1–5 scale',
            },
            {
              label: 'Composite readiness',
              value: formatScore(compositeReadiness(rows.map((f) => f.archetype)), 2),
            },
          ],
        },
        {
          kind: 'prose',
          text:
            `${stateName} has ${plural(rows.length, 'assessed facility', 'assessed facilities')} across ` +
            `${plural(new Set(rows.map((f) => f.lgaId)).size, 'LGA')}` +
            (profile?.lgaCount ? ` of ${formatCount(profile.lgaCount)} in the state` : '') +
            '.',
        },
        ...filterCaveat(input),
      ],
    },
    {
      id: 'distribution',
      title: 'Readiness distribution',
      blocks: [distributionBlock(rows, `Facility archetype across ${stateName}`)],
    },
    {
      id: 'themes',
      title: 'Thematic area scores',
      blocks: [themeBars(rows), LEADERSHIP_CAVEAT],
    },
    {
      id: 'lgas',
      title: 'LGA ranking',
      blocks: [
        rankedTable(
          groupBy(rows, (f) => f.lga),
          'LGA',
          (r) => mean(r.map((f) => f.averageDomainScore)),
        ),
      ],
    },
    {
      id: 'coverage',
      title: 'Evidence note',
      blocks: [
        {
          kind: 'caveat',
          text:
            grade === 'primary'
              ? `${stateName} is one of the ${COVERAGE.statesPrimary} states with primary facility ` +
                'data collection, so these are measured facility findings. They are not a ' +
                'state-level assessment: Leadership & Governance and Overall State Readiness ' +
                'come from a separate state instrument that is not yet available.'
              : `${stateName} was covered by secondary desk review, not primary facility data ` +
                'collection. Any facility figures shown here should be treated as indicative ' +
                'only.',
        },
      ],
    },
  ];
}

function thematicDeepDive(input: BuildInput): ReportSection[] {
  const rows = input.facilities;
  const themeId = input.theme!;
  const def = THEME_BY_ID[themeId];
  const scores = rows.map((f) => f.themeScores[themeId as FacilityThemeId]);
  const scored = scores.filter((s): s is number => s != null);
  const bandCounts = BANDS.reduce<Record<Band, number>>(
    (acc, b) => ({ ...acc, [b]: 0 }),
    { not_ready: 0, moderately_ready: 0, ready: 0 },
  );
  for (const s of scored) {
    const b = toBand(s);
    if (b) bandCounts[b] += 1;
  }

  const subThemes = SUB_THEMES.filter((s) => s.themeId === themeId);

  return [
    {
      id: 'overview',
      title: 'Theme overview',
      blocks: [
        {
          kind: 'kpis',
          items: [
            { label: 'Thematic area', value: def.label, sublabel: `Area ${def.code}` },
            {
              label: 'Mean score',
              value: formatScore(mean(scores), 2),
              sublabel: '1–5 scale',
            },
            {
              label: 'Facilities scored',
              value: formatCount(scored.length),
              sublabel: `of ${formatCount(rows.length)} in scope`,
            },
            {
              label: 'Weighting',
              value: def.role === 'core' ? 'Core' : 'Supporting',
              sublabel: `${def.questionCount} rubric questions`,
            },
          ],
        },
        ...filterCaveat(input),
      ],
    },
    {
      id: 'distribution',
      title: 'Band distribution on this theme',
      blocks: [
        {
          kind: 'distribution',
          counts: bandCounts,
          total: scored.length,
          caption: `Band on ${def.label} — not the overall facility archetype`,
        },
        {
          kind: 'caveat',
          text:
            'These bands describe this thematic area only. A facility can be Ready on one ' +
            'theme and Not ready overall — the archetype rule requires all three core themes, ' +
            'so the two splits answer different questions and will not match.',
        },
      ],
    },
    {
      id: 'subthemes',
      title: 'Sub-thematic breakdown',
      blocks: [
        {
          kind: 'scoreBars',
          items: subThemes.map((st) => ({
            label: st.shortLabel,
            score: mean(rows.map((f) => f.subThemeScores[st.id])),
            note: `${st.questionCount} questions`,
          })),
        },
        {
          kind: 'caveat',
          text:
            'Each sub-theme score is computed within that sub-theme (0.7 × core + 0.3 × ' +
            'supporting). They do not average to the theme score above and must not be read ' +
            'as a decomposition of it.',
        },
      ],
    },
    {
      id: 'geographies',
      title: 'Ranked geographies',
      blocks: [
        rankedTable(
          groupBy(rows, (f) => f.state),
          'State',
          (r) => mean(r.map((f) => f.themeScores[themeId as FacilityThemeId])),
        ),
      ],
    },
    {
      id: 'coverage',
      title: 'Method note',
      blocks: [
        {
          kind: 'prose',
          text:
            `${def.label} is scored from ${def.questionCount} rubric questions across ` +
            `${subThemes.length} sub-thematic areas. A theme score is 0.7 × the mean of its ` +
            'core indicators plus 0.3 × the mean of its supporting indicators, on a 1–5 scale.',
        },
        ...(themeId === 'leadership_governance'
          ? [
              {
                kind: 'caveat' as const,
                text:
                  'Leadership & Governance is assessed at state level and has no facility ' +
                  'instrument, so no facility-level figures are available for it.',
              },
            ]
          : []),
      ],
    },
  ];
}

function facilityPack(input: BuildInput): ReportSection[] {
  const rows = input.facilities;
  const included = rows.slice(0, FACILITY_PACK_CAP);
  const detail = input.facilityDetail ?? [];
  const truncated = rows.length > FACILITY_PACK_CAP;

  const scorecardBlocks: ReportBlock[] = [];
  for (const f of detail) {
    const met = f.minimumRequirements.filter((r) => r.met === true).length;
    const assessable = f.minimumRequirements.filter((r) => r.met !== null).length;
    const points = f.servicePoints.filter((p) => p.present).length;

    scorecardBlocks.push({
      kind: 'table',
      caption: `${f.name} — ${f.lga}, ${f.state}`,
      columns: ['Measure', 'Value'],
      rows: [
        ['Readiness archetype', BAND_LABEL[f.archetype]],
        ['Functionality level', f.functionalityLevel],
        ['Setting', f.geography === 'rural' ? 'Rural' : 'Urban'],
        ['Funding', f.isBHCPF ? 'BHCPF' : 'non-BHCPF'],
        ['Mean domain score', f.averageDomainScore == null ? null : formatScore(f.averageDomainScore, 2)],
        ...FACILITY_THEMES.map((t) => {
          const ts = f.themeScores.find((s) => s.themeId === t.id);
          return [t.label, ts?.score == null ? null : formatScore(ts.score, 2)] as (
            | string
            | null
          )[];
        }),
        ['Minimum requirements met', `${met} of ${assessable} assessable`],
        ['Service points present', `${points} of 5`],
      ],
    });
  }

  return [
    {
      id: 'overview',
      title: 'Pack summary',
      blocks: [
        {
          kind: 'kpis',
          items: [
            { label: 'Facilities in pack', value: formatCount(included.length) },
            { label: 'Matching the filters', value: formatCount(rows.length) },
            { label: 'States', value: formatCount(new Set(included.map((f) => f.state)).size) },
            { label: 'LGAs', value: formatCount(new Set(included.map((f) => f.lgaId)).size) },
          ],
        },
        ...filterCaveat(input),
        ...(truncated
          ? [
              {
                kind: 'caveat' as const,
                text:
                  `${formatCount(rows.length)} facilities match the current selection. This pack ` +
                  `contains the first ${FACILITY_PACK_CAP}. Narrow the filters to cover a ` +
                  'different subset — the remainder are not included and are not represented ' +
                  'in the figures above.',
              },
            ]
          : []),
      ],
    },
    {
      id: 'roster',
      title: 'Facility roster',
      blocks: [
        {
          kind: 'table',
          columns: ['Facility', 'LGA', 'State', 'Level', 'Archetype', 'Mean score'],
          numericColumns: [5],
          rows: included.map((f) => [
            f.name,
            f.lga,
            f.state,
            f.functionalityLevel,
            BAND_LABEL[f.archetype],
            f.averageDomainScore == null ? null : formatScore(f.averageDomainScore, 2),
          ]),
        },
      ],
    },
    {
      id: 'scorecards',
      title: 'Individual scorecards',
      blocks: scorecardBlocks.length
        ? scorecardBlocks
        : [{ kind: 'prose', text: 'No facility detail could be loaded for this selection.' }],
    },
    {
      id: 'coverage',
      title: 'Method note',
      blocks: [
        {
          kind: 'caveat',
          text:
            'Two of the 24 minimum requirements are permanently unassessable from this ' +
            'instrument — it never asks how many staff were trained, only whether any were, ' +
            'and it never asks about a unique patient identifier. They are excluded from the ' +
            '"assessable" denominator above rather than counted as failures.',
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------

const BUILDERS: Record<string, (input: BuildInput) => ReportSection[]> = {
  national: nationalSummary,
  state: stateBrief,
  thematic: thematicDeepDive,
  facility: facilityPack,
};

const SCOPE_LABEL: Record<string, (input: BuildInput) => string> = {
  national: (i) => {
    const states = [...new Set(i.facilities.map((f) => f.state))];
    return states.length === 1 ? states[0]! : `${formatCount(states.length)} states`;
  },
  state: (i) => i.facilities[0]?.state ?? DASH,
  thematic: (i) => (i.theme ? THEME_BY_ID[i.theme].label : DASH),
  facility: (i) =>
    `${formatCount(Math.min(i.facilities.length, FACILITY_PACK_CAP))} facility scorecards`,
};

const TITLES: Record<string, (input: BuildInput) => string> = {
  national: () => 'National Readiness Summary',
  state: (i) => `${i.facilities[0]?.state ?? 'State'} Readiness Brief`,
  thematic: (i) => `${i.theme ? THEME_BY_ID[i.theme].label : 'Thematic'} Deep-Dive`,
  facility: () => 'Facility Scorecard Pack',
};

export function buildReport(input: BuildInput): ReportDoc {
  const build = BUILDERS[input.templateId];
  if (!build) throw new Error(`Unknown report template: ${input.templateId}`);

  const all = build(input);
  // Section order follows the template, not the order the reader ticked them.
  const sections = all.filter((s) => input.sectionIds.includes(s.id));

  return {
    templateId: input.templateId,
    title: TITLES[input.templateId]!(input),
    subtitle: 'EMR Readiness Assessment · NPHCDA',
    notes: buildNotes(input, SCOPE_LABEL[input.templateId]!(input)),
    sections,
  };
}
