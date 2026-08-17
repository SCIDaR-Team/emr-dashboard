/**
 * The mirror test.
 *
 * `computeCell` recomputes in the browser what `etl/lib/explorerCube.mjs`
 * precomputed at build time. Two copies of one formula drift, and when this one
 * drifts the symptom is subtle in the worst way: the explorer's numbers would
 * change depending on whether a filter happened to be active. So rather than
 * testing the mirror against hand-written expectations, this reads the *shipped*
 * cube and the *shipped* facility summary and asserts they agree cell for cell.
 *
 * That makes the assertion as strong as the dataset: 3,122 geographies × 15
 * thematic nodes, computed two different ways in two different languages.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  computeCell,
  facilityNodeValue,
  formatMetric,
  isIndicatorNode,
  metricValue,
  ordinal,
  pctReady,
  rankAmong,
} from './explorerCube';
import { toBand } from './bands';
import type {
  ExplorerCube,
  FacilitySummary,
  IndicatorDef,
  IndicatorMatrix,
  ThemeNodeId,
} from './types';

const DATA = path.resolve(import.meta.dirname, '../../public/data');

const read = <T>(name: string): T =>
  JSON.parse(readFileSync(path.join(DATA, name), 'utf8')) as T;

const cube = read<ExplorerCube>('explorer-cube.json');
const nodes = read<ThemeNodeId[]>('explorer-nodes.json');
const facilities = read<FacilitySummary[]>('facilities-summary.json');
const matrix = read<IndicatorMatrix>('indicator-scores.json');
const indicatorDefs = read<IndicatorDef[]>('indicators.json');

const byState = (stateId: string) => facilities.filter((f) => f.stateId === stateId);
const lgaKey = (f: FacilitySummary) => `${f.stateId}.${f.lgaId}`;

/** A cube cell, asserted present — a missing one is a failure, not a null. */
const cellOf = (geoId: string, node: ThemeNodeId) => {
  const cell = cube[geoId]?.[node];
  expect(cell, `${geoId}/${node} missing from the cube`).toBeDefined();
  return cell;
};

/** The first facility matching a predicate, asserted present. */
const someFacility = (predicate: (f: FacilitySummary) => boolean) => {
  const found = facilities.find(predicate);
  expect(found).toBeDefined();
  return found as FacilitySummary;
};

const firstFacility = someFacility(() => true);

describe('the shipped data has the shape the explorer expects', () => {
  it('carries 24 thematic nodes across 3,122 geographies', () => {
    // overall + 4 facility themes + 19 sub-themes (v2: close to 1:1 with the
    // 20 scored indicators, since the consolidated methodology mostly gives
    // each indicator its own subdomain — see src/lib/themes.ts).
    expect(nodes).toHaveLength(24);
    expect(Object.keys(cube)).toHaveLength(3122);
  });

  it('gives every facility all 19 sub-theme scores', () => {
    expect(facilities).toHaveLength(2804);
    for (const f of facilities.slice(0, 50)) {
      expect(Object.keys(f.subThemeScores)).toHaveLength(19);
    }
  });

  it('has no Leadership & Governance node — it is state level only', () => {
    expect(nodes.some((n) => n.startsWith('leadership_governance'))).toBe(false);
  });
});

