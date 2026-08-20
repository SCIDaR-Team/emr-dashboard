/**
 * Unit rates in force across the dashboard.
 *
 * These used to be local state on the Investment Plan page, which was fine
 * while that page was the only thing that costed anything. National Coverage
 * now carries a cost column per state, and two pages holding separate copies of
 * "what does a solar backup cost" would show two different national totals for
 * the same assessment.
 *
 * Entries persist: a rate someone typed in is real work and must survive a
 * reload. The illustrative flag persists with them so the loud "these are
 * placeholders" banner comes back too, rather than the invented numbers
 * returning silently as if they were signed off.
 *
 * See `src/modules/investment/investmentRates.ts` for why there are no rates in
 * the source data at all.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface InvestmentRateState {
  /** Rates typed by the user, keyed by investment item id. Wins over
   *  everything. Strings, because they come straight out of an input. */
  entered: Record<string, string>;
  /** Whether the invented placeholder rates are switched on. */
  illustrative: boolean;
  setEntered: (entered: Record<string, string>) => void;
  setRate: (id: string, value: string) => void;
  clearEntered: () => void;
  setIllustrative: (illustrative: boolean) => void;
}

export const useInvestmentRateStore = create<InvestmentRateState>()(
  persist(
    (set) => ({
      entered: {},
      illustrative: false,
      setEntered: (entered) => set({ entered }),
      setRate: (id, value) =>
        set((s) => ({ entered: { ...s.entered, [id]: value } })),
      clearEntered: () => set({ entered: {} }),
      setIllustrative: (illustrative) => set({ illustrative }),
    }),
    { name: 'emr-investment-rates' },
  ),
);
