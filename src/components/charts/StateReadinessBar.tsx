import { useState } from 'react';
import type { EChartsOption } from 'echarts';
import { BAND_LABEL } from '@/lib/bands';
import { formatCount, formatShare } from '@/lib/format';
import { useRenderWidth } from '@/hooks/useRenderWidth';
import type { Band } from '@/lib/types';
import { EChart } from './EChart';
import { bandDecal, CHART_FONT, useChartTheme, type ChartTheme } from './chartTheme';

/** Clustered puts the three bands side by side; stacked lays them end to end. */
export type BarMode = 'clustered' | 'stacked';

/**
 * Which axis the states run along. `horizontal` puts them down the left and
 * grows the bars rightwards; `vertical` is the columns-on-a-baseline reading.
 */
export type BarOrientation = 'horizontal' | 'vertical';

export interface StateReadinessRow {
  state: string;
  total: number;
  distribution: Record<Band, number>;
}

export interface StateReadinessBarProps {
  /** Already sorted — the chart keeps the order given, best rank first. */
  rows: StateReadinessRow[];
  mode: BarMode;
  orientation?: BarOrientation;
  /** Drawn with an emphasised axis label, matching the table's selected row. */
  selectedState?: string | null;
  /** Clicking a bar or its axis label scopes the page, as clicking a row does. */
  onSelectState?: (state: string) => void;
}

/** Ready → Moderate → Not ready, the order every other surface uses. */
const ORDER: Band[] = ['ready', 'moderately_ready', 'not_ready'];

/** Room one state needs down the page, per mode. Three bars need roughly twice one. */
const ROW_HEIGHT: Record<BarMode, number> = { clustered: 62, stacked: 40 };

/** Vertical is a fixed-height frame — the states share the width instead. */
const VERTICAL_HEIGHT = 440;

/**
 * Width one state needs in the vertical view.
 *
 * Every label there is flat, which is the readable way round but the hungry one:
 * "Akwa Ibom" is about 58px and each bar wants its own count above it. Below
 * this the card scrolls sideways rather than letting labels collide.
 */
const VERTICAL_MIN_SLOT = 84;

const LABEL_TYPE = { fontFamily: CHART_FONT, fontSize: 10 } as const;

/** Line box for a label, and so the height of each line of a two-line one. */
const LABEL_LINE = 11;

/**
 * What the axis, its labels and the margins take out of the box before the bars
 * get any of it. Approximate by design — it only has to be close enough to
 * decide whether a run of text fits inside a segment.
 */
const GUTTER: Record<BarOrientation, { along: number; across: number }> = {
  horizontal: { along: 172, across: 0 },
  // `across` is what the value axis costs the states: its labels (~24px) plus
  // the grid margins. Kept honest rather than generous — every pixel of slack
  // here is a pixel of width the twelve states do not get, and at twelve states
  // an over-estimate is what pushes a 1440px window into scrolling.
  vertical: { along: 86, across: 68 },
};

/**
 * Labels that sit on a band colour.
 *
 * Dark text with a light halo, because it has to stay legible on green, amber
 * and red alike and those three do not follow the colour scheme.
 */
const ON_BAND = {
  color: '#16181d',
  textBorderColor: 'rgba(255, 255, 255, 0.72)',
  textBorderWidth: 2.5,
} as const;

/** `n · p%` — the pairing the table uses in every band column. */
function countAndShare(value: number, total: number): string {
  return `${formatCount(value)} · ${formatShare(value, total)}`;
}

/**
 * Roughly how wide a label runs, in pixels.
 *
 * Canvas text cannot be measured before it is drawn, and every glyph these
 * labels use — digits, the separator, `%` — is about 5.5px at 10px Inter, so
 * counting characters is close enough to decide whether one fits inside a bar.
 * Deliberately a slight over-estimate: a label judged too wide falls back to
 * something shorter, which is a better failure than one that overflows.
 */
function textPx(text: string): number {
  return Math.max(...text.split('\n').map((line) => line.length * 5.5 + 2));
}

/** Round up to a half-decade step — 293 to 300, 34 to 35 — so the axis ends tidily. */
function niceCeiling(value: number): number {
  const step = Math.pow(10, Math.floor(Math.log10(Math.max(value, 1)))) / 2;
  return Math.ceil(value / step) * step;
}

/** Clustered bars are rounded at the growing end only. */
function roundedEnd(isVertical: boolean): [number, number, number, number] {
  return isVertical ? [3, 3, 0, 0] : [0, 3, 3, 0];
}

