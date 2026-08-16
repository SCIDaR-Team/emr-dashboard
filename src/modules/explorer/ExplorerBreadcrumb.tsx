import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { titleCaseName } from '@/lib/format';
import type { GeoPath } from '@/hooks/useExplorerSelection';

interface Props {
  geoPath: GeoPath;
  /**
   * Name of the selected facility, when one is selected.
   *
   * The path's last segment is an ODK UUID at that depth, and title-casing a
   * UUID produces a crumb that reads as corruption. Resolved by the caller,
   * which already has the facility row.
   */
  leafLabel?: string;
  onNavigate: (depth: number) => void;
}

/** Geographic breadcrumb — the drill-out path. */
export function ExplorerBreadcrumb({ geoPath, leafLabel, onNavigate }: Props) {
  const crumbs = [
    'Nigeria',
    ...geoPath.parts.map((part, i) =>
      i === 2 ? (leafLabel ?? 'Facility') : titleCaseName(part),
    ),
  ];

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {crumbs.map((label, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={`${label}-${i}`} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
              )}
              <button
                type="button"
                onClick={() => onNavigate(i)}
                aria-current={isLast ? 'page' : undefined}
                disabled={isLast}
                className={cn(
                  'rounded px-1.5 py-0.5 transition-colors',
                  isLast
                    ? 'font-semibold text-brand-700'
                    : 'text-muted-foreground hover:bg-brand-50 hover:text-brand-700',
                )}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
