import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { BAND_LABEL } from '@/lib/bands';
import { useFilterStore } from '@/store/filterStore';
import { Combobox, MultiSelectDropdown } from '@/components/ui';
import type { FacilitySummary } from '@/lib/types';

export interface CascadingLocationFilterProps {
  facilities: FacilitySummary[];
  /**
   * Where picking a facility goes. Defaults to its scorecard; the explorer
   * passes its own handler so the choice moves the drill-down instead.
   */
  onSelectFacility?: (uuid: string) => void;
  className?: string;
}

/**
 * State → LGA → Facility, each level scoped by the one above.
 *
 * State and LGA are multi-select and write to the shared filter store, so they
 * narrow every figure on the page. Facility is single-select and *navigates* —
 * one facility is a destination, not a filter, and the scorecard is where it
 * leads. Keeping that distinction visible is why the third control is a
 * different kind of widget rather than a third dropdown.
 *
 * The cascade is data-driven, not from the XLSForm `choices` sheet: the two
 * disagree on LGA count (305 distinct values in the export against 205 on the
 * prototype), and offering an LGA with no assessed facility behind it produces
 * an empty view with no explanation. Every option here has facilities.
 */
export function CascadingLocationFilter({
  facilities,
  onSelectFacility,
  className,
}: CascadingLocationFilterProps) {
  const navigate = useNavigate();
  const states = useFilterStore((s) => s.states);
  const lgas = useFilterStore((s) => s.lgas);
  const setStates = useFilterStore((s) => s.setStates);
  const setLGAs = useFilterStore((s) => s.setLGAs);

  const { stateOptions, lgaOptions, facilityOptions } = useMemo(() => {
    const inStates = states.length
      ? facilities.filter((f) => states.includes(f.state))
      : facilities;
    const inLgas = lgas.length ? inStates.filter((f) => lgas.includes(f.lga)) : inStates;

    const tally = (rows: FacilitySummary[], pick: (f: FacilitySummary) => string) => {
      const counts = new Map<string, number>();
      for (const f of rows) counts.set(pick(f), (counts.get(pick(f)) ?? 0) + 1);
      return [...counts.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, count]) => ({ key, label: key, count }));
    };

    return {
      stateOptions: tally(facilities, (f) => f.state),
      lgaOptions: tally(inStates, (f) => f.lga),
      facilityOptions: inLgas
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((f) => ({
          value: f.uuid,
          label: f.name,
          hint: `${f.lga}, ${f.state} · ${BAND_LABEL[f.archetype]}`,
        })),
    };
  }, [facilities, states, lgas]);

  const choose = (uuid: string) => {
    if (onSelectFacility) onSelectFacility(uuid);
    else navigate(`/facilities/${uuid}`);
  };

  return (
    <div className={cn('flex w-full flex-wrap items-end gap-3', className)}>
      <MultiSelectDropdown
        label="State"
        className="min-w-[9.5rem] flex-1 sm:w-48 sm:flex-none"
        groups={[{ label: 'States assessed', items: stateOptions }]}
        selected={states}
        onChange={setStates}
        placeholder="All 12 states"
        searchable
      />

      <MultiSelectDropdown
        label="LGA"
        className="min-w-[9.5rem] flex-1 sm:w-48 sm:flex-none"
        groups={[{ label: 'LGAs', items: lgaOptions }]}
        selected={lgas}
        onChange={setLGAs}
        placeholder={states.length ? `All in ${states.length} state(s)` : 'All LGAs'}
        searchable
        disabled={lgaOptions.length === 0}
      />

      <Combobox
        label="Facility"
        className="min-w-full flex-1 sm:w-72 sm:min-w-0 sm:flex-none"
        value=""
        onChange={choose}
        options={facilityOptions}
        // The count is the point: it says how far the two filters above have
        // narrowed things before the user opens a list of 2,804.
        placeholder={`${facilityOptions.length.toLocaleString()} facilities — open a scorecard`}
        searchPlaceholder="Search by name or LGA…"
      />
    </div>
  );
}
