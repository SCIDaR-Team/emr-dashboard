/**
 * Fetch one facility's full detail, sharded per UUID under
 * `public/data/facilities/{uuid}.json`. Not part of DataProvider — unlike the
 * summary and the aggregates, this is not needed until the Scorecard opens,
 * and there are 2,804 shards, so loading them all up front would be exactly
 * the payload-budget mistake the build guide's §11 sharding is meant to avoid.
 */

import { useFetchJSON } from './useFetchJSON';
import { DATA_PATHS } from '@/lib/constants';
import type { Facility } from '@/lib/types';

export function useFacility(uuid: string | undefined) {
  return useFetchJSON<Facility | null>({
    path: uuid ? DATA_PATHS.facility(uuid) : null,
    fallback: null,
  });
}
