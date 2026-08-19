/**
 * Unit rates for the investment schedule.
 *
 * The assessment workbook publishes no cost table, so `unitCostNGN` is null on
 * every item the ETL emits (see `etl/lib/investment.mjs`). Two consequences,
 * and both are deliberate:
 *
 *   1. The page ships with **no rates at all**. Unit cost is an input, and
 *      every total reads "pending" until someone types a figure or NPHCDA signs
 *      a cost table off. An empty column is the honest state.
 *
 *   2. `ILLUSTRATIVE_RATES` below are **invented placeholders**, off by
 *      default, so the costed layout can be reviewed before real rates exist.
 *      Anything derived from them is stamped illustrative wherever it appears.
 *      A naira total in a government investment case must never inherit a
 *      number made up here — if you are reading this because a figure looked
 *      wrong, that is why.
 *
 * When the real table lands, the right move is to populate `unitCostNGN` in the
 * ETL and delete this file, not to edit the numbers below.
 */

import type { InvestmentItem } from '@/lib/types';

/** Placeholder rates, keyed by investment item id. NOT NPHCDA figures. */
export const ILLUSTRATIVE_RATES: Record<string, number> = {
  'ti.device_per_point': 450_000,
  'ti.electricity': 1_250_000,
  'ti.wiring': 380_000,
  'ti.printer': 145_000,
  'ti.backup': 75_000,
  'ti.amenity.fan': 35_000,
  'ti.amenity.desk': 55_000,
  'ti.amenity.lockable_door': 85_000,
  'ti.amenity.sockets': 12_000,
  'ti.amenity.chairs_patient': 18_000,
  'ti.amenity.chairs_staff': 26_000,
  'ti.environment.water_leaks': 320_000,
  'ti.environment.poor_ventilation': 95_000,
  'wf.focal_person': 720_000,
  'wf.ict_support': 540_000,
  'wf.literate': 85_000,
  'wf.role_specific': 120_000,
  'wf.resolution_time': 60_000,
  'wk.records_shared': 350_000,
  'wk.point_of_care': 220_000,
  'wk.sop': 15_000,
  'wk.no_duplicates': 40_000,
  'du.reporting': 40_000,
  'du.exchange': 60_000,
  'du.feedback': 25_000,
  'du.quality': 45_000,
  'du.realtime': 90_000,
  'du.decisions': 30_000,
};

/**
 * What one unit of an item's quantity actually is.
 *
 * Quantities are not uniform: `ti.device_per_point` counts 4,958 *devices*
 * across 1,840 facilities, while `ti.printer` counts 2,688 *facilities*. A rate
 * is meaningless without knowing what it buys, so the table names the unit
 * beside the cost field.
 */
const UNIT_OF: Record<string, string> = {
  'ti.device_per_point': 'per device',
  'ti.amenity.fan': 'per fan',
  'ti.amenity.desk': 'per desk',
  'ti.amenity.lockable_door': 'per door',
  'ti.amenity.sockets': 'per socket',
  'ti.amenity.chairs_patient': 'per chair',
  'ti.amenity.chairs_staff': 'per chair',
  'ti.environment.water_leaks': 'per roof',
  'ti.environment.poor_ventilation': 'per room',
  'wk.sop': 'per SOP set',
  'wf.focal_person': 'per person / yr',
  'wf.ict_support': 'per person / yr',
};

export function unitOf(id: string): string {
  return UNIT_OF[id] ?? 'per facility';
}

export interface RateContext {
  /** Rates typed by the user, keyed by item id. Wins over everything. */
  entered: Record<string, string>;
  /** Whether the placeholder rates are switched on. */
  illustrative: boolean;
}

/** The rate in force for an item: the user's entry, else the placeholder if
 *  switched on, else none. */
export function rateFor(id: string, ctx: RateContext): number | null {
  const typed = ctx.entered[id];
  if (typed != null && typed !== '') {
    const n = Number(typed);
    return Number.isFinite(n) ? n : null;
  }
  if (ctx.illustrative) return ILLUSTRATIVE_RATES[id] ?? null;
  return null;
}

export function lineTotal(item: InvestmentItem, ctx: RateContext): number | null {
  const rate = rateFor(item.id, ctx);
  return rate == null ? null : rate * (item.quantity ?? 0);
}

/** True once any figure on screen rests on a rate we invented. */
export function usesIllustrative(items: InvestmentItem[], ctx: RateContext): boolean {
  if (!ctx.illustrative) return false;
  return items.some((i) => {
    const typed = ctx.entered[i.id];
    return (typed == null || typed === '') && ILLUSTRATIVE_RATES[i.id] != null;
  });
}
