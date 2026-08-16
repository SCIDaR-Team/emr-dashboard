import { useId } from 'react';
import { BAND_MARKER } from '@/lib/bands';
import type { Band, EvidenceGrade } from '@/lib/types';
import type { BaseMapId } from '@/store/basemapStore';

/**
 * The one boundary colour, for all three layers.
 *
 * `--map-boundary` is near-solid in both schemes (see globals.css) — the old
 * `--foreground / 0.3` was too faint to read as an administrative border.
 * Stroke *widths* stay where they were: bolder here means contrast, not weight.
 */
export const BOUNDARY_STROKE = 'hsl(var(--map-boundary) / 0.9)';

/**
 * How opaque a readiness fill is over the current base map.
 *
 * Over tiles the fill has to let the imagery through or the base map is
 * pointless — but not so far that the three bands stop being distinguishable
 * from each other, which is the fill's actual job.
 */
export function fillOpacityFor(baseMap: BaseMapId): number {
  return baseMap === 'plain' ? 1 : 0.55;
}

/** What a map layer needs to know about one geographic unit to colour and
 *  label it. Shared by all three layers so ExplorerMap builds one shape. */
export interface GeoDatum {
  band: Band | null;
  n: number;
  evidenceGrade: EvidenceGrade;
  label?: string;
}

/**
 * `<pattern>` ids live in the whole document's id space, so every map that
 * renders the secondary-evidence hatch needs its own instance — `useId()`
 * keeps two maps on screen at once (unlikely today, but cheap to guarantee)
 * from colliding.
 */
export function useHatchPatternId(): string {
  const id = useId();
  return `map-hatch-${id.replace(/:/g, '')}`;
}

export function hatchFill(id: string): string {
  return `url(#${id})`;
}

// ---------------------------------------------------------------------------
// The readiness band's non-colour carrier
// ---------------------------------------------------------------------------
//
// `BandPattern.tsx` holds the `<pattern>` component; these are the helpers that
// go with it, kept here for the same reason `useHatchPatternId` is — a module
// that exports both components and plain functions loses fast refresh.

/** One pattern set per map instance — ids are document-global. */
export function useBandPatternId(): string {
  const id = useId();
  return `band-pattern-${id.replace(/:/g, '')}`;
}

export function bandPatternId(id: string, band: Band): string {
  return `${id}-${band}`;
}

/**
 * The `fill` value for a band, or undefined for no data.
 *
 * Callers must leave the `fill-*` Tailwind class *off* a path they fill this
 * way: a class sets `fill` through CSS, which outranks the presentation
 * attribute, and the polygon would come out flat-coloured with the texture
 * silently discarded.
 */
export function bandPatternFill(id: string, band: Band | null | undefined): string | undefined {
  return band ? `url(#${bandPatternId(id, band)})` : undefined;
}

/**
 * Texture tile size for a map, from its **live** viewBox string.
 *
 * All three layers go through this, so a dot is the same size on screen
 * whichever map the reader is on and whatever they have zoomed to — the
 * national view is ~700 viewBox units wide, a rural LGA is under twenty, and a
 * tile in absolute units would be invisible on one and a single stripe across
 * the other. Same correction the stroke widths make by dividing by `view.scale`.
 */
export function textureUnit(viewBox: string): number {
  const width = Number(viewBox.split(' ')[2]);
  return (Number.isFinite(width) && width > 0 ? width : 1000) / 170;
}

/**
 * A facility marker's outline, centred on (cx, cy).
 *
 * Points get *shape* rather than texture: a dot on the facility layer is a few
 * pixels across, and a stripe inside it is neither visible nor countable, while
 * the silhouette reads at any size. Circle → square → triangle as readiness
 * falls, so the mark gets pointier the worse the finding. `BAND_MARKER` in
 * `lib/bands.ts` is the source of truth.
 *
 * Areas are equalised rather than radii: a square drawn at the circle's radius
 * covers ~27% more ink and reads as a different size class rather than a
 * different shape.
 */
export function bandMarkerPath(
  band: Band | null | undefined,
  cx: number,
  cy: number,
  r: number,
): string {
  const marker = band ? BAND_MARKER[band] : 'circle';

  if (marker === 'square') {
    const h = (r * Math.sqrt(Math.PI)) / 2; // half-side of an equal-area square
    return `M ${cx - h} ${cy - h} H ${cx + h} V ${cy + h} H ${cx - h} Z`;
  }

  if (marker === 'triangle') {
    // Equal-area equilateral triangle, point up.
    const side = r * Math.sqrt((4 * Math.PI) / Math.sqrt(3));
    const height = (side * Math.sqrt(3)) / 2;
    const top = cy - (height * 2) / 3;
    const bottom = cy + height / 3;
    return `M ${cx} ${top} L ${cx + side / 2} ${bottom} L ${cx - side / 2} ${bottom} Z`;
  }

  // Circle, as two arcs — so every marker is one <path> and the layer does not
  // have to switch element types per datum.
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`;
}
