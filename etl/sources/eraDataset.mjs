/**
 * Reader for `ERA dataset_v4.xlsx`.
 *
 * The master sheet is `Raw data with readiness level` — 2,804 facilities ×
 * 379 columns, carrying raw responses, every indicator score, the four theme
 * scores and `final_facility_archetype`.
 *
 * Sheet quirks this handles:
 *   - the header row is not row 0 (it is row 1 on the master sheet, row 3 on
 *     `Tech.infr_readiness scoring`, and varies elsewhere), so it is located by
 *     looking for the 'Name of facility' cell rather than assumed
 *   - archetype casing is inconsistent: 'Not Ready' in the archetype column,
 *     'Not ready' in the theme columns
 *   - some theme scores fall below the theoretical floor of 1.0 (workforce
 *     0.65, data use 0.70) because unanswered indicators were treated as 0
 *     rather than excluded upstream; these are preserved and flagged
 *   - `pre_implementation_steps` holds 1/3/5 but carries a *date* number format,
 *     so reading with `cellDates` turns it into 1900-01-03. The workbook is read
 *     without `cellDates` for that reason; the only date the ETL emits,
 *     `Submission date`, is already stored as an ISO string.
 */

import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';

export const SHEETS = {
  master: 'Raw data with readiness level',
  technicalInfrastructure: 'Tech.infr_readiness scoring',
  workforceCapacity: 'Workforce_readiness scoring',
  workflowTransition: 'Workflow_readiness scoring',
  dataUseReporting: 'Data use & rep._readiness scori',
  survey: 'survey',
  choices: 'choices',
  rubric: 'Facility Scoring Rubric',
};

/** Theme id → the column-name fragment used in that theme's score columns. */
export const THEME_COLUMN_PREFIX = {
  technical_infrastructure: 'technical infrastructure thematic area',
  workforce_capacity: 'workforce capacity thematic area',
  workflow_transition: 'workflow and transition thematic area',
  data_use_reporting: 'data use and reporting thematic area',
};

export const THEME_SHEET = {
  technical_infrastructure: SHEETS.technicalInfrastructure,
  workforce_capacity: SHEETS.workforceCapacity,
  workflow_transition: SHEETS.workflowTransition,
  data_use_reporting: SHEETS.dataUseReporting,
};

/** Normalise a header: collapse embedded newlines and repeated spaces. */
export function normalizeHeader(raw) {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Locate the header row by a known cell, rather than assuming an index. */
export function findHeaderRow(rows, marker = 'Name of facility') {
  const idx = rows.findIndex((row) =>
    row.some((cell) => normalizeHeader(cell) === marker),
  );
  if (idx === -1) {
    throw new Error(`Could not find header row (looking for "${marker}")`);
  }
  return idx;
}

/** Read one sheet into { columns, rows } with objects keyed by header. */
export function readSheet(workbook, sheetName, marker) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);

  const grid = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });

  const headerIdx = findHeaderRow(grid, marker);
  const rawColumns = (grid[headerIdx] ?? []).map(normalizeHeader);

  // Header names repeat on the master sheet: several questions appear twice,
  // once holding the raw response and once holding its 1/3/5 score. Keying by
  // name alone silently takes whichever comes last, which quietly swaps raw
  // labels for scores and makes every descriptive figure wrong. Disambiguate
  // by suffixing repeats — the first occurrence keeps the plain name.
  const seen = new Map();
  const columns = rawColumns.map((col) => {
    if (!col) return col;
    const count = (seen.get(col) ?? 0) + 1;
    seen.set(col, count);
    return count === 1 ? col : `${col}#${count}`;
  });

  const duplicates = [...seen.entries()].filter(([, n]) => n > 1);
  if (duplicates.length) {
    console.log(
      `  · ${sheetName}: ${duplicates.length} duplicated header(s); ` +
        'first occurrence keeps the plain name, repeats suffixed #2, #3…',
    );
  }

  const rows = grid.slice(headerIdx + 1).flatMap((row) => {
    // Rows with no facility name are spacers or notes, not data.
    if (row[0] == null || String(row[0]).trim() === '') return [];
    const obj = {};
    columns.forEach((col, i) => {
      if (col) obj[col] = row[i] ?? null;
    });
    return [obj];
  });

  return { columns, rows };
}

