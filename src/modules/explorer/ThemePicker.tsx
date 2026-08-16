import { useState } from 'react';
import { ChevronRight, Layers } from 'lucide-react';
import { Drawer } from '@/components/ui';
import { ThematicTree } from './ThematicTree';
import type { ThemeNodeDescription } from '@/lib/themes';
import type { ThemeNodeId } from '@/lib/types';

interface ThemePickerProps {
  selected: ThemeNodeId;
  node: ThemeNodeDescription;
  onSelect: (id: ThemeNodeId) => void;
  geoLevel: 'national' | 'state' | 'lga' | 'facility';
}

/**
 * The thematic axis on a small screen.
 *
 * **The Explorer's small-screen decision, and the one the rest of the responsive
 * pass follows from.** This module is the widest surface in the dashboard —
 * a 288px thematic rail, a map, a context panel and a fifteen-column ranked
 * table — and the Figma has no mobile design for any of it.
 *
 * The module's premise (guide §8.1) is two independent axes, each reachable in
 * one interaction: "power-stabilisation readiness across the LGAs of Kano" is
 * two clicks. Whatever happens at 375px has to keep that true. Three options:
 *
 * - **Stack the rail above the map.** Costs nothing to build and breaks the
 *   promise: the rail expands to ~50 indicator nodes, so every theme change
 *   means scrolling a wall of them and then scrolling back to see what the map
 *   did.
 * - **Tabs — Map | Themes.** Hides the map behind a tab, which kills the one
 *   interaction that makes the two axes feel joined: picking a theme and
 *   watching the fills change. You would pick a theme, then navigate to go and
 *   look at the result.
 * - **A picker that states its current value and opens over the map.** The
 *   geographic axis keeps the width, because it is a map and needs it. The
 *   thematic axis is a *selection*, and a selection is well served by a control
 *   that shows what it is set to. Still one interaction per axis: tap the
 *   button, tap a node, the drawer closes onto the recoloured map.
 *
 * The third. Above `lg` none of this renders and the rail is unchanged.
 *
 * The button shows the full thematic path rather than the leaf label, because
 * "Power" is ambiguous where "Technical Infrastructure › Power" is not, and on
 * a phone this line is the only thing on screen saying what the map is coloured
 * by — the rail that says so on desktop is behind it.
 */
export function ThemePicker({ selected, node, onSelect, geoLevel }: ThemePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-lg border border-input bg-surface px-3 py-2.5 text-left transition-colors hover:border-brand-500/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Layers className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Thematic area
          </span>
          <span className="block truncate text-sm font-medium text-foreground">
            {node.path}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        side="left"
        width={340}
        title="Thematic area"
        subtitle="Pick what the map and the figures below are measured on"
      >
        <ThematicTree
          selected={selected}
          geoLevel={geoLevel}
          className="-mx-1"
          // Closes on select. The drawer covers the map, and the reason to
          // change the theme is to see the map change.
          onSelect={(theme) => {
            onSelect(theme);
            setOpen(false);
          }}
        />
      </Drawer>
    </div>
  );
}
