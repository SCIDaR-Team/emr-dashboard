/**
 * Everything the Drill-Down Explorer renders for one selection.
 *
 * The map, the context panel and the ranked table are three views of a single
 * (geography × theme × aggregation × filters) query, so they resolve it once
 * here rather than three times in three components. Guide §8.3 requires that
 * "every number on screen" reflect the active filters; the cheapest way to
 * guarantee that is to leave only one place a number can come from.
 *
 * Two sources, one shape:
 *
 *   no filters   read the precomputed `explorer-cube.json` — a lookup, per §8.4
 *   filtered     recompute from `facilities-summary.json`, because filters
 *                restrict the population *before* aggregation and the cube was
 *                fixed at build time
 *
 * `src/lib/explorerCube.test.ts` asserts the two agree cell for cell across all
 * 3,122 geographies, so switching between them cannot move a figure.
 */

import { useCallback, useMemo } from 'react';
import { useDataContext } from '@/state/dataContext';
import { useFetchJSON } from '@/hooks/useFetchJSON';
import { useFilteredData } from '@/hooks/useFilteredData';
import {
  EMPTY_CELL,
  cellsByGroup,
  computeCell,
  isIndicatorNode,
  metricValue,
  rankAmong,
  type PeerRank,
} from '@/lib/explorerCube';
import { DATA_PATHS } from '@/lib/constants';
import { THEMES, type ThemeDef } from '@/lib/themes';
import { titleCaseName } from '@/lib/format';
import type { GeoPath } from '@/hooks/useExplorerSelection';
import type {
  Aggregation,
  EvidenceGrade,
  ExplorerCell,
  ExplorerCube,
  FacilitySummary,
  IndicatorMatrix,
  ThemeNodeId,
} from '@/lib/types';

/** The geographic level a set of child units sits at. */
export type ChildLevel = 'state' | 'lga' | 'facility';

export interface ExplorerUnit {
  /** Cube key, and the geo path that selects this unit: `kano.dala`. */
  geoId: string;
  /** The single segment to append when drilling in from the current level. */
  childId: string;
  name: string;
  level: ChildLevel;
  cell: ExplorerCell;
  /** The value the active aggregation ranks and colours by. */
  metric: number | null;
  evidenceGrade: EvidenceGrade;
  /** False for secondary-evidence states and for facilities, the leaf level. */
  drillable: boolean;
  /** Facility rows only — the map plots these as points, not polygons. */
  facility?: FacilitySummary;
}

export interface ExplorerPeers {
  /**
   * Null when a peer set exists but this unit cannot be placed in it, because
   * it has no value on the current node — a state where nobody answered the
   * selected question, say. Distinct from `peers` being null, which means there
   * is no peer set at all (Nigeria). "Unrankable" and "has no peers" are
   * different facts and read differently on screen.
   */
  rank: PeerRank | null;
  level: ChildLevel;
  /** Where the peer set is drawn from — "Kano", "Nigeria". */
  within: string;
  units: ExplorerUnit[];
  /** Peers carrying a value on this node — the rank's would-be denominator. */
  measured: number;
}

export interface ThemeCell {
  theme: ThemeDef;
  cell: ExplorerCell;
  /** False for Leadership & Governance, which has no facility instrument. */
  available: boolean;
}

export interface ExplorerData {
  isLoading: boolean;
  /**
   * Which path produced these figures. Surfaced in the UI.
   *
   * `on_demand` is the indicator level, which has no cube entry at any filter
   * setting and is always computed from the lazily fetched matrix.
   */
  source: 'cube' | 'recomputed' | 'on_demand';
  isFiltered: boolean;
  /** True while the indicator matrix is in flight — not the same as no data. */
  isLoadingIndicators: boolean;
  /** Name of the current geography — "Nigeria", "Kano", "Dala", a facility. */
  name: string;
  evidenceGrade: EvidenceGrade;
  /** The current (geography × theme) cell. */
  cell: ExplorerCell;
  /** The current geography's own value on the active aggregation. */
  metric: number | null;
  /**
   * The units the map plots and the ranked table lists, best-first.
   *
   * Children of the current geography — except at the facility leaf, which has
   * none: there the units are its siblings, so selecting a point neither empties
   * the map nor replaces the table with a single row.
   */
  units: ExplorerUnit[];
  unitLevel: ChildLevel | null;
  /** Sibling units and this one's rank among them. Null at national level. */
  peers: ExplorerPeers | null;
  /** All five themes for this location — the small multiples. */
  themeCells: ThemeCell[];
  /** Set at facility level only. */
  facility: FacilitySummary | null;
  /** Facilities in the filtered population, and in the whole assessment. */
  populationShown: number;
  populationTotal: number;
}

