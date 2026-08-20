/**
 * Reader for the XLSForm definition embedded in ERA dataset_v4.xlsx.
 *
 * The `survey` sheet (1,000 rows) and `choices` sheet (3,684 rows) are the
 * authoritative source for every field label, every response option, and the
 * zone -> state -> LGA cascade. Generating labels from here beats hand-
 * maintaining slug maps, and beats title-casing slugs, which is only a guess.
 *
 * The LGA-count question this used to pose is settled, and not by this sheet:
 * the scored export, the client's own planned-sample list and OCHA/GRID3's
 * ADM2 boundaries all put 305 LGAs in the 12 primary states, matching state by
 * state. The Figma's "205" is a transcription error. See the note on COVERAGE
 * in src/lib/constants.ts.
 */

import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';

function sheetRows(workbook, name) {
  const sheet = workbook.Sheets[name];
  if (!sheet) throw new Error(`Sheet not found: ${name}`);
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
}

export async function readXlsForm(filePath) {
  const buf = await readFile(filePath);
  const workbook = XLSX.read(buf, { type: 'buffer' });

  const survey = sheetRows(workbook, 'survey');
  const choices = sheetRows(workbook, 'choices');

  // field name -> human-readable label
  const labels = {};
  for (const row of survey) {
    const name = row.name?.toString().trim();
    const label = row.label?.toString().trim();
    if (name && label) labels[name] = label;
  }

  // list_name -> { option name -> label }
  const choiceLists = {};
  for (const row of choices) {
    const list = row.list_name?.toString().trim();
    const name = row.name?.toString().trim();
    if (!list || !name) continue;
    choiceLists[list] ??= {};
    choiceLists[list][name] = row.label?.toString().trim() || name;
  }

  // The LGA choice list carries its parent state in a `state` column, which is
  // how the cascading filter is driven.
  const lgasByState = new Map();
  for (const row of choices) {
    if (row.list_name?.toString().trim() !== 'lga') continue;
    const state = row.state?.toString().trim();
    const lga = row.name?.toString().trim();
    if (!state || !lga) continue;
    if (!lgasByState.has(state)) lgasByState.set(state, new Set());
    lgasByState.get(state).add(lga);
  }

  const statesByZone = new Map();
  for (const row of choices) {
    if (row.list_name?.toString().trim() !== 'state') continue;
    const zone = row.zone?.toString().trim();
    const state = row.name?.toString().trim();
    if (!zone || !state) continue;
    if (!statesByZone.has(zone)) statesByZone.set(zone, new Set());
    statesByZone.get(zone).add(state);
  }

  return { survey, choices, labels, choiceLists, lgasByState, statesByZone };
}

/** Resolve a slug through its choice list, falling back to the raw value. */
export function labelFor(choiceLists, listName, value) {
  return choiceLists[listName]?.[value] ?? value ?? '';
}
