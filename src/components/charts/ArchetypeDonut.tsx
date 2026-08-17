import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { BAND_LABEL } from '@/lib/bands';
import { cn } from '@/lib/cn';
import { formatCount, formatPercent } from '@/lib/format';
import type { Band } from '@/lib/types';
import { EChart } from './EChart';
import { bandDecal, CHART_FONT, useChartTheme } from './chartTheme';
import {
  centreStack,
  clamp,
  DIA_MAX,
  DIA_MIN,
  LABEL_GUTTER,
  RING_HOLE_RATIO,
  useBoxWidth,
} from './donutStyle';

export interface ArchetypeDonutProps {
  distribution: Record<Band, number>;
  ariaLabel: string;
  className?: string;
  /** Ceiling on the ring diameter, for a card that should not give it all. */
  maxDiameter?: number;
  /**
   * The dot legend beneath the ring. Off where the page already names the three
   * bands beside it — two legends saying one thing is worse than none.
   */
  showLegend?: boolean;
}

/** Fixed so the ring reads clockwise from noon as Ready → Moderate → Not ready. */
const ORDER: Band[] = ['ready', 'moderately_ready', 'not_ready'];

/**
 * The facility population split across the three archetypes.
 *
 * Ring style shared with the NPHCDA dashboard (see `donutStyle`): the diameter
 * follows the card, the band is thin around a roomy hole holding a fitted centre
 * stack, and each segment is separated by a real gap with rounded ends and
 * labelled outside with its share and count on a leader in its own colour.
 *
 * What is not shared is the colour and the texture. Ready / Moderately ready /
 * Not ready are this dashboard's own three, and each arc keeps its decal —
 * red / amber / green is the worst case for the common colour-vision
 * deficiencies, and three adjacent arcs are the hardest form of it to read.
 */