/** Facilities of one geography, at whatever depth the path reaches. */
function withinGeo(
  facilities: FacilitySummary[],
  parts: string[],
): FacilitySummary[] {
  const [stateId, lgaId, facilityId] = parts;
  if (!stateId) return facilities;
  return facilities.filter(
    (f) =>
      f.stateId === stateId &&
      (!lgaId || f.lgaId === lgaId) &&
      (!facilityId || f.uuid === facilityId),
  );
}

/** The cube key of the geography one level below `parts` that holds `f`. */
function childKeyOf(depth: number) {
  return (f: FacilitySummary): string | null => {
    if (depth === 0) return f.stateId;
    if (depth === 1) return `${f.stateId}.${f.lgaId}`;
    if (depth === 2) return `${f.stateId}.${f.lgaId}.${f.uuid}`;
    return null;
  };
}

export function useExplorerData(
  geoPath: GeoPath,
  theme: ThemeNodeId,
  aggregation: Aggregation,
): ExplorerData {
  const { states, lgas, explorerCube } = useDataContext();
  const { facilities, allFacilities, isFiltered } = useFilteredData();

  const cube: ExplorerCube = explorerCube.data;
  const population = isFiltered ? facilities : allFacilities;

  /**
   * The indicator matrix, fetched only once an indicator is actually selected.
   *
   * `useFetchJSON` skips a null path and caches by path across the session, so
   * this is one 99 KB request the first time a reader opens the fourth thematic
   * level and nothing at all for the readers who never do. Selecting a *second*
   * indicator costs nothing — the file holds all 50.
   */
  const onIndicator = isIndicatorNode(theme);
  const indicatorFetch = useFetchJSON<IndicatorMatrix | null>({
    path: onIndicator ? DATA_PATHS.indicatorScores : null,
    fallback: null,
  });
  const indicators = indicatorFetch.data;
  const isLoadingIndicators = onIndicator && !indicators;

  const source: ExplorerData['source'] = onIndicator
    ? 'on_demand'
    : isFiltered
      ? 'recomputed'
      : 'cube';

  /**
   * One cell for one geography.
   *
   * The recompute takes the path rather than the cube key, because under a
   * filter there is nothing to look up: the filtered population of a state is
   * not a geography the ETL knew about. An indicator node is never in the cube
   * at all, filtered or not, so it always takes the same road.
   */
  const cellAt = useCallback(
    (geoId: string, node: ThemeNodeId, parts: string[]): ExplorerCell => {
      if (!isFiltered && !isIndicatorNode(node)) {
        return cube[geoId]?.[node] ?? EMPTY_CELL;
      }
      return computeCell(withinGeo(population, parts), node, indicators);
    },
    [cube, isFiltered, population, indicators],
  );

  /**
   * Cells for every child of a path, in one pass over the population.
   *
   * Returns null when no filter is active, which tells `unitsBelow` to read the
   * cube instead. Grouping once matters: looking each child up through
   * `cellAt` would rescan the whole population per child, which at LGA level is
   * 44 scans of 2,804 rows for one render.
   */
  const childCells = useCallback(
    (parts: string[], node: ThemeNodeId): Map<string, ExplorerCell> | null => {
      if (!isFiltered && !isIndicatorNode(node)) return null;
      return cellsByGroup(
        withinGeo(population, parts),
        node,
        childKeyOf(parts.length),
        indicators,
      );
    },
    [isFiltered, population, indicators],
  );

  /**
   * The child units one level below a geographic path.
   *
   * Called twice — once for the current path (the map and the ranked table) and
   * once for its parent (the peer set the rank is taken against).
   *
   * Aggregate children are enumerated from the authoritative area lists, so an
   * LGA whose facilities were all filtered out still appears, as no-data. That
   * is a finding — "no BHCPF facility was assessed here" — and dropping the row
   * would hide it. Facility children come from the population instead: a
   * filtered-out facility is not a facility with no data, it is outside the
   * question being asked.
   */
  const unitsBelow = useCallback(
    (parts: string[]): { level: ChildLevel | null; units: ExplorerUnit[] } => {
      const [stateId, lgaId] = parts;
      const grouped = childCells(parts, theme);
      /** A child's own path is the current path plus its one segment. */
      const cellOf = (geoId: string, childId: string) =>
        grouped
          ? (grouped.get(geoId) ?? EMPTY_CELL)
          : cellAt(geoId, theme, [...parts, childId]);

      if (parts.length === 0) {
        const units = states.data.map<ExplorerUnit>((s) => {
          // A secondary-evidence state has no facility population at all, at
          // any filter setting. Its cell is empty, but the map still draws it
          // hatched rather than as no-data — there *is* state-level evidence,
          // just none this module can aggregate.
          const cell =
            s.evidenceGrade === 'secondary' ? EMPTY_CELL : cellOf(s.id, s.id);
          return {
            geoId: s.id,
            childId: s.id,
            name: s.name,
            level: 'state',
            cell,
            metric: metricValue(cell, aggregation),
            evidenceGrade: s.evidenceGrade,
            drillable: s.evidenceGrade === 'primary',
          };
        });
        return { level: 'state', units };
      }

      if (parts.length === 1) {
        const units = lgas.data
          .filter((l) => l.parentId === stateId)
          .map<ExplorerUnit>((l) => {
            const childId = l.id.split('.')[1] ?? l.id;
            const cell = cellOf(l.id, childId);
            return {
              geoId: l.id,
              childId,
              // The roll-up carries the LGA name as the ODK export spells it,
              // in caps ("ORUMBA SOUTH").
              name: titleCaseName(l.name),
              level: 'lga',
              cell,
              metric: metricValue(cell, aggregation),
              evidenceGrade: 'primary',
              drillable: true,
            };
          });
        return { level: 'lga', units };
      }

      if (parts.length === 2) {
        const units = population
          .filter((f) => f.stateId === stateId && f.lgaId === lgaId)
          .map<ExplorerUnit>((f) => {
            const geoId = `${stateId}.${lgaId}.${f.uuid}`;
            const cell = cellOf(geoId, f.uuid);
            return {
              geoId,
              childId: f.uuid,
              name: f.name,
              level: 'facility',
              cell,
              metric: metricValue(cell, aggregation),
              evidenceGrade: 'primary',
              // The leaf: guide §8.3 sends the reader to the full Scorecard
              // rather than duplicating it here.
              drillable: false,
              facility: f,
            };
          });
        return { level: 'facility', units };
      }

      return { level: null, units: [] };
    },
    [states.data, lgas.data, population, childCells, cellAt, theme, aggregation],
  );

  return useMemo<ExplorerData>(() => {
    const { parts, level, stateId, lgaId, facilityId } = geoPath;

    const geoId = parts.length === 0 ? 'national' : parts.join('.');
    const cell = cellAt(geoId, theme, parts);
    const children = unitsBelow(parts);

    // Rank against siblings rather than against the whole country: an LGA
    // competes with the other LGAs of its state, which is the comparison a
    // reader holding a state plan needs.
    const parent = parts.slice(0, -1);
    const siblings = parts.length ? unitsBelow(parent) : null;
    let peers: ExplorerPeers | null = null;
    if (siblings?.level) {
      peers = {
        rank: rankAmong(
          geoId,
          new Map(siblings.units.map((u) => [u.geoId, u.metric])),
        ),
        level: siblings.level,
        // Reads as "9th of 12 states in Nigeria" / "3rd of 44 LGAs in Kano".
        within:
          parent.length === 0 ? 'Nigeria' : titleCaseName(parent[parent.length - 1]),
        units: siblings.units,
        measured: siblings.units.filter(
          (u) => u.metric != null && Number.isFinite(u.metric),
        ).length,
      };
    }

    const stateProfile = stateId ? states.data.find((s) => s.id === stateId) : null;
    const facility = facilityId
      ? (population.find((f) => f.uuid === facilityId) ?? null)
      : null;

    const name =
      level === 'national'
        ? 'Nigeria'
        : level === 'state'
          ? (stateProfile?.name ?? titleCaseName(stateId))
          : level === 'lga'
            ? titleCaseName(
                lgas.data.find((l) => l.id === `${stateId}.${lgaId}`)?.name ?? lgaId,
              )
            : (facility?.name ?? 'Facility');

    // The facility leaf has no children of its own; its siblings are what the
    // map should keep plotting and the table should keep listing.
    const shown = children.level ? children : (siblings ?? children);

    return {
      isLoading: explorerCube.isLoading || states.isLoading || lgas.isLoading,
      source,
      isFiltered,
      isLoadingIndicators,
      name,
      evidenceGrade: stateProfile?.evidenceGrade ?? 'primary',
      cell,
      metric: metricValue(cell, aggregation),
      // Best-first on the active metric. Unmeasured units sort to the bottom
      // rather than being dropped — the row still says something.
      units: [...shown.units].sort(
        (a, b) => (b.metric ?? -Infinity) - (a.metric ?? -Infinity),
      ),
      unitLevel: shown.level,
      peers,
      themeCells: THEMES.map<ThemeCell>((t) => ({
        theme: t,
        cell: t.facilityLevel ? cellAt(geoId, t.id, parts) : EMPTY_CELL,
        available: t.facilityLevel,
      })),
      facility,
      populationShown: facilities.length,
      populationTotal: allFacilities.length,
    };
  }, [
    geoPath,
    theme,
    aggregation,
    cellAt,
    unitsBelow,
    states.data,
    states.isLoading,
    lgas.data,
    lgas.isLoading,
    explorerCube.isLoading,
    population,
    facilities.length,
    allFacilities.length,
    isFiltered,
    isLoadingIndicators,
    source,
  ]);
}
