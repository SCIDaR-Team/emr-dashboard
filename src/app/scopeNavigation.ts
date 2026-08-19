/**
 * Drilling from a national view into one state.
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
 */

import { useEffect } from 'react';
import { useLocation, type NavigateFunction } from 'react-router-dom';
import { useFilterStore } from '@/store/filterStore';

interface ScopeLocationState {
  /** State name, as it appears on facility rows and in `AreaProfile.name`. */
  scopeState?: string;
}

/** Navigate to `to`, scoping it to one state on arrival. */
export function drillIntoState(
  navigate: NavigateFunction,
  to: string,
  stateName: string,
): void {
  navigate(to, { state: { scopeState: stateName } satisfies ScopeLocationState });
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
  const scopeState = (location.state as ScopeLocationState | null)?.scopeState;

  useEffect(() => {
    if (!scopeState) return;
    const current = useFilterStore.getState().states;
    if (current.length === 1 && current[0] === scopeState) return;
    useFilterStore.getState().setStates([scopeState]);
  }, [scopeState]);
}
