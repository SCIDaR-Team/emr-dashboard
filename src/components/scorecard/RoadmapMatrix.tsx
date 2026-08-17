import { cn } from '@/lib/cn';
import { BAND_LABEL } from '@/lib/bands';
import { ROADMAP_MONTHS, ROADMAP_TEMPLATE } from '@/lib/roadmap';
import { formatCount } from '@/lib/format';
import type { Band } from '@/lib/types';

const ROWS: Band[] = ['ready', 'moderately_ready', 'not_ready'];

const ROW_CLASSES: Record<Band, string> = {
  ready: 'bg-ready-wash',
  moderately_ready: 'bg-moderate-wash',
  not_ready: 'bg-notready-wash',
};

export interface RoadmapMatrixProps {
  /** Facilities per archetype in the population this roadmap covers — shown
   *  beside each row so "Not ready" isn't read as a national headcount when
   *  it is really one state's. */
  distribution: Record<Band, number>;
  className?: string;
}

/**
 * The 6-month roadmap — activity per archetype per month, guide §9.2.
 *
 * Activities are the client's fixed template (`ROADMAP_TEMPLATE`), real and
 * unconditional. Cost per cell needs the same unit-cost table every other
 * investment figure is blocked on, so cost and total columns read "Pending
 * sign-off" rather than a fabricated number — the Figma's own cost figures
 * don't reconcile (procurement costs differ for Moderately vs Not ready
 * despite an identical activity list) and guide §17.4 flags the horizon
 * itself as still an open question with the assessment team.
 */
export function RoadmapMatrix({ distribution, className }: RoadmapMatrixProps) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="py-2 pr-4 text-left font-semibold">Archetype</th>
            {ROADMAP_MONTHS.map((m) => (
              <th key={m} scope="col" className="min-w-[8rem] px-2 py-2 text-left font-semibold">
                Month {m}
              </th>
            ))}
            <th scope="col" className="px-2 py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {ROWS.map((band) => (
            <tr key={band} className={ROW_CLASSES[band]}>
              <td className="py-3 pr-4 align-top">
                <p className="font-semibold text-foreground">{BAND_LABEL[band]}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCount(distribution[band])} facilities
                </p>
              </td>
              {ROADMAP_TEMPLATE[band].map((cell) => (
                <td key={cell.month} className="px-2 py-3 align-top">
                  <p className="text-foreground">{cell.activity}</p>
                  <p className="text-xs italic text-muted-foreground">Pending sign-off</p>
                </td>
              ))}
              <td className="px-2 py-3 text-right align-top text-xs italic text-muted-foreground">
                Pending sign-off
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">
        Activities are the assessment's fixed 6-month plan; cost per cell awaits the same
        signed-off cost table as every other investment figure (guide §9.2, §17.4).
      </p>
    </div>
  );
}
