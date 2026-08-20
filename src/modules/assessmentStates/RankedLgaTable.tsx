import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { BandStack, ScoreCell } from '@/components/ui';
import { archetypeDistribution } from '@/lib/archetype';
import { cn } from '@/lib/cn';
import { formatCount, formatScore, titleCaseName } from '@/lib/format';
import type { Band, FacilitySummary, FacilityThemeId } from '@/lib/types';

const PAGE = 25;

interface LgaRow {
  key: string;
  name: string;
  state: string;
  stateId: string;
  lgaId: string;
  facilities: number;
  distribution: Record<Band, number>;
  average: number | null;
  technical: number | null;
  workforce: number | null;
  readyShare: number;
}

function mean(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v != null);
  return present.length ? present.reduce((a, b) => a + b, 0) / present.length : null;
}

/**
 * LGAs ranked within the current filter scope.
 *
 * Rolled up from the filtered facility rows rather than read from
 * `lgas.json`, so the ranking actually responds to the filter bar above it —
 * a precomputed LGA profile cannot narrow to "Functional L1, rural".
 *
 * Paged rather than capped. A silent top-40 reads as "these are the LGAs",
 * and the tail is where the foundational-build work is concentrated.
 */
export function RankedLgaTable({ facilities }: { facilities: FacilitySummary[] }) {
  const navigate = useNavigate();
  const [shown, setShown] = useState(PAGE);

  const rows = useMemo<LgaRow[]>(() => {
    const groups = new Map<string, FacilitySummary[]>();
    for (const f of facilities) {
      const key = `${f.stateId}.${f.lgaId}`;
      const bucket = groups.get(key);
      if (bucket) bucket.push(f);
      else groups.set(key, [f]);
    }

    return [...groups.entries()]
      .map(([key, rows]) => {
        const first = rows[0]!;
        const distribution = archetypeDistribution(rows.map((r) => r.archetype));
        const pick = (t: FacilityThemeId) => mean(rows.map((r) => r.themeScores[t]));
        return {
          key,
          name: titleCaseName(first.lga),
          state: first.state,
          stateId: first.stateId,
          lgaId: first.lgaId,
          facilities: rows.length,
          distribution,
          average: mean(rows.map((r) => r.averageDomainScore)),
          technical: pick('technical_infrastructure'),
          workforce: pick('workforce_capacity'),
          readyShare: rows.length ? (distribution.ready / rows.length) * 100 : 0,
        };
      })
      .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
  }, [facilities]);

  const visible = rows.slice(0, shown);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <caption className="sr-only">
            Local government areas ranked by average domain score, with readiness
            composition
          </caption>
          <thead>
            <tr className="mono text-[9.5px] uppercase tracking-[0.11em] text-muted-foreground">
              <th scope="col" className="w-8 border-b border-input px-4 py-2 text-left font-normal" />
              <th scope="col" className="border-b border-input py-2 pr-3 text-left font-normal">
                LGA
              </th>
              <th scope="col" className="border-b border-input py-2 pr-3 text-left font-normal">
                State
              </th>
              <th
                scope="col"
                className="min-w-[150px] border-b border-input py-2 pr-3 text-left font-normal"
              >
                Composition
              </th>
              <th scope="col" className="border-b border-input py-2 pr-3 text-right font-normal">
                Facilities
              </th>
              <th scope="col" className="border-b border-input py-2 pr-3 text-right font-normal">
                Ready
              </th>
              <th scope="col" className="border-b border-input py-2 pr-3 text-right font-normal">
                Avg
              </th>
              <th scope="col" className="border-b border-input py-2 pr-3 text-right font-normal">
                Tech. infra.
              </th>
              <th scope="col" className="border-b border-input py-2 pr-4 text-right font-normal">
                Workforce
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr
                key={row.key}
                onClick={() => navigate(`/explore?state=${encodeURIComponent(row.state)}`)}
                className={cn(
                  'cursor-pointer border-b border-border transition-colors hover:bg-surface-sunk',
                )}
              >
                <td className="mono px-4 py-2 text-[10.5px] text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </td>
                <td className="whitespace-nowrap py-2 pr-3 font-semibold">{row.name}</td>
                <td className="py-2 pr-3 text-xs text-muted-foreground">{row.state}</td>
                <td className="py-2 pr-3">
                  <BandStack distribution={row.distribution} label={row.name} />
                </td>
                <td className="mono py-2 pr-3 text-right text-xs">
                  {formatCount(row.facilities)}
                </td>
                <td className="mono py-2 pr-3 text-right text-xs">
                  {row.distribution.ready}
                  <span className="ml-1.5 text-muted-foreground">
                    {row.readyShare.toFixed(0)}%
                  </span>
                </td>
                <td className="mono py-2 pr-3 text-right text-xs">
                  {formatScore(row.average, 2)}
                </td>
                <td className="py-2 pr-3 text-right text-xs">
                  <ScoreCell value={row.technical} />
                </td>
                <td className="py-2 pr-4 text-right text-xs">
                  <ScoreCell value={row.workforce} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-2.5">
        <p className="mono text-[10.5px] text-muted-foreground">
          Showing {formatCount(visible.length)} of {formatCount(rows.length)} LGAs
        </p>
        {shown < rows.length && (
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE)}
            className="mono inline-flex items-center gap-1.5 border border-input px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] text-brand-500 transition-colors hover:border-brand-500"
          >
            Show {Math.min(PAGE, rows.length - shown)} more
            <ArrowRight className="h-3 w-3" aria-hidden />
          </button>
        )}
      </div>
    </>
  );
}
