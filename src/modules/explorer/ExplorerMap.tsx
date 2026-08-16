import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useDataContext } from '@/state/dataContext';
import {
  NigeriaChoropleth,
  StateLGAMap,
  LGAFacilityMap,
  MapLegend,
  BaseMapControl,
  type FacilityPoint,
  type GeoDatum,
} from '@/components/map';
import { BandBadge, EmptyState } from '@/components/ui';
import { titleCaseName, formatScore } from '@/lib/format';
import type { GeoPath } from '@/hooks/useExplorerSelection';
import type { ExplorerData, ExplorerUnit } from '@/hooks/useExplorerData';

interface ExplorerMapProps {
  geoPath: GeoPath;
  /** The resolved selection — the same rows the ranked table below is built
   *  from, so the map and the table can never disagree. */
  data: ExplorerData;
  onDrillInto: (childId: string) => void;
  /** Ascend one level — the zoom-out half of the drill gesture. */
  onDrillUp: () => void;
}

/** What reads the map sits on the left; what changes it sits on the right —
 *  the same row at every drill level, so neither moves as the reader
 *  descends. */
function MapFooter({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {children}
        <BaseMapControl />
      </div>
      {/* The gesture is worth one line of text: nothing on a map announces
          that zooming past its edge is what takes you down a level — and the
          modifier on the wheel needs saying outright, since a bare scroll
          deliberately does nothing here. */}
      <p className="text-xs text-muted-foreground">
        <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-sans text-[10px]">Ctrl</kbd>
        <span className="mx-0.5">/</span>
        <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-sans text-[10px]">⌘</kbd> + scroll, or
        pinch, to zoom. Once zoomed, scroll or drag to move around. Keep zooming in to drill down, or out to come back
        up — and clicking a unit still works.
      </p>
    </>
  );
}

/** One child unit as the map layers want it. */
function toGeoDatum(unit: ExplorerUnit): GeoDatum {
  return {
    band: unit.cell.band,
    n: unit.cell.n,
    evidenceGrade: unit.evidenceGrade,
    label: unit.name,
  };
}

/**
 * The geographic axis of the Drill-Down Explorer (guide §8) — switches map
 * layer by the current drill depth.
 *
 * Colouring goes through `useExplorerData`, which reads the precomputed cube
 * when nothing is filtered and recomputes from the facility summary when
 * something is. Guide §8.3's colouring table ("All themes → composite /
 * archetype", "thematic area → mean", "sub-theme → weighted mean") is resolved
 * there for every consumer at once — this component never computes a score, and
 * because the ranked table is built from the same rows, a fill and a table cell
 * cannot drift apart.
 */
export function ExplorerMap({ geoPath, data, onDrillInto, onDrillUp }: ExplorerMapProps) {
  const { states, lgas } = useDataContext();
  const navigate = useNavigate();
  const { units, unitLevel } = data;

  /** Polygon layers key on the path segment, not the full cube id. */
  const polygonData = useMemo<Record<string, GeoDatum>>(() => {
    if (unitLevel !== 'state' && unitLevel !== 'lga') return {};
    return Object.fromEntries(units.map((u) => [u.childId, toGeoDatum(u)]));
  }, [units, unitLevel]);

  const facilityPoints = useMemo<FacilityPoint[]>(() => {
    if (unitLevel !== 'facility') return [];
    return units.flatMap((u) =>
      u.facility
        ? [
            {
              uuid: u.facility.uuid,
              name: u.facility.name,
              lat: u.facility.lat,
              lon: u.facility.lon,
              band: u.cell.band,
              // At the overall node a facility's cell score is the encoded
              // archetype, not a score. The point label wants the real one.
              score: u.facility.averageDomainScore,
            },
          ]
        : [],
    );
  }, [units, unitLevel]);

  // -------------------------------------------------------------------------
  // National — all 37 states
  // -------------------------------------------------------------------------
  if (geoPath.level === 'national') {
    return (
      <div className="space-y-3">
        <NigeriaChoropleth data={polygonData} selectedId={null} onSelect={onDrillInto} />
        <MapFooter>
          <MapLegend showSecondary />
        </MapFooter>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // State — its LGAs
  // -------------------------------------------------------------------------
  if (geoPath.level === 'state') {
    const stateId = geoPath.stateId!;
    const stateProfile = states.data.find((s) => s.id === stateId);
    if (stateProfile?.evidenceGrade === 'secondary') {
      return (
        <EmptyState
          title={`${stateProfile.name} is a secondary-evidence state`}
          message="Covered by desk review only — no facility-level or LGA-level detail exists to drill into. Use the breadcrumb to return to the national map."
        />
      );
    }
    return (
      <div className="space-y-3">
        <StateLGAMap
          stateId={stateId}
          stateName={stateProfile?.name ?? titleCaseName(stateId)}
          data={polygonData}
          onSelect={onDrillInto}
          onZoomOut={onDrillUp}
        />
        <MapFooter>
          <MapLegend />
        </MapFooter>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // LGA — its facilities
  // -------------------------------------------------------------------------
  if (geoPath.level === 'lga' || geoPath.level === 'facility') {
    const stateId = geoPath.stateId!;
    const lgaId = geoPath.lgaId!;
    const lgaProfile = lgas.data.find((l) => l.id === `${stateId}.${lgaId}`);
    const selectedFacilityId = geoPath.level === 'facility' ? geoPath.facilityId : null;
    const selected = selectedFacilityId
      ? facilityPoints.find((f) => f.uuid === selectedFacilityId)
      : null;

    return (
      <div className="space-y-3">
        <LGAFacilityMap
          stateId={stateId}
          lgaId={lgaId}
          lgaName={titleCaseName(lgaProfile?.name ?? lgaId)}
          facilities={facilityPoints}
          selectedFacilityId={selectedFacilityId}
          onSelect={onDrillInto}
          onZoomOut={onDrillUp}
        />
        <MapFooter>
          {/* Points, not polygons — the facility layer encodes the band as a
              marker shape, so the legend has to show the shapes. */}
          <MapLegend showNoData={false} marks="point" />
        </MapFooter>
        {selected && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-brand-50 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{selected.name}</p>
              <div className="mt-1 flex items-center gap-2">
                <BandBadge band={selected.band} size="sm" />
                {selected.score != null && (
                  <span className="text-xs text-muted-foreground">{formatScore(selected.score)}/5</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/facilities/${selected.uuid}`)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-surface transition-colors hover:bg-brand-600"
            >
              Full Scorecard
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