describe('computeCell mirrors the precomputed cube', () => {
  it('reproduces the national cell for every thematic node', () => {
    for (const node of nodes) {
      expect(computeCell(facilities, node), node).toEqual(cellOf('national', node));
    }
  });

  it('reproduces every primary state cell for every thematic node', () => {
    const stateIds = [...new Set(facilities.map((f) => f.stateId))];
    expect(stateIds).toHaveLength(12);

    for (const stateId of stateIds) {
      const population = byState(stateId);
      for (const node of nodes) {
        expect(computeCell(population, node), `${stateId}/${node}`).toEqual(
          cellOf(stateId, node),
        );
      }
    }
  });

  it('reproduces all 305 LGA cells on the overall roll-up and one theme', () => {
    const lgaIds = [...new Set(facilities.map(lgaKey))];
    expect(lgaIds).toHaveLength(305);

    for (const lgaId of lgaIds) {
      const population = facilities.filter((f) => lgaKey(f) === lgaId);
      for (const node of ['overall', 'technical_infrastructure.power'] as const) {
        expect(computeCell(population, node), `${lgaId}/${node}`).toEqual(
          cellOf(lgaId, node),
        );
      }
    }
  });

  it('reproduces single-facility cells, where n is 1', () => {
    for (const f of facilities.slice(0, 200)) {
      const geoId = `${f.stateId}.${f.lgaId}.${f.uuid}`;
      for (const node of nodes) {
        expect(computeCell([f], node), `${geoId}/${node}`).toEqual(cellOf(geoId, node));
      }
    }
  });

  it('returns an empty cell for an empty population, not a zero score', () => {
    const cell = computeCell([], 'overall');
    // The distinction the whole three-band scale rests on: "nothing here to
    // measure" must not render as "measured, and not ready".
    expect(cell).toEqual({
      score: null,
      band: null,
      n: 0,
      scored: 0,
      distribution: { not_ready: 0, moderately_ready: 0, ready: 0 },
    });
  });
});

describe('the overall node', () => {
  it("bands back to the facility archetype split, because it encodes it", () => {
    // Computed under v2, not published — the workbook's own archetype rerun
    // is still pending (see docs/SCORING.md) — so this is a self-consistency
    // check against the shipped summary rather than an external figure.
    const expected = { ready: 0, moderately_ready: 0, not_ready: 0 };
    for (const f of facilities) if (f.archetype) expected[f.archetype] += 1;
    expect(computeCell(facilities, 'overall').distribution).toEqual(expected);
  });

  it('encodes a facility archetype as its composite weight', () => {
    const ready = someFacility((f) => f.archetype === 'ready');
    const moderate = someFacility((f) => f.archetype === 'moderately_ready');
    const not = someFacility((f) => f.archetype === 'not_ready');

    expect(facilityNodeValue(ready, 'overall')).toBe(5);
    expect(facilityNodeValue(moderate, 'overall')).toBe(3);
    expect(facilityNodeValue(not, 'overall')).toBe(1);
  });

  it('differs from a thematic node distribution — the two are not interchangeable', () => {
    const overall = computeCell(facilities, 'overall').distribution;
    const workforce = computeCell(facilities, 'workforce_capacity').distribution;
    expect(workforce).not.toEqual(overall);
  });
});

describe('facilityNodeValue', () => {
  const f = firstFacility;

  it('reads a thematic area straight from the published theme score', () => {
    expect(facilityNodeValue(f, 'workforce_capacity')).toBe(
      f.themeScores.workforce_capacity,
    );
  });

  it('reads a sub-thematic area from the published sub-theme score', () => {
    expect(facilityNodeValue(f, 'technical_infrastructure.power')).toBe(
      f.subThemeScores['technical_infrastructure.power'],
    );
  });

  it('returns null for a node with no facility instrument behind it', () => {
    expect(facilityNodeValue(f, 'leadership_governance')).toBeNull();
    expect(facilityNodeValue(f, 'leadership_governance.policy')).toBeNull();
  });
});

