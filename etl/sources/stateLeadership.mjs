/**
 * Reader for the `State leadership scoring ` sheet (trailing space in the
 * sheet name is in the workbook itself).
 *
 * Gives Leadership & Governance a real, if partial, score for the 12
 * primary states — the first time any theme-E data has existed in any
 * supplied file. Two things worth knowing before trusting this:
 *
 *  - It covers only 4 of the rubric's 14 Leadership & Coordination
 *    questions (state governance structures, digital-health strategy,
 *    financial commitment, data-governance policy) — closer to the
 *    "Governance strengthening" sub-theme alone than the full instrument.
 *    Treat the resulting score as a partial indicator, not the complete
 *    Leadership assessment the build guide describes.
 *  - It covers the 12 primary states only. The 25 secondary states + FCT
 *    still have no Leadership data in any file — that gap is unchanged.
 *  - The sheet's own top-of-sheet legend (rows 0–2) inverts the band
 *    ranges relative to the per-state values it actually computes below
 *    (row 18 onward) — this reader trusts the per-state "Readiness" column,
 *    which is internally consistent (ascending score → ascending band),
 *    not the legend.
 */

import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';

const SHEET_NAME = 'State leadership scoring ';
const HEADER_MARKER = 'State';
const INDICATOR_COLUMNS = [
  'State governance structures',
  'Digital Health Strategy or Framework',
  'Financial Commitment',
  'Data  Governance Policy',
];

/**
 * state name (as it appears in the sheet, e.g. "Akwa Ibom") -> {
 *   score: number,        average of the 4 indicators, 1-5
 *   indicators: number[], the 4 raw indicator scores
 * }
 */
export async function readStateLeadership(filePath) {
  const buf = await readFile(filePath);
  const workbook = XLSX.read(buf, { type: 'buffer' });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) throw new Error(`Sheet not found: ${JSON.stringify(SHEET_NAME)}`);

  const grid = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });

  // Two tables repeat this shape in the sheet (the per-indicator one, then a
  // second summary just of state/average/readiness). Take the first —
  // it carries the indicator breakdown the second table doesn't.
  const headerIdx = grid.findIndex(
    (row) => row[1] === HEADER_MARKER && INDICATOR_COLUMNS.every((c) => row.includes(c)),
  );
  if (headerIdx === -1) {
    throw new Error(`Could not find the indicator header row in ${JSON.stringify(SHEET_NAME)}`);
  }

  const header = grid[headerIdx];
  const stateCol = header.indexOf('State');
  const indicatorCols = INDICATOR_COLUMNS.map((c) => header.indexOf(c));
  const avgCol = header.indexOf('Average ');

  const byState = new Map();
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const row = grid[i];
    const state = row[stateCol];
    if (!state || typeof state !== 'string') continue;
    const indicators = indicatorCols.map((c) => row[c]);
    if (indicators.some((v) => typeof v !== 'number')) continue;
    const score = typeof row[avgCol] === 'number'
      ? row[avgCol]
      : indicators.reduce((a, b) => a + b, 0) / indicators.length;
    byState.set(state, { score, indicators });
  }

  return byState;
}
