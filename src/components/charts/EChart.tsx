import { useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { cn } from '@/lib/cn';
import { useThemeStore } from '@/store/themeStore';
import { chartBase, useChartTheme } from './chartTheme';

export interface EChartProps {
  option: EChartsOption;
  height?: number | string;
  className?: string;
  /** Screen-reader description. A canvas is opaque to assistive tech. */
  ariaLabel: string;
  onEvents?: Record<string, (params: unknown) => void>;
}

/**
 * Theme-aware ECharts wrapper. Every chart in the app goes through it.
 *
 * Three things it handles that a bare `<ReactECharts>` does not, each of which
 * was a visible bug in the dashboards this is ported from:
 *
 *  - **Resize.** ECharts sizes its canvas in explicit pixels and does not
 *    re-measure on its own. A chart mounted inside something that animates open
 *    — a modal, a drawer, a collapsing sidebar — renders at a stale or zero
 *    width and clips its axis labels. A ResizeObserver plus two deferred
 *    resizes covers both the observer's lag and the animation settling.
 *  - **Web fonts.** Canvas text does not reflow when a font finishes loading, so
 *    a chart drawn before Inter arrives keeps the fallback metrics. Redrawing on
 *    `document.fonts.ready` fixes it.
 *  - **Theme.** Colours are resolved from CSS variables at render, and the inner
 *    chart is keyed on the scheme so a toggle remounts it with the new palette.
 *
 * The resize helper resolves the live instance on every call rather than
 * capturing one: the keyed remount disposes the old chart, and resizing a
 * disposed instance logs an ECharts warning on every frame.
 */
export function EChart({ option, height = 320, className, ariaLabel, onEvents }: EChartProps) {
  const scheme = useThemeStore((s) => s.scheme);
  const theme = useChartTheme();
  const chartRef = useRef<ReactECharts>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const themedOption = useMemo<EChartsOption>(() => {
    const base = chartBase(theme);
    return {
      ...base,
      ...option,
      textStyle: { ...base.textStyle, ...(option.textStyle as object) },
      tooltip: option.tooltip
        ? { ...base.tooltip, ...(option.tooltip as object) }
        : base.tooltip,
    };
  }, [option, theme]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const resize = () => {
      const inst = chartRef.current?.getEchartsInstance();
      if (inst && !inst.isDisposed()) inst.resize();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const t1 = window.setTimeout(resize, 60);
    const t2 = window.setTimeout(resize, 320);

    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) resize();
    });

    return () => {
      cancelled = true;
      ro.disconnect();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return (
    // overflow-hidden clips the canvas to its box: while a layout animates, the
    // pixel-sized canvas can briefly be wider than the container it now sits in,
    // and without clipping it spills across the neighbouring grid column.
    <div
      ref={wrapRef}
      role="img"
      aria-label={ariaLabel}
      style={{ width: '100%', height }}
      className={cn('min-w-0 overflow-hidden', className)}
    >
      <ReactECharts
        ref={chartRef}
        key={scheme}
        option={themedOption}
        notMerge
        lazyUpdate
        style={{ height: '100%', width: '100%' }}
        onEvents={onEvents}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
}
