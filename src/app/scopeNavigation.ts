/**
 * Drilling from a national view into one state (and optionally one LGA).
 *
 * The scope travels *with the navigation*, as router location state, and is
 * applied by the page being navigated to — never written to the filter store by
 * the page being navigated away from.
 *
 * That is not a style preference. `useFilterUrlSync` mirrors every filter change
 * into the querystring through a relative `setSearchParams`, whose setter is
 * pinned to the pathname it was created on. Writing the scope and navigating in
 * the same handler makes the two race: the filter write resolves against the
 * *old* pathname and rewrites the URL back to it, cancelling the route change
 * and stranding the user on the page they clicked from — now carrying an
 * invisible state filter. Applying the scope after arrival means the write is
 * always bound to the page that wants it.
 *
 * Once applied, the scope is a normal filter like any other, so `useFilterUrlSync`
 * serialises it on the destination: clicking Oyo on the national map lands on
 * `/facilities?state=Oyo`, and narrowing to an LGA there gives
 * `/facilities?state=Oyo&lga=Ibadan%20North`. Both are shareable — a cold load
 * of either URL hydrates the same scope.
 */

import { useEffect } from 'react';
import { useLocation, type NavigateFunction } from 'react-router-dom';
import { useFilterStore } from '@/store/filterStore';

interface ScopeLocationState {
  /** State name, as it appears on facility rows and in `AreaProfile.name`. */
  scopeState?: string;
  /** LGA name, as it appears on facility rows. Only meaningful with a state. */
  scopeLGA?: string;
}

/** Navigate to `to`, scoping it to one state — and one LGA within it — on arrival. */
export function drillIntoState(
  navigate: NavigateFunction,
  to: string,
  stateName: string,
  lgaName?: string,
): void {
  navigate(to, {
    state: { scopeState: stateName, scopeLGA: lgaName } satisfies ScopeLocationState,
  });
}

/**
 * Adopt a scope handed over by `drillIntoState`.
 *
 * Mounted by every page that can be drilled into. A visit with no scope in its
 * location state leaves the filters exactly as they were — this only ever adds
 * the scope the user just asked for, and never clears one they set themselves.
 */
export function useScopeFromNavigation(): void {
  const location = useLocation();
  const nav = location.state as ScopeLocationState | null;
  const scopeState = nav?.scopeState;
  const scopeLGA = nav?.scopeLGA;

  useEffect(() => {
    if (!scopeState) return;
    const { states, lgas, setStates, setLGAs } = useFilterStore.getState();

    const stateMatches = states.length === 1 && states[0] === scopeState;
    const lgaMatches = scopeLGA
      ? lgas.length === 1 && lgas[0] === scopeLGA
      : lgas.length === 0;
    if (stateMatches && lgaMatches) return;

    // Order matters: `setStates` clears the LGA selection, because the LGA
    // options depend on the state. A drill that carries an LGA has to re-apply
    // it after the state, not before.
    if (!stateMatches) setStates([scopeState]);
    if (scopeLGA) setLGAs([scopeLGA]);
    else if (stateMatches) setLGAs([]);
  }, [scopeState, scopeLGA]);
}
