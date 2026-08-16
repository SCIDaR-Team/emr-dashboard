/**
 * Readiness bands — the three-way classification used across every surface.
 *
 * Derived from `ERA dataset_v4.xlsx` by reading the score range of each
 * published `…(maturity level)` label across all four scored themes:
 *
 *   Not ready         TI ≤2.333  WF ≤2.200  WK ≤2.333  DU ≤2.100
 *   Moderately ready  TI 2.350–3.667  WF 2.400–3.600  WK 2.337–3.673  DU 2.400–3.600
 *   Ready             TI 3.675–4.694  WF 3.800–5.000  WK 3.677–4.805  DU 3.700–4.650
 *
 * The cut points are equal terciles of the 1–5 range: 1 + 4/3 and 1 + 8/3.
 */

import type { Band, MaturityLevel } from './types';

export const BAND_LOWER_CUT = 1 + 4 / 3; // 2.3333…
export const BAND_UPPER_CUT = 1 + 8 / 3; // 3.6666…

export const BANDS: readonly Band[] = ['not_ready', 'moderately_ready', 'ready'] as const;

/** Ordinal rank — use for comparisons rather than string equality chains. */
export const BAND_RANK: Record<Band, number> = {
  not_ready: 1,
  moderately_ready: 2,
  ready: 3,
};

export const BAND_LABEL: Record<Band, string> = {
  not_ready: 'Not ready',
  moderately_ready: 'Moderately ready',
  ready: 'Ready',
};

/** The action each band implies — used on the Assessment States donut legend. */
export const BAND_ACTION: Record<Band, string> = {
  not_ready: 'Foundational investment',
  moderately_ready: 'Targeted intervention',
  ready: 'Immediate roll out',
};

export const BAND_TIMELINE: Record<Band, string> = {
  not_ready: 'Year 1+',
  moderately_ready: '6 months to 1 year',
  ready: 'Under 6 months',
};

/**
 * Tailwind class fragments per band.
 *
 * Every status colour in the app comes from here. Note each entry pairs the
 * colour with a text label or icon at the call site — colour alone does not
 * survive a colour-vision deficiency or a greyscale print-out.
 *
 * `texture` is the carrier for the places where a label will not fit: a map
 * polygon, a 6px distribution segment, a donut arc. See `BAND_TEXTURE` below.
 */
export const BAND_CLASSES: Record<
  Band,
  { text: string; bg: string; wash: string; border: string; fill: string; texture: string }
> = {
  not_ready: {
    text: 'text-notready',
    bg: 'bg-notready',
    wash: 'bg-notready-wash',
    border: 'border-notready',
    fill: 'fill-notready',
    texture: 'band-texture-notready',
  },
  moderately_ready: {
    text: 'text-moderate',
    bg: 'bg-moderate',
    wash: 'bg-moderate-wash',
    border: 'border-moderate',
    fill: 'fill-moderate',
    texture: 'band-texture-moderate',
  },
  ready: {
    text: 'text-ready',
    bg: 'bg-ready',
    wash: 'bg-ready-wash',
    border: 'border-ready',
    fill: 'fill-ready',
    texture: 'band-texture-ready',
  },
};

// ---------------------------------------------------------------------------
// The non-colour carrier
// ---------------------------------------------------------------------------
//
// The scale is red / amber / green, which is the single worst combination for
// the most common colour-vision deficiencies — deuteranopia and protanopia both
// collapse red and green towards each other, and our amber and red are within
// four points of the same lightness, so they do not separate in greyscale
// either. `BandBadge` has always paired the colour with an icon and a label.
// These three tables extend that pattern to the surfaces where no label fits.
//
// One shape vocabulary, three renderings, because the media genuinely differ:
//
//   BAND_TEXTURE   area fills — CSS classes for HTML, `<pattern>` for SVG
//                  (`components/map/BandPattern.tsx`)
//   BAND_MARKER    point marks, where a texture inside a 6px dot is invisible
//                  and the shape of the dot is the thing that reads
//   BAND_DECAL     canvas — ECharts cannot use either of the above
//                  (`components/charts/chartTheme.ts`)
//
// Keep them saying the same thing. A reader who learns "dots mean moderate" on
// the map must not meet a different dots on the donut beside it.
//
// Ready is deliberately the untextured one. It is the band that should read as
// solid and complete, and leaving the best case clean keeps the texture from
// looking like damage.

