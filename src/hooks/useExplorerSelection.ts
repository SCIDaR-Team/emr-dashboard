/**
 * Drill-Down Explorer selection, encoded in the URL.
 *
 * Two independent axes — geography and thematic — plus the aggregation choice.
 * Keeping them in query params means any view is shareable and the browser back
 * button walks the drill history, which is most of this module's value when
 * someone is presenting from it.
 *
 *   /explore?at=kano.dala&theme=technical_infrastructure.power&agg=mean_score
 *
 * The URL key is `at`, not `geo` — `geo` is already taken by
 * `useFilterUrlSync`'s rural/urban geography filter (`?geo=urban`, mounted
 * globally in AppShell), and the two would silently clobber each other every
 * time the filter-sync effect re-serialises the store: it deletes any `geo`
 * key it doesn't recognise as an active filter and never restores it. Do not
 * rename this back to `geo` without renaming that one first.
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Aggregation, ExplorerSelection, GeoLevel } from '@/lib/types';

const DEFAULTS: ExplorerSelection = {
  geo: '',
  theme: 'overall',
  aggregation: 'mean_score',
};

export interface GeoPath {
  /** Dot path as stored: "" | "kano" | "kano.dala" | "kano.dala.<uuid>" */
  raw: string;
  parts: string[];
  level: GeoLevel | 'facility';
  stateId: string | null;
  lgaId: string | null;
  facilityId: string | null;
}

export function parseGeoPath(raw: string): GeoPath {
  const parts = raw ? raw.split('.').filter(Boolean) : [];
  const level: GeoPath['level'] =
    parts.length === 0
      ? 'national'
      : parts.length === 1
        ? 'state'
        : parts.length === 2
          ? 'lga'
          : 'facility';
  return {
    raw,
    parts,
    level,
    stateId: parts[0] ?? null,
    lgaId: parts[1] ?? null,
    facilityId: parts[2] ?? null,
  };
}

export function useExplorerSelection() {
  const [params, setParams] = useSearchParams();

  const selection = useMemo<ExplorerSelection>(
    () => ({
      geo: params.get('at') ?? DEFAULTS.geo,
      theme: params.get('theme') ?? DEFAULTS.theme,
      aggregation: (params.get('agg') as Aggregation) ?? DEFAULTS.aggregation,
    }),
    [params],
  );

  const geoPath = useMemo(() => parseGeoPath(selection.geo), [selection.geo]);

  const update = useCallback(
    (patch: Partial<ExplorerSelection>) => {
      const next = { ...selection, ...patch };
      // Start from the current params rather than a blank slate, so any
      // foreign key (a filter, if the FilterBar ever lands on this page) rides
      // along instead of being silently dropped by an explorer-only update.
      const sp = new URLSearchParams(params);
      if (next.geo) sp.set('at', next.geo);
      else sp.delete('at');
      if (next.theme !== DEFAULTS.theme) sp.set('theme', next.theme);
      else sp.delete('theme');
      if (next.aggregation !== DEFAULTS.aggregation) sp.set('agg', next.aggregation);
      else sp.delete('agg');
      setParams(sp, { replace: false });
    },
    [selection, params, setParams],
  );

  /** Descend one geographic level. */
  const drillInto = useCallback(
    (childId: string) => {
      update({ geo: selection.geo ? `${selection.geo}.${childId}` : childId });
    },
    [selection.geo, update],
  );

  /** Ascend to a given depth — 0 is national. Drives the breadcrumb. */
  const drillTo = useCallback(
    (depth: number) => {
      update({ geo: geoPath.parts.slice(0, depth).join('.') });
    },
    [geoPath.parts, update],
  );

  const reset = useCallback(() => setParams(new URLSearchParams()), [setParams]);

  return { selection, geoPath, update, drillInto, drillTo, reset };
}
