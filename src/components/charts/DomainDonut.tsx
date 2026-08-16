import type { EChartsOption } from 'echarts';
import { cn } from '@/lib/cn';
import { formatScore } from '@/lib/format';
import type { Band } from '@/lib/types';
import { EChart } from './EChart';
import { bandDecal, useChartTheme } from './chartTheme';

export interface DomainDonutProps {
  score: number | null;
  band: Band | null;
  /** Diameter in px. */
  size?: number;
  ariaLabel: string;
  className?: string;
}

/**
 * A theme's score /5, as a ring — the Facility Scorecard's core visual, one
 * per scored theme.
 *
 * The ring fill is score mapped linearly from 1 (empty) to 5 (full), coloured
 * by the three-band scale rather than a fourth palette. The score itself is
 * drawn as an HTML overlay rather than an ECharts label: canvas text cannot be
 * selected, cannot use the app's font hinting, and does not survive a print
 * stylesheet.
 */
export function DomainDonut({ score, band, size = 152, ariaLabel, className }: DomainDonutProps) {
  const theme = useChartTheme();
  const pct = score == null ? 0 : Math.max(0, Math.min(1, (score - 1) / 4));
  const color = band ? theme.bands[band] : theme.noData;

  const option: EChartsOption = {
    silent: true,
    series: [
      {
        type: 'pie',
        radius: ['74%', '92%'],
        startAngle: 90,
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        emphasis: { scale: false },
        data:
          score == null
            ? [{ value: 1, itemStyle: { color: theme.grid } }]
            : [
                // The filled arc carries the band's texture as well as its
                // colour: the ring's length encodes the score, but its *band*
                // — which is what the reader acts on — was colour alone.
                {
                  value: pct,
                  itemStyle: { color, decal: band ? bandDecal(band) : undefined },
                },
                { value: 1 - pct, itemStyle: { color: theme.grid } },
              ],
      },
    ],
  };

  return (
    <div className={cn('relative mx-auto', className)} style={{ width: size, height: size }}>
      <EChart option={option} height={size} ariaLabel={ariaLabel} />
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <p className="text-2xl font-bold text-brand-700">
          {formatScore(score)}
          <span className="text-sm font-medium text-muted-foreground">/5</span>
        </p>
      </div>
    </div>
  );
}
