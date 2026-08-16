/**
 * Tests for the scoring engine.
 *
 * `npm run data:refresh` already checks the theme formula against the published
 * workbook for all 11,216 facility-themes, which is a far stronger assertion
 * than anything here could be. These cover the parts that gate does *not* reach:
 * the sub-theme formula, which the workbook has no equivalent of, and the
 * edge cases the 2,804-row population happens not to contain.
 */

import { describe, expect, it } from 'vitest';
import {
  classifyFacility,
  compositeReadiness,
  computeSubThemeScores,
  computeThemeScore,
  toBand,
  BAND_LOWER_CUT,
  BAND_UPPER_CUT,
} from './scoring.mjs';

const cell = (subThemeId, cls, score) => ({
  indicatorId: `${subThemeId}.x`,
  subThemeId,
  class: cls,
  score,
});

describe('toBand', () => {
  it('splits the 1–5 range into equal terciles', () => {
    expect(toBand(1)).toBe('not_ready');
    expect(toBand(BAND_LOWER_CUT)).toBe('not_ready');
    expect(toBand(BAND_LOWER_CUT + 1e-9)).toBe('moderately_ready');
    expect(toBand(BAND_UPPER_CUT)).toBe('moderately_ready');
    expect(toBand(BAND_UPPER_CUT + 1e-9)).toBe('ready');
    expect(toBand(5)).toBe('ready');
  });

  it('keeps "no data" distinct from "not ready"', () => {
    expect(toBand(null)).toBeNull();
    expect(toBand(undefined)).toBeNull();
    expect(toBand(Number.NaN)).toBeNull();
  });
});

describe('computeThemeScore', () => {
  it('weights core 70 / supporting 30', () => {
    const { score } = computeThemeScore([
      cell('t.a', 'core', 5),
      cell('t.a', 'supporting', 5),
    ]);
    expect(score).toBeCloseTo(5, 10);
  });

  it('excludes a null indicator from its mean rather than scoring it zero', () => {
    const withNull = computeThemeScore([
      cell('t.a', 'core', 5),
      cell('t.a', 'core', null),
      cell('t.a', 'supporting', 3),
    ]);
    const without = computeThemeScore([
      cell('t.a', 'core', 5),
      cell('t.a', 'supporting', 3),
    ]);
    expect(withNull.score).toBeCloseTo(without.score, 10);
  });

  it('ignores contextual indicators entirely', () => {
    const { score } = computeThemeScore([
      cell('t.a', 'core', 5),
      cell('t.a', 'contextual', 1),
    ]);
    expect(score).toBeCloseTo(3.5, 10);
  });

  it('reproduces the workbook shape: no supporting answers caps the score at 3.5', () => {
    // Not a bug — the published columns behave this way, and 1,658 facilities
    // have no scored Data Use supporting indicator. See docs/VALIDATION.md.
    const { score } = computeThemeScore([cell('t.a', 'core', 5)]);
    expect(score).toBeCloseTo(3.5, 10);
  });

  it('is null when nothing is answered', () => {
    expect(computeThemeScore([]).score).toBeNull();
    expect(computeThemeScore([cell('t.a', 'core', null)]).score).toBeNull();
  });
});

describe('computeSubThemeScores', () => {
  it('renormalises a core-only sub-theme onto the full 1–5 range', () => {
    // The whole point of the divisor: without it this is 3.5, and a sub-theme
    // whose facilities all scored top marks would render "moderately ready".
    const scores = computeSubThemeScores([cell('t.core_only', 'core', 5)]);
    expect(scores['t.core_only']).toBeCloseTo(5, 10);
  });

  it('renormalises a supporting-only sub-theme too', () => {
    // workflow_transition.transition is this shape. Unrenormalised it maxes out
    // at 1.5 and scored 0.08 nationally.
    const scores = computeSubThemeScores([cell('t.sup_only', 'supporting', 5)]);
    expect(scores['t.sup_only']).toBeCloseTo(5, 10);
  });

  it('collapses to the theme formula when both classes are present', () => {
    const cells = [cell('t.both', 'core', 5), cell('t.both', 'supporting', 1)];
    expect(computeSubThemeScores(cells)['t.both']).toBeCloseTo(
      computeThemeScore(cells).score,
      10,
    );
  });

  it('clamps the below-floor zeros to 1 rather than shipping an off-scale score', () => {
    // paper_digital_transition and three others encode their worst case as 0.
    const scores = computeSubThemeScores([cell('t.zeros', 'supporting', 0)]);
    expect(scores['t.zeros']).toBeCloseTo(1, 10);
  });

  it('omits a sub-theme with no weighted indicator instead of returning null', () => {
    // Leadership's three are this case; the explorer needs to tell "not scored
    // here" from "scored, no answer".
    const scores = computeSubThemeScores([cell('leadership.policy', 'contextual', 5)]);
    expect(scores).not.toHaveProperty('leadership.policy');
  });

  it('keeps each sub-theme independent', () => {
    const scores = computeSubThemeScores([
      cell('t.a', 'core', 5),
      cell('t.b', 'core', 1),
    ]);
    expect(scores['t.a']).toBeCloseTo(5, 10);
    expect(scores['t.b']).toBeCloseTo(1, 10);
  });
});

describe('classifyFacility', () => {
  const scores = (ti, wf, wk, du) => ({
    technical_infrastructure: ti,
    workforce_capacity: wf,
    workflow_transition: wk,
    data_use_reporting: du,
  });

  it('is not ready when either core theme is at or below the lower cut', () => {
    expect(classifyFacility(scores(2.0, 5, 5, 5))).toBe('not_ready');
    expect(classifyFacility(scores(5, BAND_LOWER_CUT, 5, 5))).toBe('not_ready');
  });

  it('is ready only when both core themes clear the upper cut and support holds', () => {
    expect(classifyFacility(scores(4.5, 4.5, 3, 3))).toBe('ready');
    expect(classifyFacility(scores(4.5, 4.5, 2.4, 3))).toBe('moderately_ready');
  });

  it('never reaches ready on core alone when a supporting theme is missing', () => {
    // The supporting floor is a real clause, not a tiebreak: dropping it moves
    // agreement with the published column from 98.89% to 95.19%.
    expect(classifyFacility(scores(5, 5, null, null))).toBe('moderately_ready');
  });

  it('is null when neither core theme was scored', () => {
    expect(classifyFacility(scores(null, null, 5, 5))).toBeNull();
  });
});

describe('compositeReadiness', () => {
  it('is the published 5/3/1 weighting', () => {
    expect(compositeReadiness(['ready', 'moderately_ready', 'not_ready'])).toBeCloseTo(3, 10);
    expect(compositeReadiness(['ready', 'ready'])).toBeCloseTo(5, 10);
  });

  it('is null for an empty population rather than zero', () => {
    expect(compositeReadiness([])).toBeNull();
  });
});
