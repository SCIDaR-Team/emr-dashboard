/**
 * DataProvider — fetches each dataset once and shares it via context.
 *
 * Pattern borrowed from srh-dashboard/src/state/DataProvider.tsx. Without it,
 * every card that needs facilities triggers its own request on mount.
 *
 * Facility *detail* is deliberately not here: it is sharded per UUID and
 * fetched on demand by the Scorecard (see useFacility).
 *
 * ## What is fetched up front, and what is not
 *
 * This provider sits above every route, so anything it asks for unconditionally
 * is paid for by a reader who lands on Home and goes no further. Home is built
 * entirely from constants and displays no data at all.
 *
 * `explorer-cube.json` is the one dataset that could not justify that. It is
 * 6.71 MB raw (253 kB gzipped, ~45 ms to parse on a desktop) and exactly one
 * route reads it — the Drill-Down Explorer, through `useExplorerData`. It is now
 * fetched only on that route, by the same mechanism Phase 5 used for
 * `indicator-scores.json`: a null path, which `useFetchJSON` skips. Landing on
 * Home dropped from 9.57 MB to 2.86 MB decoded, and from ~562 kB to ~309 kB on
 * the wire.
 *
 * `facilities-summary.json` is comparable in weight (2.45 MB raw, 255 kB
 * gzipped) and is deliberately *not* route-scoped. Three of the five routes read
 * it through `useFilteredData`, it backs the filter bar's option counts on all
 * of them, and it is the dataset every module eventually needs — so scoping it
 * would trade a faster landing page for a stall on the first navigation that
 * actually matters. The cube has no such claim: four routes out of five never
 * touch it.
 */

import { useMemo, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useFetchJSON } from '@/hooks/useFetchJSON';
import { DataContext } from './dataContext';
import { DATA_PATHS } from '@/lib/constants';
import type {
  AreaProfile,
  ExplorerCube,
  FacilitySummary,
  IndicatorDef,
  MinimumRequirementDef,
  SnapshotMeta,
} from '@/lib/types';

/** Routes whose components read the explorer cube. */
const CUBE_ROUTES = ['/explore'];

/**
 * One-way latch: false until the reader first reaches a route that needs the
 * cube, true forever after.
 *
 * The ref is written during render, which is safe precisely because the value
 * only ever widens and is returned in the same pass — there is no state to get
 * out of step and no second render to schedule. When `wanted` flips true the
 * component is already re-rendering (the pathname changed), so the fetch starts
 * on that render rather than an effect later.
 */
function useCubeLatch(wanted: boolean): boolean {
  const everWanted = useRef(false);
  if (wanted) everWanted.current = true;
  return everWanted.current;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  /*
   * Once the cube has been asked for it stays asked for, rather than flipping
   * back to null when the reader leaves the explorer.
   *
   * `useFetchJSON` resolves a null path to the fallback and reports
   * `isLoading: false`, so letting the path drop would hand the explorer an
   * empty cube for a frame on the way back — a flash of "no data" on a route
   * that has the data. Keeping it latched costs nothing: the module-level fetch
   * cache makes the second request a cache hit, not a second download.
   */
  const needsCube = useMemo(
    () => CUBE_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`)),
    [pathname],
  );
  const cubeRequested = useCubeLatch(needsCube);

  const facilities = useFetchJSON<FacilitySummary[]>({
    path: DATA_PATHS.facilitiesSummary,
    fallback: [],
  });
  const states = useFetchJSON<AreaProfile[]>({
    path: DATA_PATHS.states,
    fallback: [],
  });
  const lgas = useFetchJSON<AreaProfile[]>({
    path: DATA_PATHS.lgas,
    fallback: [],
  });
  const national = useFetchJSON<AreaProfile | null>({
    path: DATA_PATHS.national,
    fallback: null,
  });
  const indicators = useFetchJSON<IndicatorDef[]>({
    path: DATA_PATHS.indicators,
    fallback: [],
  });
  const requirementDefs = useFetchJSON<MinimumRequirementDef[]>({
    path: DATA_PATHS.requirements,
    fallback: [],
  });
  const explorerCube = useFetchJSON<ExplorerCube>({
    path: cubeRequested ? DATA_PATHS.explorerCube : null,
    fallback: {},
  });
  const snapshot = useFetchJSON<SnapshotMeta | null>({
    path: DATA_PATHS.snapshot,
    fallback: null,
  });

  return (
    <DataContext.Provider
      value={{
        facilities,
        states,
        lgas,
        national,
        indicators,
        requirementDefs,
        explorerCube,
        snapshot,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
