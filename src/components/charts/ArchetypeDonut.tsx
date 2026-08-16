import type { EChartsOption } from 'echarts';
import { BAND_LABEL } from '@/lib/bands';
import { cn } from '@/lib/cn';
import type { Band } from '@/lib/types';
import { EChart } from './EChart';
import { bandDecal, useChartTheme } from './chartTheme';

export interface ArchetypeDonutProps {
  distribution: Record<Band, number>;
  size?: number;
  ariaLabel: string;
  className?: string;
}

/** Fixed so the ring reads top-to-bottom as Ready → Moderate → Not ready,
 *  matching the legend order the Assessment States page renders beside it. */
const ORDER: Band[] = ['ready', 'moderately_ready', 'not_ready'];

/**
 * The facility population split across the three archetypes — Assessment
 * States' headline chart, feeding the "which action does each slice imply"
 * reading the funnel KPIs above it set up.
 */
export function ArchetypeDonut({ distribution, size = 200, ariaLabel, className }: ArchetypeDonutProps) {
  const theme = useChartTheme();
  const total = ORDER.reduce((sum, band) => sum + distribution[band], 0);

  const option: EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: (p: unknown) => {
        const param = p as { name: string; value: number; percent: number };
        return `${param.name}<br/>${param.value.toLocaleString()} facilities (${param.percent}%)`;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['58%', '88%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        data: total
          ? ORDER.map((band) => ({
              name: BAND_LABEL[band],
              value: distribution[band],
              // Colour plus texture — three adjacent arcs in red, amber and
              // green is the hardest form of the scale to read without one.
              itemStyle: { color: theme.bands[band], decal: bandDecal(band) },
            }))
          : [{ name: 'No data', value: 1, itemStyle: { color: theme.noData } }],
      },
    ],
  };

  return (
    <div className={cn('relative mx-auto', className)} style={{ width: size, height: size }}>
      <EChart option={option} height={size} ariaLabel={ariaLabel} />
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-brand-700">{total.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">facilities</p>
        </div>
      </div>
    </div>
  );
}