export type BandTexture = 'solid' | 'dots' | 'stripes';

export const BAND_TEXTURE: Record<Band, BandTexture> = {
  ready: 'solid',
  moderately_ready: 'dots',
  not_ready: 'stripes',
};

/** Point marks. Ordinal: the sides go up as readiness goes down. */
export type BandMarker = 'circle' | 'square' | 'triangle';

export const BAND_MARKER: Record<Band, BandMarker> = {
  ready: 'circle',
  moderately_ready: 'square',
  not_ready: 'triangle',
};

/** Spoken form of the carrier, for legends and tooltips. */
export const BAND_TEXTURE_LABEL: Record<BandTexture, string> = {
  solid: 'solid',
  dots: 'dotted',
  stripes: 'striped',
};

/** CSS custom-property name per band, for SVG/ECharts that cannot use classes. */
export const BAND_CSS_VAR: Record<Band, string> = {
  not_ready: '--not-ready',
  moderately_ready: '--moderate',
  ready: '--ready',
};

/**
 * Classify a 1–5 score into a band.
 *
 * Returns null for null input so "no data" stays distinguishable from
 * "not ready" — conflating the two would overstate how much is known.
 */
export function toBand(score: number | null | undefined): Band | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score <= BAND_LOWER_CUT) return 'not_ready';
  if (score <= BAND_UPPER_CUT) return 'moderately_ready';
  return 'ready';
}

/** Resolve a band to its live colour, reading the CSS variable at call time so
 *  the value tracks light/dark. Pass an element to scope the lookup. */
export function bandColor(band: Band | null, el?: HTMLElement): string {
  const root = el ?? document.documentElement;
  if (!band) {
    return `hsl(${getComputedStyle(root).getPropertyValue('--no-data').trim()})`;
  }
  const raw = getComputedStyle(root).getPropertyValue(BAND_CSS_VAR[band]).trim();
  return `hsl(${raw})`;
}

/** Convenience: score straight to colour. */
export function statusColor(score: number | null, el?: HTMLElement): string {
  return bandColor(toBand(score), el);
}

// ---------------------------------------------------------------------------
// Optional five-band maturity scheme
// ---------------------------------------------------------------------------
//
// The assessment deck describes five maturity levels from the Global Digital
// Health Maturity Framework. The scored dataset does not use them, and the
// Figma's examples match neither the deck's bands nor the dataset's. Kept here
// so the finer labels can be switched on without re-deriving them, but the
// three-band model above is what ships. See build guide §17.2.

export const MATURITY_BANDS: readonly {
  level: MaturityLevel;
  label: string;
  min: number;
  max: number;
}[] = [
  { level: 'nascent', label: 'Nascent', min: 1.0, max: 1.9 },
  { level: 'emerging', label: 'Emerging', min: 2.0, max: 2.9 },
  { level: 'developing', label: 'Developing', min: 3.0, max: 3.9 },
  { level: 'institutionalized', label: 'Institutionalized', min: 4.0, max: 4.5 },
  { level: 'optimized', label: 'Optimized', min: 4.6, max: 5.0 },
] as const;

/** Note the deck's bands are not uniform — Institutionalized spans 0.5 where
 *  the others span 0.9/0.4 — so this is a table lookup, not arithmetic. */
export function toMaturityLevel(score: number | null): MaturityLevel | null {
  if (score == null || !Number.isFinite(score)) return null;
  return MATURITY_BANDS.find((b) => score >= b.min && score <= b.max)?.level ?? null;
}
