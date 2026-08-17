/**
 * Reader for the v2 `ERA dataset_v4.xlsx` (dropped at the repo root).
 *
 * This is a different workbook from the one `eraDataset.mjs` reads — the
 * assessment team consolidated the scoring methodology (94 scored indicators
 * down to 20) and reshaped the file entirely. Rather than raw responses and
 * scores interleaved on one 379-column master sheet, this version splits them:
 *
 *   `Raw data with readiness level`   identity, geography, ODK metadata, a
 *                                     REVISED-vs-CURRENT summary block (no
 *                                     per-indicator detail)
 *   `Tech.infr_readiness scoring`     the full raw ODK block again, plus
 *   `Workforce_readiness scoring`     Technical Infrastructure's own derived
 *   `Workflow_readiness scoring`      flags, per-indicator actual/score pairs
 *   `Data use & rep._readiness scori` and weighted theme rollup — one sheet
 *                                     per theme, joined by UUID
 *
 * So a full facility row is the *merge* of all five sheets by UUID, not a
 * single sheet lookup. Column names never collide across the merge: the raw
 * ODK block is character-identical on every sheet (harmless to overwrite with
 * an identical value), and each theme sheet's derived/indicator columns are
 * uniquely named to that theme.
 *
 * Two things worth knowing before touching this file:
 *
 *  - The master sheet alone is NOT enough to build minimum requirements or
 *    device-gap flags — `Minimum devices required`, `Total supported
 *    computing devices`, `Reliable power`, `Power ready` and every per-
 *    indicator score all live only on the per-theme sheets.
 *  - Indicator scores are no longer restricted to {1, 3, 5}. Some indicators
 *    (e.g. power runtime, device sufficiency) genuinely span the full 1–5
 *    scale; others (e.g. wiring, data backup) still take only {1, 3, 5},
 *    per the rubric's own per-indicator scale definition. Verified against
 *    every score column in this workbook — see the value dumps in
 *    docs/SCORING.md.
 */

import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import { findHeaderRow, indexColumns, normalizeHeader } from './eraDataset.mjs';

export const SHEETS_V2 = {
  master: 'Raw data with readiness level',
  technicalInfrastructure: 'Tech.infr_readiness scoring',
  workforceCapacity: 'Workforce_readiness scoring',
  workflowTransition: 'Workflow_readiness scoring',
  dataUseReporting: 'Data use & rep._readiness scori',
};

export const THEME_SHEET_V2 = {
  technical_infrastructure: SHEETS_V2.technicalInfrastructure,
  workforce_capacity: SHEETS_V2.workforceCapacity,
  workflow_transition: SHEETS_V2.workflowTransition,
  data_use_reporting: SHEETS_V2.dataUseReporting,
};

/** Read one sheet into { columns, rows }, objects keyed by header. Same
 *  duplicate-header handling as the v1 reader, kept local so this file has no
 *  dependency on v1 sheet assumptions beyond the three generic helpers. */
function readSheetV2(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);

  const grid = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });

  const headerIdx = findHeaderRow(grid, 'Name of facility');
  const rawColumns = (grid[headerIdx] ?? []).map(normalizeHeader);

  const seen = new Map();
  const columns = rawColumns.map((col) => {
    if (!col) return col;
    const count = (seen.get(col) ?? 0) + 1;
    seen.set(col, count);
    return count === 1 ? col : `${col}#${count}`;
  });

  const rows = grid.slice(headerIdx + 1).flatMap((row) => {
    if (row[0] == null || String(row[0]).trim() === '') return [];
    const obj = {};
    columns.forEach((col, i) => {
      if (col) obj[col] = row[i] ?? null;
    });
    return [obj];
  });

  return { columns, rows };
}

/**
 * Read and merge all five sheets by UUID.
 *
 * The result mimics the v1 reader's `{ rows, columns, index, themeSheets }`
 * shape so the rest of the pipeline barely has to know which version it is
 * reading — `themeSheets` here still exposes each theme's own row set,
 * unmerged, for the class/rollup verification the theme sheets are also used
 * for.
 */
export async function readEraDatasetV2(filePath) {
  const buf = await readFile(filePath);
  const workbook = XLSX.read(buf, { type: 'buffer' });

  const master = readSheetV2(workbook, SHEETS_V2.master);
  const themeSheets = {};
  for (const [themeId, sheetName] of Object.entries(THEME_SHEET_V2)) {
    themeSheets[themeId] = readSheetV2(workbook, sheetName);
  }

  const byUuid = new Map();
  const order = [];
  for (const row of master.rows) {
    const uuid = String(row['UUID'] ?? '').trim();
    if (!uuid) continue;
    byUuid.set(uuid, { ...row });
    order.push(uuid);
  }

  const mergedColumns = new Set(master.columns.filter(Boolean));
  const unmatched = [];
  for (const [themeId, sheet] of Object.entries(themeSheets)) {
    for (const row of sheet.rows) {
      const uuid = String(row['UUID'] ?? '').trim();
      if (!uuid) continue;
      const target = byUuid.get(uuid);
      if (!target) {
        unmatched.push(`${themeId}:${uuid}`);
        continue;
      }
      Object.assign(target, row);
    }
    for (const c of sheet.columns) if (c) mergedColumns.add(c);
  }

  if (unmatched.length) {
    throw new Error(
      `${unmatched.length} row(s) in theme sheets have a UUID not present on ` +
        `the master sheet (first: ${unmatched[0]}). The sheets are expected to ` +
        'share exactly the same 2,804 facilities.',
    );
  }

  const columns = [...mergedColumns];
  const rows = order.map((uuid) => byUuid.get(uuid));

  return { rows, columns, index: indexColumns(columns), themeSheets };
}
