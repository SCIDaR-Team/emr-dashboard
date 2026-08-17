import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { toMaturityLevel } from '@/lib/bands';
import { cn } from '@/lib/cn';
import { formatScore } from '@/lib/format';
import { EChart } from './EChart';
import { useChartTheme } from './chartTheme';
import { clamp, RING_HOLE_RATIO, useBoxWidth } from './donutStyle';

export interface DomainDonutProps {
  score: number | null;
  /** Ceiling on the ring diameter. */
  maxDiameter?: number;
  ariaLabel: string;
  className?: string;
}

/** A score ring carries no outside labels, so it needs far less room beside it. */
const SCORE_GUTTER = 8;
const SCORE_DIA_MIN = 124;
const SCORE_DIA_MAX = 190;

/**
 * A theme's score /5, as a ring — the Facility Scorecard's core visual, one per
 * scored theme.
 *
 * Same ring language as `ArchetypeDonut` and the NPHCDA dashboard's donuts: a
 * diameter that follows the card, a thin band around a hole at
 * `RING_HOLE_RATIO`, opening at 12 o'clock, with the drawn arc's ends rounded.
 * It is a score and not a part-to-whole, so there are no segment labels and no
 * legend — the arc runs against a muted track and the figure sits in the hole.
 *
 * The ring fill is the score mapped linearly from 1 (empty) to 5 (full),
 * coloured on the five-level maturity ramp — red at Nascent through to dark
 * green at Optimized — matching the level named on the badge beneath it. That
 * pairing is the point of the finer scale here: 4.0 and 4.6 are both "Ready" on
 * the three-band readiness scale, and a scorecard exists to separate them.
 *
 * No decal on this ring, unlike the readiness donut. The band textures are a
 * three-part vocabulary and there is no fourth or fifth that a reader could
 * learn; what carries the level without colour here is the pair of labels the
 * ring is built around — the score in the hole and the level named below it.
 *
 * The score itself stays an HTML overlay rather than becoming an ECharts centre
 * stack: canvas text cannot be selected, cannot use the app's font hinting, and
 * does not survive a print stylesheet. Its type follows the centre-stack
 * hierarchy — one heavy figure, the rest muted underneath it.
 */
export function DomainDonut({
  score,
  maxDiameter = SCORE_DIA_MAX,
  ariaLabel,
  className,
}: DomainDonutProps) {
  const theme = useChartTheme();
  const [boxRef, boxWidth] = useBoxWidth<HTMLDivElement>();
  const level = toMaturityLevel(score);

  const diameter = clamp(
    SCORE_DIA_MIN,
    boxWidth - SCORE_GUTTER * 2,
    Math.min(SCORE_DIA_MAX, maxDiameter),
  );
  const outerR = diameter / 2;
  const innerR = Math.round(outerR * RING_HOLE_RATIO);

  const fraction = score == null ? 0 : Math.max(0, Math.min(1, (score - 1) / 4));
  // A score of exactly 1.0 is the floor of the scale, so its arc has no length
  // and the ring came out blank — indistinguishable from no data, and with the
  // colour now carrying the maturity level it was the one level that could
  // never be seen. A minimum sliver keeps red on screen. It cannot be mistaken
  // for a larger score: the figure in the hole is right beside it.
  const drawn = score == null ? 0 : Math.max(fraction, 0.015);
  const arcColor = level ? theme.maturity[level] : theme.noData;

  const option = useMemo<EChartsOption>(() => {
    // A full or empty ring has nothing to separate, and a gap with rounded ends
    // would only cut a notch out of a complete arc — which reads as a shortfall.
    const partial = drawn > 0.001 && drawn < 0.999;
    return {
      silent: true,
      series: [
        {
          type: 'pie',
          radius: [innerR, outerR],
          center: ['50%', '50%'],
          startAngle: 90,
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          emphasis: { scale: false },
          padAngle: partial ? 2 : 0,
          itemStyle: { borderRadius: partial ? 3 : 0 },
          data:
            score == null
              ? [{ value: 1, itemStyle: { color: theme.grid } }]
              : [
                  { value: drawn, itemStyle: { color: arcColor } },
                  { value: 1 - drawn, itemStyle: { color: theme.grid } },
                ],
        },
      ],
    };
    // Theme *values*, not the object `useChartTheme` rebuilds each render — see
    // the same note in ArchetypeDonut.
  }, [drawn, innerR, outerR, score, arcColor, theme.grid]);

  return (
    <div ref={boxRef} className={cn('relative flex w-full justify-center', className)}>
      <div className="relative" style={{ width: diameter, height: diameter }}>
        <EChart option={option} height={diameter} ariaLabel={ariaLabel} />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="text-center leading-none">
            <span className="block text-[28px] font-extrabold text-foreground">
              {formatScore(score)}
            </span>
            <span className="mt-1 block text-xs font-medium text-muted-foreground">of 5</span>
          </p>
        </div>
      </div>
    </div>
  );
}
