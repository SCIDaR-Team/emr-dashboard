/**
 * Reads the precomputed JSON in public/data. The default and, for now, only
 * implementation.
 */

import { DATA_PATHS } from '@/lib/constants';
import type {
  AreaProfile,
  ExplorerCube,
  Facility,
  FacilitySummary,
  IndicatorDef,
  SnapshotMeta,
} from '@/lib/types';
import type { DataSource } from './types';

async function getJSON<T>(path: string, fallback: T): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    if (res.status === 404) return fallback;
    throw new Error(`${path} responded ${res.status}`);
  }
  return (await res.json()) as T;
}

export class StaticDataSource implements DataSource {
  readonly meta = { mode: 'static' as const, label: 'Precomputed assessment snapshot' };

  getFacilitySummaries() {
    return getJSON<FacilitySummary[]>(DATA_PATHS.facilitiesSummary, []);
  }

  getFacility(uuid: string) {
    return getJSON<Facility | null>(DATA_PATHS.facility(uuid), null);
  }

  getStates() {
    return getJSON<AreaProfile[]>(DATA_PATHS.states, []);
  }

  async getLGAs(stateId?: string) {
    const all = await getJSON<AreaProfile[]>(DATA_PATHS.lgas, []);
    return stateId ? all.filter((l) => l.parentId === stateId) : all;
  }

  getNational() {
    return getJSON<AreaProfile | null>(DATA_PATHS.national, null);
  }

  getIndicators() {
    return getJSON<IndicatorDef[]>(DATA_PATHS.indicators, []);
  }

  getExplorerCube() {
    return getJSON<ExplorerCube>(DATA_PATHS.explorerCube, {});
  }

  getSnapshotMeta() {
    return getJSON<SnapshotMeta | null>(DATA_PATHS.snapshot, null);
  }
}