describe('the indicator level', () => {
  // "Operational power availability" — technical_infrastructure.power's core
  // indicator, answered by every facility (no skip pattern behind it).
  const power = 'tech_core_01';

  it('is told apart from a cube node structurally, before the matrix loads', () => {
    // This is what decides whether the matrix gets fetched at all, so it has
    // to be answerable from the static hierarchy alone.
    for (const node of nodes) expect(isIndicatorNode(node), node).toBe(false);
    for (const id of matrix.ids) expect(isIndicatorNode(id), id).toBe(true);
  });

  it('ships one column per scored indicator and one row per facility', () => {
    // 20 under v2 — down from 94 scored questions under v1, consolidated in
    // Facility Scoring Rubric_v2_WORK. See docs/SCORING.md.
    expect(matrix.ids).toHaveLength(20);
    expect(Object.keys(matrix.byFacility)).toHaveLength(2804);
    expect(matrix.answered).toHaveLength(matrix.ids.length);
    for (const f of facilities.slice(0, 20)) {
      expect(matrix.byFacility[f.uuid], f.uuid).toHaveLength(matrix.ids.length);
    }
  });

  it('resolves nothing until the matrix arrives — which is not "no data"', () => {
    const column = matrix.ids.indexOf(power);
    const f = someFacility((x) => matrix.byFacility[x.uuid]?.[column] != null);

    expect(facilityNodeValue(f, power)).toBeNull();
    expect(facilityNodeValue(f, power, null)).toBeNull();
    expect(facilityNodeValue(f, power, matrix)).not.toBeNull();

    // The distinction the UI rests on: mid-fetch the cell reports the
    // population it *will* describe, with nothing scored yet, so a spinner can
    // be told apart from an empty finding.
    const pending = computeCell(facilities, power, null);
    expect(pending.n).toBe(2804);
    expect(pending.scored).toBe(0);
    expect(pending.score).toBeNull();
  });

  it('reads a facility value straight out of the matrix', () => {
    const column = matrix.ids.indexOf(power);
    for (const f of facilities.slice(0, 100)) {
      const raw = matrix.byFacility[f.uuid]?.[column] ?? null;
      expect(facilityNodeValue(f, power, matrix), f.uuid).toBe(raw);
    }
  });

  it("counts each indicator's respondents exactly as the ETL did", () => {
    for (const [k, id] of matrix.ids.entries()) {
      expect(computeCell(facilities, id, matrix).scored, id).toBe(matrix.answered[k]);
    }
  });

  it('carries the same respondent count onto the indicator definitions', () => {
    // The rail warns about thin coverage before the matrix is fetched, using
    // `answeredCount` off indicators.json. If the two ever disagree the warning
    // is about a different question than the one the reader clicks.
    const byId = new Map(indicatorDefs.map((d) => [d.id, d]));
    for (const [k, id] of matrix.ids.entries()) {
      expect(byId.get(id)?.answeredCount, id).toBe(matrix.answered[k]);
    }
  });

  it('reports the thinnest-answered indicator as thin, not as absent', () => {
    const byId = new Map(indicatorDefs.map((d) => [d.id, d]));
    // "Staff willingness to transition fully to EMR" — the only v2 indicator
    // behind a meaningful skip pattern (2,636 of 2,804 answered).
    expect(byId.get('flow_sup_01')?.answeredCount).toBe(2636);
    // Every other indicator is answered by at least 2,780 — coverage is far
    // more uniform under v2 than the old rubric's 20-respondent minimum.
    for (const def of indicatorDefs.filter((d) => d.scoreColumns.length)) {
      expect(def.answeredCount, def.id).toBeGreaterThanOrEqual(2636);
    }
  });

  it('bands an indicator cell on the same three-way scale as every other node', () => {
    const cell = computeCell(facilities, power, matrix);
    expect(cell.band).toBe(toBand(cell.score));
    expect(
      cell.distribution.not_ready +
        cell.distribution.moderately_ready +
        cell.distribution.ready,
    ).toBe(cell.scored);
  });

  it('resolves an unknown node to nothing rather than throwing', () => {
    // Reachable by hand-editing a shared link.
    const cell = computeCell(facilities, 'not_a_real_node', matrix);
    expect(cell.scored).toBe(0);
    expect(cell.score).toBeNull();
    expect(cell.n).toBe(2804);
  });
});

