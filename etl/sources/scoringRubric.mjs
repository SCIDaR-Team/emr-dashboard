/**
 * Reader for the Facility Scoring Rubric.
 *
 * Structure: 5 thematic areas -> 13 sub-thematic areas -> 132 survey questions.
 * Columns are Thematic Area | Research Question | Sub-Question | Survey
 * questions | Rationale | 1 - Not Ready | 2 - Moderately Ready | 3 - Ready.
 *
 * This module produces the indicator definitions the dashboard ships, by joining
 * three sources that share no key:
 *
 *   the rubric CSV        question text, sub-theme, response buckets, rationale
 *   indicatorBindings     question -> ODK response column(s) and score column(s)
 *   the scored workbook   which score columns are core and which supporting
 *
 * Two things to know before touching it:
 *
 * 1. The bucket columns are *labels*, not scores. They map onto a 1-5 scale as
 *    1, 3 and 5 — verified against every score column in the workbook, which
 *    contains exactly those three values and nothing else.
 *
 * 2. Class comes from the workbook, not the rubric. The CSV export lost the
 *    core/supporting tagging (it was cell fill colour in the source Google
 *    Sheet), and it is recovered from column position on the per-theme scoring
 *    sheets instead — see deriveIndicatorClasses() in eraDataset.mjs. A question
 *    the workbook never scored is contextual whatever the rubric says about it.
 */

import { readFile } from 'node:fs/promises';
import {
  buildClassMap,
  canonicalColumn,
  resolveColumn,
  resolveScoreColumn,
} from './eraDataset.mjs';
import { BINDINGS, SERVICE_POINT_IDS, UNRUBRICED } from './indicatorBindings.mjs';

/** Rubric bucket column index -> score on the 1-5 scale. */
export const BUCKET_SCORES = { 6: 1, 7: 3, 8: 5 };

