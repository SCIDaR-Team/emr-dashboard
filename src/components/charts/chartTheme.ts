/**
 * Chart theming.
 *
 * ECharts draws to a canvas, so it cannot use Tailwind classes or CSS variables
 * — every colour has to be resolved to a literal string at render time. These
 * helpers read the same custom properties `globals.css` defines, so a chart
 * tracks light/dark without a second palette to keep in sync.
 */

import { useThemeStore } from '@/store/themeStore';
import { BAND_CSS_VAR, BAND_TEXTURE, MATURITY_CSS_VAR } from '@/lib/bands';
import type { Band, MaturityLevel } from '@/lib/types';

/**
 * Resolve a CSS custom property to a colour string.
 *
 * The tokens hold HSL channel triples without the `hsl()` wrapper, so Tailwind
 * can apply opacity modifiers to them; wrap them here.
 */
export function cssVar(name: string, alpha = 1): string {
  if (typeof window === 'undefined') return '#888';
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return '#888';
  return alpha === 1 ? `hsl(${raw})` : `hsl(${raw} / ${alpha})`;
}

export interface ChartTheme {
  text: string;
  muted: string;
  grid: string;
  axis: string;
  surface: string;
  tooltipBg: string;
  tooltipBorder: string;
  brand: string;
  noData: string;
  /** The three readiness colours, in ascending order. */
  bands: Record<Band, string>;
  /** The five-level maturity ramp, red through green. See `MATURITY_CSS_VAR`. */
  maturity: Record<MaturityLevel, string>;
  /**
   * Categorical series colours, for the rare chart that is not about readiness.
   * Anything showing Ready / Moderately ready / Not ready must use `bands`
   * instead — those three are load-bearing everywhere else in the app.
   */
  palette: string[];
}

export const CHART_FONT = 'Inter, system-ui, -apple-system, Segoe UI, sans-serif';

/** Reactive chart theme — re-resolves whenever the colour scheme changes. */
export function useChartTheme(): ChartTheme {
  // Subscribed purely so charts recompute on toggle; the value is unused.
  useThemeStore((s) => s.scheme);

  return {
    text: cssVar('--foreground'),
    muted: cssVar('--muted-foreground'),
    grid: cssVar('--border', 0.6),
    axis: cssVar('--border'),
    surface: cssVar('--surface'),
    tooltipBg: cssVar('--surface'),
    tooltipBorder: cssVar('--border'),
    brand: cssVar('--brand-500'),
    noData: cssVar('--no-data'),
    bands: {
      not_ready: cssVar(BAND_CSS_VAR.not_ready),
      moderately_ready: cssVar(BAND_CSS_VAR.moderately_ready),
      ready: cssVar(BAND_CSS_VAR.ready),
    },
    maturity: {
      nascent: cssVar(MATURITY_CSS_VAR.nascent),
      emerging: cssVar(MATURITY_CSS_VAR.emerging),
      developing: cssVar(MATURITY_CSS_VAR.developing),
      institutionalized: cssVar(MATURITY_CSS_VAR.institutionalized),
      optimized: cssVar(MATURITY_CSS_VAR.optimized),
    },
    palette: [
      cssVar('--brand-500'),
      cssVar('--brand-700'),
      '#3D7BB5',
      '#7A4FA8',
      '#C2562C',
      '#5B7089',
      '#2A9D8F',
    ],
  };
}

/**
 * The band textures, as ECharts decals.
 *
 * The third rendering of the one vocabulary in `BAND_TEXTURE` — the CSS classes
 * cover HTML, `components/map/BandPattern.tsx` covers SVG, and this covers the
 * canvas the donuts are drawn on, which can use neither. Solid for Ready,
 * dots for Moderately ready, 135° stripes for Not ready, so a reader who has
 * learnt the map's vocabulary reads the donut beside it the same way.
 *
 * Not ECharts' own `aria.decal`, which assigns patterns by series index: the
 * index of a band is an accident of the data, and the pattern has to be a
 * property of the band itself or two charts on one page will disagree.
 *
 * Drawn in black at low alpha rather than from `--foreground`: these sit on the
 * band colour, which does not follow the scheme, so a near-white mark in dark
 * mode would be a light texture on an unchanged mid-tone amber.
 */
export function bandDecal(band: Band): object | undefined {
  const texture = BAND_TEXTURE[band];
  if (texture === 'solid') return undefined;

  if (texture === 'dots') {
    return {
      symbol: 'circle',
      symbolSize: 0.35,
      color: 'rgba(0, 0, 0, 0.34)',
      dashArrayX: [1, 0],
      dashArrayY: [2, 5],
      rotation: 0,
    };
  }

  return {
    symbol: 'rect',
    symbolSize: 1,
    color: 'rgba(0, 0, 0, 0.26)',
    dashArrayX: [1, 4],
    dashArrayY: [4, 0],
    rotation: (-Math.PI / 180) * 45,
  };
}

/**
 * Shared axis / grid / tooltip defaults.
 *
 * Spread into an option rather than registered as an ECharts theme: a
 * registered theme is resolved once at registration, which would freeze the
 * light-mode colours in place across a toggle.
 */
export function chartBase(theme: ChartTheme) {
  return {
    textStyle: { fontFamily: CHART_FONT, color: theme.text },
    grid: { left: 8, right: 12, top: 24, bottom: 8, containLabel: true },
    tooltip: {
      backgroundColor: theme.tooltipBg,
      borderColor: theme.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: theme.text, fontFamily: CHART_FONT, fontSize: 12 },
      extraCssText: 'box-shadow: 0 4px 12px -2px rgb(0 0 0 / 0.12); border-radius: 8px;',
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: theme.axis } },
      axisTick: { show: false },
      axisLabel: { color: theme.muted, fontSize: 11 },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: theme.muted, fontSize: 11 },
      splitLine: { lineStyle: { color: theme.grid, type: 'dashed' as const } },
    },
  };
}