export async function readEraDataset(filePath) {
  const buf = await readFile(filePath);
  // No `cellDates` — see the header note on pre_implementation_steps.
  const workbook = XLSX.read(buf, { type: 'buffer' });

  const master = readSheet(workbook, SHEETS.master);

  // Per-theme sheets are where the core/supporting boundary is visible: the
  // indicator score columns sit between the '(core components)' and
  // '(supporting components)' markers. See deriveIndicatorClasses().
  const themeSheets = {};
  for (const [themeId, sheetName] of Object.entries(THEME_SHEET)) {
    try {
      themeSheets[themeId] = readSheet(workbook, sheetName);
    } catch (err) {
      console.warn(`  ! ${sheetName}: ${err.message}`);
    }
  }

  return { workbook, ...master, themeSheets, index: indexColumns(master.columns) };
}

// ---------------------------------------------------------------------------
// Column resolution
// ---------------------------------------------------------------------------

/**
 * The ODK question code at the head of a header, or null.
 *
 * 'C3.2 When fully operational…' → 'C3.2'.  'K3 If no, why…' → 'K3' (that one
 * has no trailing dot). 'computing_devices_available' → null.
 *
 * The trailing dot is stripped so 'D1.' and 'D1' are the same code — which also
 * keeps 'D1' from matching 'D1.2', the thing a naive prefix test gets wrong.
 */
export function questionCode(header) {
  const m = /^([A-Z]\d+(?:\.\d+)*)\.?(?=\s|$)/.exec(String(header ?? '').trim());
  return m ? m[1] : null;
}

/**
 * Build code → [column names] and a set of every column name.
 *
 * The '#2' repeats are deliberately left out of the code index: 'C2' names the
 * raw response, and its score copy is reached only through resolveScoreColumn.
 * Indexing both would make every scored code ambiguous.
 */
