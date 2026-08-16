#!/usr/bin/env node
/**
 * ETL orchestrator — `npm run data:refresh`.
 *
 * Reads the scored assessment workbook and emits the static JSON the dashboard
 * serves. Everything is precomputed here: the assessment is complete, the
 * dataset never changes, and scoring 132 indicators across 2,804 facilities in
 * the browser on every filter change would be waste.
 *
 * Source of truth is `ERA dataset_v4.xlsx`, NOT the raw `.xlsb` export — the
 * xlsx carries the computed scores, the facility UUID, functionality level and
 * BHCPF flag, none of which are in the ODK export.
 *
 * Usage:
 *   node etl/build.mjs [--source <path>] [--out <dir>] [--strict]
 *
 *   --strict  fail the build when a validation target drifts (use in CI)
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  readEraDataset,
  resolveColumn,
  verifyThemeComponents,
} from './sources/eraDataset.mjs';
import { readScoringRubric } from './sources/scoringRubric.mjs';
import { readXlsForm } from './sources/xlsform.mjs';
import { buildFacilities, toFacilityJSON } from './lib/facilities.mjs';
import { buildRequirementColumns, REQUIREMENTS } from './lib/minimumRequirements.mjs';
import { buildServicePointColumns } from './lib/servicePoints.mjs';
import { rollUp } from './lib/rollup.mjs';
import { buildExplorerCube } from './lib/explorerCube.mjs';
import { attachAnsweredCounts, buildIndicatorMatrix } from './lib/indicatorMatrix.mjs';
import { validate } from './lib/validate.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

const DEFAULT_SOURCE = path.resolve(
  ROOT,
  '../EMR Dashboard/ERA dataset_v4.xlsx',
);
const DEFAULT_RUBRIC = path.resolve(
  ROOT,
  '../EMR Dashboard/Facility Scoring Rubric - Facility Scoring Rubric.csv',
);

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const source = path.resolve(arg('source', DEFAULT_SOURCE));
  const rubricPath = path.resolve(arg('rubric', DEFAULT_RUBRIC));
  const outDir = path.resolve(arg('out', path.join(ROOT, 'public/data')));
  const strict = process.argv.includes('--strict');

  if (!existsSync(source)) {
    console.error(`✗ Source workbook not found: ${source}`);
    console.error('  Pass --source <path> or place ERA dataset_v4.xlsx alongside the repo.');
    process.exit(1);
  }

  console.log(`▸ Reading ${path.basename(source)}`);
  const dataset = await readEraDataset(source);
  console.log(`  ${dataset.rows.length} scored facilities, ${dataset.columns.length} columns`);

  console.log('▸ Reading scoring rubric');
  const rubric = await readScoringRubric(rubricPath, dataset);
  console.log(
    `  ${rubric.indicators.length} indicators ` +
      `(${rubric.counts.core} core, ${rubric.counts.supporting} supporting, ${rubric.counts.contextual} contextual)`,
  );
  for (const e of rubric.excluded) {
    console.log(`  · excluded from the ${e.themeId} mean — ${e.column}: ${e.reason}`);
  }

  console.log('▸ Verifying the derived indicator classes');
  const componentCheck = verifyThemeComponents(dataset.themeSheets, rubric.byTheme);
  for (const line of componentCheck.lines) console.log(`  ${line}`);
  if (!componentCheck.ok) {
    console.error('✗ The core/supporting split no longer reproduces the published components.');
    process.exit(1);
  }

  console.log('▸ Reading XLSForm survey + choices');
  const form = await readXlsForm(source);
  console.log(`  ${Object.keys(form.labels).length} field labels, ${form.lgasByState.size} states in choice list`);

  console.log('▸ Building facilities');
  const servicePointColumns = buildServicePointColumns(dataset.index, resolveColumn);
  const requirementColumns = buildRequirementColumns(dataset.index, resolveColumn);
  const facilities = buildFacilities({
    dataset,
    rubric,
    form,
    servicePointColumns,
    requirementColumns,
  });

  console.log('▸ Rolling up to LGA, state and national');
  const { lgas, states, national } = rollUp(facilities);
  console.log(`  ${lgas.length} LGAs, ${states.length} states`);

  console.log('▸ Building explorer cube');
  const { cube, nodes } = buildExplorerCube({ facilities, lgas, states, national });
  console.log(`  ${Object.keys(cube).length} geographies × ${nodes.length} thematic nodes`);

  // The explorer's fourth thematic level. Not folded into the cube — see
  // indicatorMatrix.mjs — and fetched by the browser only on demand.
  console.log('▸ Building indicator matrix');
  const indicatorMatrix = buildIndicatorMatrix({ facilities, indicators: rubric.indicators });
  const indicatorDefs = attachAnsweredCounts(rubric.indicators, indicatorMatrix);
  const neverAnswered = indicatorMatrix.answered.filter((n) => n === 0).length;
  console.log(
    `  ${indicatorMatrix.ids.length} scored indicators × ${facilities.length} facilities` +
      (neverAnswered ? ` · ${neverAnswered} never answered by any facility` : ''),
  );

  console.log('▸ Validating against published figures');
  const report = validate({ facilities, states });
  for (const line of report.lines) console.log(`  ${line}`);
  if (!report.ok) {
    console.error('✗ Validation failed');
    if (strict) process.exit(1);
    console.error('  Continuing (pass --strict to fail the build)');
  }

  // ---- Emit -------------------------------------------------------------
  await mkdir(path.join(outDir, 'facilities'), { recursive: true });

  // The lean row every list, map and filter reads. It carries every field the
  // filter bar can narrow on — a control that cannot actually filter is worse
  // than an absent one — plus the theme and sub-theme scores, which is what
  // lets the Drill-Down Explorer recompute its cube in the browser when a
  // filter is active (guide §8.4). Without the sub-theme scores the explorer's
  // ten sub-theme nodes would go blank the moment anything was filtered, and a
  // rail entry that resolves to nothing under a filter is the same broken
  // promise as a control that does nothing. Ten more numbers per row costs
  // ~19 KB gzipped over the whole file.
  const summary = facilities.map((f) => ({
    uuid: f.uuid,
    name: f.name,
    state: f.state,
    stateId: f.stateId,
    lga: f.lga,
    lgaId: f.lgaId,
    zone: f.zone,
    geography: f.geography,
    lat: f.lat,
    lon: f.lon,
    functionalityLevel: f.functionalityLevel,
    isBHCPF: f.isBHCPF,
    archetype: f.archetype,
    averageDomainScore: f.averageDomainScore,
    themeScores: Object.fromEntries(
      f.themeScores.map((t) => [t.themeId, t.score]),
    ),
    subThemeScores: f.subThemeScores,
  }));

  let written = 0;
  const write = (name, data) => {
    written += 1;
    return writeFile(path.join(outDir, name), JSON.stringify(data), 'utf8');
  };

  await write('facilities-summary.json', summary);
  await write('states.json', states);
  await write('lgas.json', lgas);
  await write('national.json', national);
  await write('indicators.json', indicatorDefs);
  await write('requirements.json', REQUIREMENTS);
  await write('labels.json', form.labels);
  await write('explorer-cube.json', cube);
  await write('explorer-nodes.json', nodes);
  await write('indicator-scores.json', indicatorMatrix);
  await write('snapshot.json', {
    builtAt: new Date().toISOString(),
    sourceFile: path.basename(source),
    facilityCount: facilities.length,
    statesPrimary: states.filter((s) => s.evidenceGrade === 'primary').length,
    statesSecondary: states.filter((s) => s.evidenceGrade === 'secondary').length,
    archetypeAgreement: report.archetypeAgreement,
    indicatorCounts: rubric.counts,
    thematicNodes: nodes.length,
    /** The on-demand fourth level — not in the cube. */
    indicatorNodes: indicatorMatrix.ids.length,
  });

  // Facility detail, sharded so the Scorecard fetches one file not 2,804.
  await Promise.all(
    facilities.map((f) =>
      write(path.join('facilities', `${f.uuid}.json`), toFacilityJSON(f)),
    ),
  );

  console.log(`\n✓ Wrote ${written} files to ${path.relative(ROOT, outDir)}`);
}

main().catch((err) => {
  console.error('✗ ETL failed:', err);
  process.exit(1);
});
