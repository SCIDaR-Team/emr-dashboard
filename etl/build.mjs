#!/usr/bin/env node
/**
 * ETL orchestrator — `npm run data:refresh`.
 *
 * Reads the scored assessment workbook and emits the static JSON the
 * dashboard serves. Everything is precomputed here: the assessment is
 * complete, and scoring 20 indicators across 2,804 facilities in the browser
 * on every filter change would be waste.
 *
 * Source of truth is `ERA dataset_v4.xlsx` at the repo root — the v2 workbook
 * the assessment team delivered with a consolidated, 20-indicator scoring
 * methodology (down from 94). It replaces the earlier copy in
 * `../EMR Dashboard/`, which `eraDataset.mjs`/`scoringRubric.mjs` still know
 * how to read but nothing here calls anymore. See docs/SCORING.md for what
 * changed and why.
 *
 * The v2 workbook has no `survey`/`choices` sheets, so field and geography
 * labels still come from the old file — the underlying ODK instrument did not
 * change, only the scoring layered on top of it. If that file is not found,
 * labels fall back to `titleCaseName()` and the build continues; label
 * quality is a display concern, not a correctness one.
 *
 * Usage:
 *   node etl/build.mjs [--source <path>] [--labels-source <path>] [--out <dir>] [--strict]
 *
 *   --strict  fail the build when a validation target drifts (use in CI)
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { readEraDatasetV2 } from './sources/eraDatasetV2.mjs';
import { resolveColumn } from './sources/eraDataset.mjs';
import { readXlsForm } from './sources/xlsform.mjs';
import { readStateLeadership } from './sources/stateLeadership.mjs';
import { buildFacilities, toFacilityJSON } from './lib/facilities.mjs';
import { buildRequirementColumns, REQUIREMENTS } from './lib/minimumRequirements.mjs';
import { buildServicePointColumns } from './lib/servicePoints.mjs';
import { INDICATORS_V2 } from './lib/indicatorsV2.mjs';
import { rollUp } from './lib/rollup.mjs';
import { buildExplorerCube } from './lib/explorerCube.mjs';
import { attachAnsweredCounts, buildIndicatorMatrix } from './lib/indicatorMatrix.mjs';
import { validate } from './lib/validate.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

const DEFAULT_SOURCE = path.resolve(ROOT, 'ERA dataset_v4.xlsx');
const DEFAULT_LABELS_SOURCE = path.resolve(ROOT, '../EMR Dashboard/ERA dataset_v4.xlsx');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const source = path.resolve(arg('source', DEFAULT_SOURCE));
  const labelsSource = path.resolve(arg('labels-source', DEFAULT_LABELS_SOURCE));
  const outDir = path.resolve(arg('out', path.join(ROOT, 'public/data')));
  const strict = process.argv.includes('--strict');

  if (!existsSync(source)) {
    console.error(`✗ Source workbook not found: ${source}`);
    console.error('  Pass --source <path> or place ERA dataset_v4.xlsx at the repo root.');
    process.exit(1);
  }

  console.log(`▸ Reading ${path.basename(source)}`);
  const dataset = await readEraDatasetV2(source);
  console.log(`  ${dataset.rows.length} scored facilities, ${dataset.columns.length} merged columns`);

  console.log('▸ Reading XLSForm survey + choices (for labels)');
  let form = { labels: {}, choiceLists: {}, lgasByState: new Map() };
  if (existsSync(labelsSource)) {
    form = await readXlsForm(labelsSource);
    console.log(`  ${Object.keys(form.labels).length} field labels, ${form.lgasByState.size} states in choice list`);
  } else {
    console.log(`  ⚠ ${labelsSource} not found — falling back to titleCaseName() for display names`);
  }

  console.log('▸ Building facilities');
  const servicePointColumns = buildServicePointColumns(dataset.index, resolveColumn);
  const requirementColumns = buildRequirementColumns(dataset.index, resolveColumn);
  const facilities = buildFacilities({
    dataset,
    form,
    servicePointColumns,
    requirementColumns,
  });

  console.log('▸ Reading state leadership scoring (Leadership & Governance, 12 primary states)');
  const leadershipByState = await readStateLeadership(source);
  console.log(
    `  ${leadershipByState.size} states — partial coverage (4 of 14 rubric questions); see docs/SCORING.md`,
  );

  console.log('▸ Rolling up to LGA, state and national');
  const { lgas, states, national } = rollUp(facilities, leadershipByState);
  console.log(`  ${lgas.length} LGAs, ${states.length} states`);

  console.log('▸ Building explorer cube');
  const { cube, nodes } = buildExplorerCube({ facilities, lgas, states, national });
  console.log(`  ${Object.keys(cube).length} geographies × ${nodes.length} thematic nodes`);

  // The explorer's fourth thematic level. Not folded into the cube — see
  // indicatorMatrix.mjs — and fetched by the browser only on demand.
  console.log('▸ Building indicator matrix');
  const indicatorMatrix = buildIndicatorMatrix({ facilities, indicators: INDICATORS_V2 });
  const indicatorDefs = attachAnsweredCounts(INDICATORS_V2, indicatorMatrix);
  const neverAnswered = indicatorMatrix.answered.filter((n) => n === 0).length;
  console.log(
    `  ${indicatorMatrix.ids.length} scored indicators × ${facilities.length} facilities` +
      (neverAnswered ? ` · ${neverAnswered} never answered by any facility` : ''),
  );

  console.log('▸ Validating');
  const report = validate({ facilities, states });
  for (const line of report.lines) console.log(`  ${line}`);
  if (!report.ok) {
    console.error('✗ Validation failed');
    if (strict) process.exit(1);
    console.error('  Continuing (pass --strict to fail the build)');
  }

  // ---- Emit -------------------------------------------------------------
  await mkdir(path.join(outDir, 'facilities'), { recursive: true });

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
    indicatorCounts: {
      core: INDICATORS_V2.filter((i) => i.class === 'core').length,
      supporting: INDICATORS_V2.filter((i) => i.class === 'supporting').length,
      contextual: INDICATORS_V2.filter((i) => i.class === 'contextual').length,
    },
    thematicNodes: nodes.length,
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
