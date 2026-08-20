import { BandStack } from '@/components/ui';
import { BAND_LABEL } from '@/lib/bands';
import { formatCount, formatScore, percentOf } from '@/lib/format';
import type { AreaProfile, Band } from '@/lib/types';
import { buildRolloutWaves } from './rolloutPlan';

const BAND_ORDER: Band[] = ['ready', 'moderately_ready', 'not_ready'];

interface RolloutWavesProps {
  /** Assessed states in scope. */
  states: AreaProfile[];
  /** Drill into a state — same destination as clicking it on the map. */
  onSelectState: (state: AreaProfile) => void;
}

/**
 * The state-level rollout plan: which states go first, and why.
 *
 * The facility-level six-month activity template it used to sit beside is a
 * national statement and has moved to the Overview, where the national
 * distribution it is drawn against actually lives. What belongs on a page about
 * states is the thing the template cannot say — the order. See
 * `rolloutWaves.ts` for why composition, not band, is what that order is built
 * from.
 */
export function RolloutWaves({ states, onSelectState }: RolloutWavesProps) {
  const waves = buildRolloutWaves(states);

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {waves.map((wave) => (
        <section key={wave.n} className="card flex flex-col p-4">
          <header className="flex items-baseline gap-2">
            <h3 className="text-[13.5px] font-semibold text-foreground">Wave {wave.n}</h3>
            <span className="mono text-[10px] uppercase tracking-[0.11em] text-brand-500">
              {wave.months}
            </span>
          </header>

          <p className="mono mt-0.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            composite readiness {formatScore(wave.readinessLow, 2)}–
            {formatScore(wave.readinessHigh, 2)}
          </p>

          {/* The states themselves are the point of the card, so they are the
              largest thing in it and each one is a way into its own detail. */}
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {wave.states.map((state) => (
              <li key={state.id}>
                <button
                  type="button"
                  onClick={() => onSelectState(state)}
                  className="rounded-full border border-input px-2.5 py-1 text-[12.5px] text-foreground transition-colors hover:border-brand-500 hover:text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {state.name}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-4">
            <BandStack
              distribution={wave.distribution}
              label={`Wave ${wave.n}`}
              className="min-w-0"
            />
            <ul className="mono mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
              {BAND_ORDER.map((band) => (
                <li key={band}>
                  {BAND_LABEL[band]} {formatCount(wave.distribution[band])}
                </li>
              ))}
            </ul>

            <p className="mt-3 text-[12.5px] text-muted-foreground">
              <strong className="font-semibold text-foreground">
                {formatCount(wave.infrastructureFirst)} of{' '}
                {formatCount(wave.facilityCount)}
              </strong>{' '}
              facilities ({percentOf(wave.infrastructureFirst, wave.facilityCount, 0)}) need
              procurement and installation before anyone is onboarded.
            </p>
          </div>
        </section>
      ))}
    </div>
  );
}