describe('the aggregation choice', () => {
  const cell = computeCell(byState('kano'), 'overall');

  it('denominates % Ready on the scored population', () => {
    expect(pctReady(cell)).toBeCloseTo(
      (cell.distribution.ready / cell.scored) * 100,
      10,
    );
  });

  it('has no % Ready for an empty population', () => {
    expect(pctReady(computeCell([], 'overall'))).toBeNull();
  });

  it('switches which number is on screen', () => {
    expect(metricValue(cell, 'mean_score')).toBe(cell.score);
    expect(metricValue(cell, 'pct_ready')).toBe(pctReady(cell));
  });

  it('formats each measure in its own unit', () => {
    expect(formatMetric(3.4567, 'mean_score')).toBe('3.46');
    expect(formatMetric(26.83, 'pct_ready')).toBe('27%');
    expect(formatMetric(null, 'mean_score')).toBe('—');
  });

  it('ranks the same units differently — which is why both are offered', () => {
    const stateIds = [...new Set(facilities.map((f) => f.stateId))];
    const cells = new Map(
      stateIds.map((id) => [id, computeCell(byState(id), 'overall')] as const),
    );
    const order = (aggregation: 'mean_score' | 'pct_ready') =>
      [...cells.entries()]
        .sort(
          (a, b) =>
            (metricValue(b[1], aggregation) ?? -Infinity) -
            (metricValue(a[1], aggregation) ?? -Infinity),
        )
        .map(([id]) => id);

    expect(order('mean_score')).not.toEqual(order('pct_ready'));
  });
});

describe('rankAmong', () => {
  const values = new Map<string, number | null>([
    ['a', 4.2],
    ['b', 3.4],
    ['c', 3.4],
    ['d', 1.9],
    ['e', null],
  ]);

  it('ranks best-first on the active metric', () => {
    expect(rankAmong('a', values)).toEqual({
      rank: 1,
      of: 4,
      unranked: 1,
      tiedWith: 0,
    });
    expect(rankAmong('d', values)).toEqual({
      rank: 4,
      of: 4,
      unranked: 1,
      tiedWith: 0,
    });
  });

  it('gives tied units the better rank, and skips the one they share', () => {
    expect(rankAmong('b', values)?.rank).toBe(2);
    expect(rankAmong('c', values)?.rank).toBe(2);
    expect(rankAmong('d', values)?.rank).toBe(4);
  });

  it('counts the peers a unit is level with, excluding itself', () => {
    expect(rankAmong('b', values)?.tiedWith).toBe(1);
    expect(rankAmong('c', values)?.tiedWith).toBe(1);
    expect(rankAmong('a', values)?.tiedWith).toBe(0);
  });

  it('reports a whole tied field as tied, not as a winner', () => {
    // The case this exists for: every facility in an LGA carries the same
    // archetype, so all of them are "1st". Ten firsts is a tie, not a ranking,
    // and the UI has to be able to say so.
    const allSame = new Map<string, number | null>(
      ['a', 'b', 'c', 'd'].map((id) => [id, 3]),
    );
    expect(rankAmong('a', allSame)).toEqual({
      rank: 1,
      of: 4,
      unranked: 0,
      tiedWith: 3,
    });
  });

  it('excludes unmeasured peers instead of ranking them last', () => {
    // "No data" and "worst in the country" are different findings.
    expect(rankAmong('e', values)).toBeNull();
    expect(rankAmong('a', values)?.of).toBe(4);
  });

  it('inverts for metrics where low is good', () => {
    expect(rankAmong('d', values, { higherIsBetter: false })?.rank).toBe(1);
  });

  it('has no rank for a unit outside the peer set', () => {
    expect(rankAmong('zz', values)).toBeNull();
  });
});

describe('ordinal', () => {
  it('handles the teens, which do not follow the units digit', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 44, 111, 112].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd',
      '44th', '111th', '112th',
    ]);
  });
});