/**
 * Readiness by state as bars — the chart half of the Assessment States
 * "Readiness by state" section, switched in place of the ranked table.
 *
 * Horizontal by default: the categories are twelve state names, some of them
 * two words, and a vertical layout has to rotate or truncate them. Horizontal
 * also keeps the ranking the table established readable as a ranking — longest
 * bar at the top, straight down. The axis toggle is there for the reader who
 * wants the columns-on-a-baseline shape anyway.
 *
 * Counts *and* shares. A count alone hides that Kano's 234 and Bauchi's 97 are
 * both a bit over half their state; a share alone hides that they rest on very
 * different denominators.
 *
 * Where the two differ is what happens when a label will not fit. Clustered
 * bars each end in open space, so every band always gets its pair. A stacked
 * segment has only itself: it shows the pair if it is long enough, its count if
 * only that fits, and otherwise nothing at all rather than hanging text over
 * its neighbours. Ready is usually the segment that comes up short — hide a
 * band or two from the legend and the axis rescales around what is left, which
 * is when its label appears.
 */
export function StateReadinessBar({
  rows,
  mode,
  orientation = 'horizontal',
  selectedState,
  onSelectState,
}: StateReadinessBarProps) {
  const theme = useChartTheme();
  const isVertical = orientation === 'vertical';
  // Legend selection has to be React state, not ECharts' own: the labels are
  // decided here, against the axis scale, and the axis rescales when a band is
  // hidden. Feeding it back through `legend.selected` also keeps the choice
  // across the option rebuild that follows.
  const [hiddenBands, setHiddenBands] = useState<Band[]>([]);
  const [measureRef, measuredWidth] = useRenderWidth<HTMLDivElement>();

  // A value/category grid draws its first category at the *bottom*, so the
  // horizontal reading has to be reversed to run top-down. The vertical one
  // already reads left-to-right in rank order.
  const chartRows = isVertical ? rows : [...rows].reverse();
  const height = isVertical
    ? VERTICAL_HEIGHT
    : // Legend, axis labels and the axis name all live outside the plotted rows.
      Math.max(260, chartRows.length * ROW_HEIGHT[mode] + 110);

  const visibleBands = ORDER.filter((band) => !hiddenBands.includes(band));

  // What the longest bar is worth, which is what the axis is scaled to and so
  // what a segment's pixels are measured against. Only the visible bands count.
  const scaleMax = Math.max(
    1,
    ...chartRows.map((row) =>
      mode === 'stacked'
        ? visibleBands.reduce((sum, band) => sum + row.distribution[band], 0)
        : Math.max(0, ...visibleBands.map((band) => row.distribution[band])),
    ),
  );

  // Flat labels need width. Where the card cannot give it, the chart takes the
  // width it needs and the card scrolls to it.
  const minWidth = isVertical
    ? chartRows.length * VERTICAL_MIN_SLOT + GUTTER.vertical.across
    : 0;
  const gutter = GUTTER[orientation];
  const alongPx = isVertical
    ? Math.max(120, height - gutter.along)
    : Math.max(120, Math.max(measuredWidth, minWidth) - gutter.along);

  /** Pixels a segment of this size gets along the axis it grows on. */
  const segmentPx = (value: number) => (value / scaleMax) * alongPx;

  const dataItem = (band: Band, row: StateReadinessRow) => {
    const value = row.distribution[band];
    if (!value) return { value, label: { show: false } };

    const flat = countAndShare(value, row.total);
    // Standing up, the pair goes on two lines. A column is far shorter of width
    // than of height, and both lines stay flat — which is the readable way
    // round, and the reason the vertical view claims a minimum width.
    const stacked = `${formatCount(value)}\n${formatShare(value, row.total)}`;
    const count = formatCount(value);

    if (mode === 'clustered') {
      return {
        value,
        label: {
          ...LABEL_TYPE,
          color: theme.muted,
          show: true,
          ...(isVertical
            ? {
                position: 'top' as const,
                formatter: () => stacked,
                lineHeight: LABEL_LINE,
                align: 'center' as const,
              }
            : { position: 'right' as const, formatter: () => flat }),
        },
      };
    }

    // Stacked: inside the segment or not at all. Nothing hangs off the end —
    // sideways that lands on the next band along, whose own label is centred
    // right about there, and in a column it lands on the next column.
    const inside = {
      ...LABEL_TYPE,
      ...ON_BAND,
      show: true,
      position: 'inside' as const,
      lineHeight: LABEL_LINE,
    };
    const room = segmentPx(value);
    const pair = isVertical ? stacked : flat;
    // Padding on top of the text: the character-count estimate runs a little
    // under what the canvas actually draws, and a label wants air either side.
    const pairNeeds = isVertical ? 2 * LABEL_LINE + 4 : textPx(pair) + 12;
    const countNeeds = isVertical ? LABEL_LINE + 4 : textPx(count) + 8;

    if (room >= pairNeeds) return { value, label: { ...inside, formatter: () => pair } };
    if (room >= countNeeds) return { value, label: { ...inside, formatter: () => count } };
    return { value, label: { show: false } };
  };

  const categoryAxis = {
    type: 'category' as const,
    data: chartRows.map((r) => r.state),
    axisLine: { lineStyle: { color: theme.axis } },
    axisTick: { show: false },
    // Labels are clickable, so they carry the selection highlight and have to
    // report their own clicks — `triggerEvent` is what makes the second true.
    triggerEvent: true,
    axisLabel: stateAxisLabel(chartRows, selectedState, theme, isVertical),
  };

  const valueAxis = {
    type: 'value' as const,
    name: 'Facilities assessed',
    nameLocation: 'middle' as const,
    nameGap: isVertical ? 44 : 30,
    nameTextStyle: { color: theme.muted, fontFamily: CHART_FONT, fontSize: 11 },
    minInterval: 1,
    // A clustered bar carries its label above itself when vertical, so the
    // tallest one needs air that the auto-scale does not leave. Rounded up to a
    // round number, or the top of the axis reads 293.
    max: isVertical && mode === 'clustered' ? niceCeiling(scaleMax * 1.15) : undefined,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: theme.muted, fontSize: 11 },
    splitLine: { lineStyle: { color: theme.grid, type: 'dashed' as const } },
  };

  const option: EChartsOption = {
    legend: {
      top: 0,
      left: 0,
      itemGap: 18,
      textStyle: { color: theme.muted, fontFamily: CHART_FONT, fontSize: 12 },
      data: ORDER.map((band) => BAND_LABEL[band]),
      // Mirrors `hiddenBands` so the rebuild this component does on every
      // toggle does not immediately un-hide what was just hidden.
      selected: Object.fromEntries(
        ORDER.map((band) => [BAND_LABEL[band], !hiddenBands.includes(band)]),
      ),
    },
    // `containLabel` covers the axis *labels* but not the axis *name*, so the
    // margins are what keep "Facilities assessed" inside the canvas.
    grid: {
      left: isVertical ? 16 : 8,
      right: isVertical ? 28 : 72,
      top: 40,
      bottom: isVertical ? 8 : 24,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      // Every figure, including the bands whose segment was too small to carry
      // its own label and the ones hidden from the legend.
      formatter: (params: unknown) => {
        const list = params as { name: string; seriesName: string; value: number }[];
        const first = list[0];
        if (!first) return '';
        const row = chartRows.find((r) => r.state === first.name);
        const total = row?.total ?? 0;
        const lines = ORDER.map(
          (band) =>
            `${BAND_LABEL[band]}: <b>${formatCount(row?.distribution[band] ?? 0)}</b> ` +
            `<span style="opacity:.7">${formatShare(row?.distribution[band] ?? 0, total)}</span>`,
        );
        return [`<b>${first.name}</b> — ${formatCount(total)} facilities`, ...lines].join('<br/>');
      },
    },
    xAxis: isVertical ? categoryAxis : valueAxis,
    yAxis: isVertical ? valueAxis : categoryAxis,
    series: ORDER.map((band) => ({
      name: BAND_LABEL[band],
      type: 'bar' as const,
      // A shared stack name is the whole difference between the two modes.
      stack: mode === 'stacked' ? 'total' : undefined,
      barMaxWidth: mode === 'stacked' ? 26 : 16,
      itemStyle: {
        color: theme.bands[band],
        decal: bandDecal(band),
        borderRadius: mode === 'clustered' ? roundedEnd(isVertical) : 0,
      },
      // Nothing dims on hover. ECharts' emphasis/blur pair drops every
      // un-hovered item to ~10% opacity, so pointing at one bar — or at a
      // legend key — made the rest of the chart vanish exactly while the
      // axis tooltip, which names all three bands, asked to be read against
      // it. `disabled` kills the highlight, the explicit `blur` opacity kills
      // the dimming that the legend and axis pointer trigger on their own.
      emphasis: { disabled: true },
      blur: { itemStyle: { opacity: 1 }, label: { opacity: 1 } },
      data: chartRows.map((row) => dataItem(band, row)),
    })),
  };

  const ariaLabel =
    `${mode === 'stacked' ? 'Stacked' : 'Clustered'} bar chart of readiness by state. ` +
    rows
      .map(
        (r) =>
          `${r.state}: ${formatCount(r.total)} facilities, ` +
          `${formatCount(r.distribution.ready)} ready, ` +
          `${formatCount(r.distribution.moderately_ready)} moderately ready, ` +
          `${formatCount(r.distribution.not_ready)} not ready`,
      )
      .join('. ');

  return (
    <div ref={measureRef} className={isVertical ? 'overflow-x-auto' : undefined}>
      <div style={minWidth ? { minWidth } : undefined}>
        <EChart
          option={option}
          height={height}
          ariaLabel={ariaLabel}
          // Membership, not order: re-sorting the same twelve states animates in
          // place, while clicking a bar — which re-plots the chart from a
          // filtered population — gets a clean instance. Swapping the axes
          // rebuilds both of them, which is likewise cleaner from scratch.
          // Legend toggles are deliberately absent: those are an in-place
          // rescale, and remounting would replay the whole chart's animation.
          instanceKey={`${mode}|${orientation}|${chartRows
            .map((r) => r.state)
            .sort()
            .join(',')}`}
          onEvents={{
            legendselectchanged: (params, instance) => {
              const p = params as { selected?: Record<string, boolean> };
              if (!p.selected) return;
              const selected = p.selected;
              // The rebuild replaces the series the axis pointer is holding.
              instance.dispatchAction({ type: 'hideTip' });
              setHiddenBands(ORDER.filter((band) => selected[BAND_LABEL[band]] === false));
            },
            ...(onSelectState
              ? {
                  click: (params: unknown, instance) => {
                    // Two shapes reach here: a bar (`name` is the category) and
                    // an axis label (`value` is, and there is no series).
                    const p = params as {
                      componentType?: string;
                      name?: string;
                      value?: string;
                    };
                    const fromAxis =
                      p.componentType === 'xAxis' || p.componentType === 'yAxis';
                    const state = fromAxis ? p.value : p.name;
                    if (!state) return;
                    // The click lands with the tooltip open on the bar under the
                    // cursor, and selecting a state rebuilds this chart from a
                    // filtered population. Dismiss the tooltip first or the next
                    // pointer move reads the series it was drawn from, which by
                    // then no longer exists — see the note in EChart.
                    instance.dispatchAction({ type: 'hideTip' });
                    onSelectState(state);
                  },
                }
              : {}),
          }}
        />
      </div>
    </div>
  );
}