export function indexColumns(columns) {
  const byCode = new Map();
  for (const col of columns) {
    if (!col || /#\d+$/.test(col)) continue;
    const code = questionCode(col);
    if (!code) continue;
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(col);
  }
  return { byCode, names: new Set(columns.filter(Boolean)) };
}

/**
 * Resolve one column reference from indicatorBindings.mjs.
 *
 *   '=exact header'        exact match
 *   'C3.1'                 ODK question code
 *   'I1~Has this facility' code plus a substring disambiguator
 *
 * Returns null when the reference matches nothing — the caller decides whether
 * that is a gap to report or an error. Ambiguity, on the other hand, always
 * throws: a reference that matches two columns is a binding bug, and picking one
 * silently is how an indicator ends up scored against the wrong question.
 */
export function resolveColumn(ref, index) {
  if (ref.startsWith('=')) {
    const name = ref.slice(1);
    return index.names.has(name) ? name : null;
  }

  const [code, needle] = ref.split('~');
  const candidates = index.byCode.get(code) ?? [];
  const matches = needle
    ? candidates.filter((c) => c.toLowerCase().includes(needle.toLowerCase()))
    : candidates;

  if (matches.length > 1) {
    throw new Error(
      `Ambiguous column reference "${ref}" — matches ${matches.length}: ` +
        matches.map((m) => `"${m.slice(0, 60)}"`).join(', '),
    );
  }
  return matches[0] ?? null;
}

/**
 * Resolve a score reference. '#C2' means the score copy of C2 — on the master
 * sheet each scored question appears twice, response first and score second, and
 * readSheet() suffixes the repeat '#2'.
 */
export function resolveScoreColumn(ref, index) {
  if (ref.startsWith('#')) {
    const base = resolveColumn(ref.slice(1), index);
    if (!base) return null;
    const scored = `${base}#2`;
    return index.names.has(scored) ? scored : null;
  }
  return resolveColumn(ref.startsWith('=') ? ref : `=${ref}`, index);
}

// ---------------------------------------------------------------------------
// Indicator classes
// ---------------------------------------------------------------------------

/**
 * Score columns that sit inside a component block but do not enter its mean.
 *
 * `emr_transition_status` is the only one. It holds 1/3/5 and sits immediately
 * before the workflow supporting marker, but including it puts the recomputed
 * supporting component wrong for all 150 EMR facilities and right for none;
 * excluding it reproduces the published column for all 2,695 rows. It reads as a
 * status field parked at the end of the block rather than a weighted indicator,
 * so it is carried as contextual — displayed with its score, weighted zero.
 */
export const EXCLUDED_FROM_MEAN = {
  emr_transition_status:
    'holds 1/3/5 but is excluded from the published supporting mean; carried as contextual',
};

/** A column is score-bearing if every value it holds is 0, 1, 3 or 5. */
function isScoreBearing(rows, column) {
  let sawScore = false;
  for (const row of rows) {
    const v = row[column];
    if (v == null || v === '') continue;
    if (typeof v !== 'number') return false;
    if (v === 1 || v === 3 || v === 5) sawScore = true;
    else if (v !== 0) return false;
  }
  return sawScore;
}

function sameValues(rows, a, b) {
  return rows.every((row) => row[a] === row[b]);
}

/**
 * Recover each indicator's weighting class from column position.
 *
 * The rubric's CSV export lost this — core vs supporting was encoded as cell
 * fill colour in the source Google Sheet, and only the legend text survived. The
 * per-theme scoring sheets preserve it structurally: the indicator score columns
 * sit between the end of the shared preamble (which ends at question B7) and the
 * '(core components)' marker, then between that marker and '(supporting
 * components)'.
 *
 * Two things a position rule alone gets wrong, both found by checking the result
 * against the published component columns:
 *
 *   - the blocks are not solid runs of score columns. The technical core block
 *     also carries four count columns (`computing_devices_available`,
 *     `number_service_points`, `number_permanent_digital_staff`,
 *     `minimum_required_devices`), so membership is decided by the values a
 *     column holds, not by its position alone.
 *   - `device_*` and `functional_device_*` are five pairs of byte-identical
 *     columns. Counting both double-weights the service-point device question
 *     against every other workflow indicator.
 *
 * With those handled the recomputation is exact: 2,804/2,804 rows on technical
 * infrastructure and workforce capacity, 2,695/2,695 on workflow and data use,
 * for both the core and the supporting component. verifyThemeComponents()
 * asserts it on every build.
 */
export function deriveIndicatorClasses(themeSheet, themeId) {
  const prefix = THEME_COLUMN_PREFIX[themeId];
  const { columns, rows } = themeSheet;
  const lower = columns.map((c) => (c ?? '').toLowerCase());

  const marker = (needle) =>
    lower.findIndex((c) => c.startsWith(prefix) && c.includes(needle));

  const coreMarker = marker('core');
  const supportingMarker = marker('supporting');
  if (coreMarker === -1 || supportingMarker === -1) {
    throw new Error(`Could not locate component markers for ${themeId}`);
  }

  // The preamble — identity, geography, consent, B1–B7 — is identical on all
  // four sheets and ends at B7. Anchoring on it keeps a context column that
  // happens to hold small integers out of the indicator set.
  const b7 = columns.findIndex((c) => questionCode(c) === 'B7');
  if (b7 === -1) throw new Error(`Could not locate the preamble end (B7) for ${themeId}`);
  const blockStart = b7 + 1;

  const core = [];
  const supporting = [];
  const excluded = [];

  for (let i = blockStart; i < supportingMarker; i++) {
    const col = columns[i];
    if (!col || i === coreMarker) continue;
    if (!isScoreBearing(rows, col)) continue;

    const bucket = i < coreMarker ? core : supporting;

    if (EXCLUDED_FROM_MEAN[col]) {
      excluded.push({ column: col, themeId, reason: EXCLUDED_FROM_MEAN[col] });
      continue;
    }

    const twin = bucket.find((other) => sameValues(rows, col, other));
    if (twin) {
      excluded.push({
        column: col,
        themeId,
        reason: `identical in every row to "${twin}"; counted once`,
      });
      continue;
    }

    bucket.push(col);
  }

  return { core, supporting, excluded, coreMarker, supportingMarker };
}

/**
 * column name → { class, themeId }, across all four themes.
 *
 * Keys are canonical: the '#2' suffix readSheet() adds to the master sheet's
 * score copies is stripped, so a lookup works whichever sheet the caller is
 * holding. Duplicate columns alias to the twin that was kept, so
 * `functional_device_lab` and `device_lab` both answer 'core' while only one of
 * them is ever counted.
 */
export function canonicalColumn(name) {
  return String(name ?? '').replace(/#\d+$/, '');
}

export function buildClassMap(themeSheets) {
  const classByColumn = {};
  const aliasByColumn = {};
  const excluded = [];
  const byTheme = {};

  for (const themeId of Object.keys(THEME_SHEET)) {
    const sheet = themeSheets[themeId];
    if (!sheet) continue;
    const spec = deriveIndicatorClasses(sheet, themeId);
    byTheme[themeId] = spec;
    for (const col of spec.core) classByColumn[canonicalColumn(col)] = { class: 'core', themeId };
    for (const col of spec.supporting) {
      classByColumn[canonicalColumn(col)] = { class: 'supporting', themeId };
    }
    for (const e of spec.excluded) {
      excluded.push(e);
      const twin = /identical in every row to "(.+)"/.exec(e.reason)?.[1];
      if (twin) aliasByColumn[canonicalColumn(e.column)] = canonicalColumn(twin);
    }
  }

  /** Class of a column, following the '#2' and duplicate-twin aliases. */
  const classOf = (name) => {
    const key = canonicalColumn(name);
    return classByColumn[key] ?? classByColumn[aliasByColumn[key]] ?? null;
  };

  return { classByColumn, aliasByColumn, classOf, excluded, byTheme };
}

/**
 * Assert that the derived column spec reproduces the published component
 * columns. This is the gate on the whole classification: if a column is added,
 * dropped or misclassified, the recomputed mean stops matching and the build
 * says so instead of shipping a plausible wrong number.
 */
export function verifyThemeComponents(themeSheets, byTheme) {
  const lines = [];
  let ok = true;

  for (const [themeId, spec] of Object.entries(byTheme)) {
    const { columns, rows } = themeSheets[themeId];
    const coreCol = columns[spec.coreMarker];
    const supCol = columns[spec.supportingMarker];

    const agree = (cols, published, weight) =>
      rows.filter((row) => {
        const vals = cols.map((c) => row[c]).filter((v) => typeof v === 'number');
        const calc = vals.length
          ? (vals.reduce((a, b) => a + b, 0) / vals.length) * weight
          : null;
        const pub = typeof row[published] === 'number' ? row[published] : null;
        if (calc == null || pub == null) return calc == null && pub == null;
        return Math.abs(calc - pub) < 1e-6;
      }).length;

    const n = rows.length;
    const coreOk = agree(spec.core, coreCol, 0.7);
    const supOk = agree(spec.supporting, supCol, 0.3);
    const good = coreOk === n && supOk === n;
    ok = ok && good;

    lines.push(
      `${good ? '✓' : '✗'} ${themeId}: recomputed components match published ` +
        `(core ${coreOk}/${n} from ${spec.core.length} cols, ` +
        `supporting ${supOk}/${n} from ${spec.supporting.length} cols)`,
    );
  }

  return { ok, lines };
}

/** 'Not Ready' / 'Not ready' → 'not_ready'. */
export function normalizeBand(value) {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  if (key === 'not ready') return 'not_ready';
  if (key === 'moderately ready') return 'moderately_ready';
  if (key === 'ready') return 'ready';
  return null;
}
