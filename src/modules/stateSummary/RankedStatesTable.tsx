import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BandStack, ScoreCell } from '@/components/ui';
import { formatCount, formatScore } from '@/lib/format';
import type { AreaProfile } from '@/lib/types';

interface RankedStatesTableProps {
  /** All 37. Primary states are ranked; secondary ones are listed below. */
  states: AreaProfile[];
  /** National roll-up, shown as the closing row so a state can be read against
   *  the whole assessed population without leaving the table. */
  national: AreaProfile | null;
}

/**
 * The 12 assessed states, ranked.
 *
 * Reads state profiles directly rather than rolling up facility rows, because
 * this table carries **Leadership & Governance** — the one domain scored at
 * state level, which has no facility-level value to average and so cannot come
 * from the facility summary at all.
 *
 * Composition, not average, is what a rollout plan needs: two states can share
 * an average and need completely different programmes, and the stacked bar is
 * the column that says so. The average is still here, one column along.
 *
 * The 25 desk-review states are listed underneath rather than ranked into the
 * same table. They carry no facility-level band, so a row for them would be
 * mostly empty cells implying missing data rather than a different kind of
 * evidence.
 */
export function RankedStatesTable({ states, national }: RankedStatesTableProps) {
  const navigate = useNavigate();

  const primary = states
    .filter((s) => s.evidenceGrade === 'primary')
    .sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0));
  const secondary = states
    .filter((s) => s.evidenceGrade === 'secondary')
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <caption className="sr-only">
            The 12 assessed states ranked by average domain score, with readiness
            composition, technical infrastructure and leadership scores
          </caption>
          <thead>
            <tr className="mono text-[9.5px] uppercase tracking-[0.11em] text-muted-foreground">
              <th scope="col" className="w-8 border-b border-input py-2 pr-2 text-left font-normal" />
              <th scope="col" className="border-b border-input py-2 pr-3 text-left font-normal">
                State
              </th>
              <th
                scope="col"
                className="min-w-[170px] border-b border-input py-2 pr-3 text-left font-normal"
              >
                Readiness composition
              </th>
              <th scope="col" className="border-b border-input py-2 pr-3 text-right font-normal">
                Ready
              </th>
              <th scope="col" className="border-b border-input py-2 pr-3 text-right font-normal">
                Facilities
              </th>
              <th scope="col" className="border-b border-input py-2 pr-3 text-right font-normal">
                Avg
              </th>
              <th scope="col" className="border-b border-input py-2 pr-3 text-right font-normal">
                Tech. infra.
              </th>
              <th scope="col" className="border-b border-input py-2 pr-3 text-right font-normal">
                Leadership
              </th>
              <th scope="col" className="w-6 border-b border-input py-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {primary.map((state, i) => (
              <tr
                key={state.id}
                onClick={() => navigate(`/explore?at=${state.id}`)}
                className="cursor-pointer border-b border-border transition-colors hover:bg-surface-sunk"
              >
                <td className="mono py-2 pr-2 text-[10.5px] text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </td>
                <td className="whitespace-nowrap py-2 pr-3 font-semibold">{state.name}</td>
                <td className="py-2 pr-3">
                  <BandStack distribution={state.archetypeDistribution} label={state.name} />
                </td>
                <td className="mono py-2 pr-3 text-right text-xs">
                  {state.archetypeDistribution.ready}
                </td>
                <td className="mono py-2 pr-3 text-right text-xs">
                  {formatCount(state.facilityCount)}
                </td>
                <td className="mono py-2 pr-3 text-right text-xs">
                  {formatScore(state.averageScore, 2)}
                </td>
                <td className="py-2 pr-3 text-right text-xs">
                  <ScoreCell value={state.themeScores.technical_infrastructure} />
                </td>
                <td className="py-2 pr-3 text-right text-xs">
                  <ScoreCell value={state.themeScores.leadership_governance} />
                </td>
                <td className="py-2 text-right">
                  <ArrowRight className="h-3 w-3 text-brand-500" aria-hidden />
                </td>
              </tr>
            ))}

            {national && (
              <tr className="border-b border-border bg-surface-sunk font-semibold">
                <td className="py-2 pr-2" />
                <td className="whitespace-nowrap py-2 pr-3">All {primary.length}</td>
                <td className="py-2 pr-3">
                  <BandStack
                    distribution={national.archetypeDistribution}
                    label="All assessed states"
                  />
                </td>
                <td className="mono py-2 pr-3 text-right text-xs">
                  {national.archetypeDistribution.ready}
                </td>
                <td className="mono py-2 pr-3 text-right text-xs">
                  {formatCount(national.facilityCount)}
                </td>
                <td className="mono py-2 pr-3 text-right text-xs">
                  {formatScore(national.averageScore, 2)}
                </td>
                <td className="py-2 pr-3 text-right text-xs">
                  <ScoreCell value={national.themeScores.technical_infrastructure} />
                </td>
                <td className="py-2 pr-3 text-right text-xs">
                  <ScoreCell value={national.themeScores.leadership_governance} />
                </td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {secondary.length > 0 && (
        <div className="mt-4">
          <p className="eyebrow mb-2">
            Desk review only — {secondary.length} states, shown on the map, not ranked
          </p>
          <div className="flex flex-wrap gap-1.5">
            {secondary.map((state) => (
              <span
                key={state.id}
                className="mono border border-input px-2 py-0.5 text-[10.5px] text-muted-foreground"
              >
                {state.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