/**
 * The state name, and — where there is room for it — the row total under it.
 *
 * Every label on a bar is a count and a share, and a share is unreadable
 * without its denominator. Horizontally each name has a line to itself, so the
 * total goes straight under it. The vertical layout gives twelve names one
 * shared width; they stay flat and keep to the name alone, and the width the
 * chart claims is what keeps them from colliding.
 */
function stateAxisLabel(
  chartRows: StateReadinessRow[],
  selectedState: string | null | undefined,
  theme: ChartTheme,
  isVertical: boolean,
) {
  const shared = {
    fontSize: 11,
    // Only the colour can vary per label — ECharts takes a callback for
    // `color` but not for `fontWeight`, so the selected state reads as the one
    // full-contrast label against eleven muted ones.
    color: (value?: string | number) => (value === selectedState ? theme.text : theme.muted),
  };

  // `interval: 0` keeps every state named. ECharts' default is to drop labels
  // that would collide, which on a ranked chart silently unlabels states.
  if (isVertical) return { ...shared, rotate: 0, interval: 0, hideOverlap: false };

  return {
    ...shared,
    formatter: (value: string) => {
      const row = chartRows.find((r) => r.state === value);
      return row ? `{state|${value}}\n{total|${formatCount(row.total)}}` : value;
    },
    rich: {
      state: { fontSize: 11, fontFamily: CHART_FONT, align: 'right' as const },
      total: {
        fontSize: 9,
        fontFamily: CHART_FONT,
        color: theme.muted,
        align: 'right' as const,
        padding: [1, 0, 0, 0] as [number, number, number, number],
      },
    },
  };
}