/** Minimal RFC 4180 parser — quoted fields, escaped quotes, CRLF or LF. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Split a bucket cell into its response options (one per line). */
function parseOptions(cell) {
  if (!cell) return [];
  return cell.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

const squash = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Read the rubric's 132 questions in sheet order. */
function readQuestions(rows) {
  const questions = [];
  for (const row of rows.slice(2)) {
    const question = squash(row[4]);
    if (!question) continue;
    questions.push({
      label: question,
      rationale: squash(row[5]),
      buckets: Object.fromEntries(
        Object.entries(BUCKET_SCORES).map(([col, score]) => [
          score,
          parseOptions(row[Number(col)]),
        ]),
      ),
    });
  }
  return questions;
}

/** id for an indicator: sub-theme plus the rubric's question number. */
function indicatorId(subThemeId, n) {
  return `${subThemeId}.q${String(n).padStart(3, '0')}`;
}

export async function readScoringRubric(filePath, dataset) {
  const text = await readFile(filePath, 'utf8');
  const questions = readQuestions(parseCsv(text));

  if (questions.length !== BINDINGS.length) {
    throw new Error(
      `Rubric has ${questions.length} questions but indicatorBindings.mjs ` +
        `describes ${BINDINGS.length}. The binding is positional — reconcile ` +
        'the two before building.',
    );
  }

  const { classOf, excluded, byTheme } = buildClassMap(dataset.themeSheets);
  const index = dataset.index;

  const indicators = [];
  const counts = { core: 0, supporting: 0, contextual: 0 };
  const unresolved = [];

  const entries = [
    ...BINDINGS.map((b, i) => ({ binding: b, question: questions[i] })),
    ...UNRUBRICED.map((b) => ({
      binding: b,
      question: { label: b.question, rationale: '', buckets: { 1: [], 3: [], 5: [] } },
    })),
  ];

  for (const { binding, question } of entries) {
    // Positional joins rot silently. If the rubric is re-exported with a row
    // added or moved, this catches it on the next build rather than binding
    // every later question to its neighbour's column.
    if (!question.label.startsWith(binding.question)) {
      throw new Error(
        `Rubric drift at question ${binding.n}: expected it to start ` +
          `"${binding.question}" but found "${question.label.slice(0, 60)}". ` +
          'indicatorBindings.mjs is keyed by position and must be re-checked.',
      );
    }

    const themeId = binding.subThemeId.split('.')[0];

    const sourceColumns = binding.responseColumns
      .map((ref) => {
        const col = resolveColumn(ref, index);
        if (!col) unresolved.push(`q${binding.n} response ${ref}`);
        return col;
      })
      .filter(Boolean);

    const scoreColumns = (binding.scoreColumns ?? [])
      .map((ref) => {
        const col = resolveScoreColumn(ref, index);
        if (!col) unresolved.push(`q${binding.n} score ${ref}`);
        return col;
      })
      .filter(Boolean);

    // The workbook decides the class. A question the rubric gave buckets for but
    // the workbook never scored carries no weight, whatever the rubric intended.
    const classes = new Set(scoreColumns.map((c) => classOf(c)?.class).filter(Boolean));
    if (classes.size > 1) {
      throw new Error(
        `Rubric question ${binding.n} binds to score columns of mixed class: ` +
          `${[...classes].join(', ')}`,
      );
    }
    const cls = classes.size === 1 ? [...classes][0] : 'contextual';

    // Why an indicator carries no weight, so the UI can say which it is.
    let unscoredReason = null;
    if (cls === 'contextual') {
      const hasBuckets = Object.values(question.buckets).some((o) => o.length);
      if (scoreColumns.length) {
        unscoredReason = 'scored_but_unweighted';
      } else if (themeId === 'leadership_governance') {
        unscoredReason = 'state_level_only';
      } else if (hasBuckets) {
        unscoredReason = 'rubric_scored_workbook_did_not';
      } else {
        unscoredReason = 'descriptive';
      }
    }

    counts[cls] += 1;

    indicators.push({
      id: indicatorId(binding.subThemeId, binding.n),
      n: binding.n,
      themeId,
      subThemeId: binding.subThemeId,
      label: question.label,
      class: cls,
      sourceColumns,
      scoreColumns,
      /** Present only for the questions asked once per service point. */
      servicePointIds: scoreColumns.length === 5 ? [...SERVICE_POINT_IDS] : null,
      unscoredReason,
      rubricUnmatched: Boolean(binding.rubricUnmatched),
      buckets: question.buckets,
      rationale: question.rationale,
    });
  }

  if (unresolved.length) {
    throw new Error(
      `${unresolved.length} column reference(s) in indicatorBindings.mjs do not ` +
        `match the workbook: ${unresolved.join(', ')}`,
    );
  }

  verifyEveryScoredColumnIsBound(indicators, byTheme);

  return { indicators, counts, excluded, byTheme, classOf };
}

/**
 * Every column that enters a published component mean must belong to exactly one
 * indicator, and no indicator may claim a column that does not.
 *
 * Without this, a binding that forgets a score column produces theme scores that
 * look reasonable and are quietly wrong — the failure mode this whole join
 * exists to avoid.
 */
function verifyEveryScoredColumnIsBound(indicators, byTheme) {
  const claimed = new Map();
  for (const ind of indicators) {
    for (const col of ind.scoreColumns) {
      const key = canonicalColumn(col);
      if (claimed.has(key)) {
        throw new Error(
          `Score column "${key}" is claimed by two indicators ` +
            `(q${claimed.get(key)} and q${ind.n})`,
        );
      }
      claimed.set(key, ind.n);
    }
  }

  for (const [themeId, spec] of Object.entries(byTheme)) {
    for (const col of [...spec.core, ...spec.supporting]) {
      const key = canonicalColumn(col);
      // The duplicate twins alias onto each other, so accept either name.
      const twin = key.startsWith('device_')
        ? `functional_${key}`
        : key.replace(/^functional_/, '');
      if (!claimed.has(key) && !claimed.has(twin)) {
        throw new Error(
          `Scored column "${key}" (${themeId}) is not bound to any rubric ` +
            'question. Add it to indicatorBindings.mjs.',
        );
      }
    }
  }
}