export function ArchetypeDonut({
  distribution,
  ariaLabel,
  className,
  maxDiameter = DIA_MAX,
  showLegend = true,
}: ArchetypeDonutProps) {
  const theme = useChartTheme();
  const [boxRef, boxWidth] = useBoxWidth<HTMLDivElement>();

  const total = ORDER.reduce((sum, band) => sum + distribution[band], 0);

  // The ring grows with the card, but only into the space left after the label
  // gutter — so a wider card buys a bigger ring and a cramped one keeps its
  // labels rather than its diameter.
  const outerR = clamp(DIA_MIN, boxWidth - LABEL_GUTTER * 2, Math.min(DIA_MAX, maxDiameter)) / 2;
  const innerR = Math.round(outerR * RING_HOLE_RATIO);
  // Vertical room for the topmost and bottommost label to clear the ring.
  const height = Math.round(outerR * 2 + 34);

  const option = useMemo<EChartsOption>(() => {
    const present = ORDER.filter((band) => distribution[band] > 0);
    // At 100% the other segments are gone and one spans the whole ring. A gap
    // and rounded ends then have nothing to separate and only cut a notch out
    // of a complete arc — which reads as a shortfall, the opposite of what a
    // 100% figure means. A lone segment closes up.
    const closedRing = present.length < 2;

    return {
      tooltip: total
        ? {
            trigger: 'item',
            formatter: (p: unknown) => {
              const param = p as { name: string; value: number; percent: number };
              return (
                `<b>${param.name}</b><br/>${formatCount(param.value)} facilities ` +
                `(${formatPercent(param.percent)})`
              );
            },
          }
        : { show: false },
      series: [
        {
          type: 'pie',
          // Pixel radii, not percentages: the diameter is decided above against
          // the card's real width, so it must not be re-derived from min(w, h).
          radius: [innerR, outerR],
          center: ['50%', '50%'],
          // First segment opens at 12 o'clock, so the ring is read clockwise
          // from the top the way a reader expects a part-to-whole to start.
          startAngle: 90,
          avoidLabelOverlap: true,
          // A visible gap between segments, cut through to the card behind
          // rather than drawn in a colour — so it stays right in both themes.
          padAngle: closedRing ? 0 : 2,
          itemStyle: { borderRadius: closedRing ? 0 : 3 },
          silent: !total,
          // No emphasis state at all: hovering an arc leaves the ring exactly as
          // it was and only raises the tooltip.
          //
          // Not a style preference — an arc *disappeared* under the cursor. Each
          // arc is filled with a decal, which ECharts builds as a canvas pattern
          // fitted to the element, and entering the emphasis state re-derives the
          // fill: the pattern is rebuilt against a shape that is mid-change and
          // the arc paints as nothing. `scale: false` was not enough, because the
          // fill is re-derived whether or not the radius moves. Two more reasons
          // to want the state gone even when it renders: a growing arc rebuilds
          // its texture every frame, and `avoidLabelOverlap` re-runs the whole
          // label layout when one slice's anchor moves, so all three labels and
          // their leaders jump. Every arc already carries its share and count, so
          // the state was buying nothing.
          emphasis: { disabled: true },
          label: total
            ? {
                show: true,
                position: 'outside',
                formatter: (p: unknown) => {
                  const param = p as { value: number; percent: number };
                  return `${formatPercent(param.percent)}\n(${formatCount(param.value)})`;
                },
                fontSize: 11,
                fontWeight: 600,
                fontFamily: CHART_FONT,
                lineHeight: 13,
                color: theme.text,
                textBorderColor: 'transparent',
                // Labels align to the CONTAINER edge, not to the end of their
                // leader line: aligned to the line, each label gets only the
                // gap between the line's end and the box edge, and ECharts
                // truncates to "43…".
                alignTo: 'edge',
                edgeDistance: 0,
                distanceToLabelLine: 2,
                bleedMargin: 2,
              }
            : { show: false },
          labelLine: total
            ? {
                show: true,
                // Short stubs on purpose: with alignTo 'edge' ECharts stretches
                // the horizontal run out to meet the label anyway, and a longer
                // one here only shrinks the width the text is allowed.
                length: 6,
                length2: 2,
                smooth: 0.2,
                // No colour, so the leader inherits its own segment's — tying
                // each label back to the arc it belongs to.
                lineStyle: { width: 1 },
              }
            : { show: false },
          data: total
            ? present.map((band) => ({
                name: BAND_LABEL[band],
                value: distribution[band],
                itemStyle: { color: theme.bands[band], decal: bandDecal(band) },
              }))
            : [{ name: 'No data', value: 1, itemStyle: { color: theme.noData } }],
        },
      ],
      graphic: centreStack(
        total
          ? [
              { text: formatCount(total), role: 'head' },
              { text: 'facilities', role: 'total' },
            ]
          : [{ text: 'No data', role: 'total' }],
        innerR,
        theme,
      ),
    };
    // Depends on the theme's *values*, not the object `useChartTheme` builds
    // fresh on every render. The option carries formatter functions, so a new
    // object here is never deep-equal to the last one and echarts-for-react
    // re-applies it with `notMerge` — which replays the ring's entry animation.
    // Mid-hover that reads as the chart glitching, for a render that changed
    // nothing about it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    distribution.ready,
    distribution.moderately_ready,
    distribution.not_ready,
    innerR,
    outerR,
    total,
    theme.bands.ready,
    theme.bands.moderately_ready,
    theme.bands.not_ready,
    theme.text,
    theme.muted,
    theme.noData,
  ]);

  return (
    <div ref={boxRef} className={cn('flex w-full flex-col items-center gap-2', className)}>
      {/* The height goes to EChart rather than onto a wrapper it fills at 100%,
          so the canvas resizes on the same commit that changes the radius. */}
      <EChart option={option} height={height} ariaLabel={ariaLabel} />
      {showLegend && total > 0 && (
        <div className="flex flex-wrap justify-center gap-x-3.5 gap-y-1 text-[13px] leading-snug text-muted-foreground">
          {ORDER.map((band) => (
            <span key={band}>
              {/* Round swatch: a dot sits level with the text's cap band, where
                  a square rides high and shifts with the font. */}
              <span
                className="mr-1 inline-block h-[7px] w-[7px] shrink-0 rounded-full align-baseline"
                style={{ backgroundColor: theme.bands[band] }}
              />
              {BAND_LABEL[band]}{' '}
              <b className="text-foreground">{formatPercent((distribution[band] / total) * 100)}</b>{' '}
              <span className="text-muted-foreground/80">({formatCount(distribution[band])})</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
