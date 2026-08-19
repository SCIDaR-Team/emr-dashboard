import { cn } from '@/lib/cn';

/**
 * Panels.
 *
 * Structure comes from hairlines and vertical rhythm rather than from shadow
 * and radius — `shadow-card` is now `none` and `--radius-card` is 4px, so a
 * panel reads as a ruled region of the page instead of a floating slab. That is
 * what lets a dense screen carry a dozen of them without looking like a pile of
 * cards.
 */

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card p-4', className)} {...rest}>
      {children}
    </div>
  );
}

interface SectionCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

/**
 * A titled panel. The header is its own hairline-separated band so the title
 * row stays put when the body scrolls a wide table sideways.
 *
 * Titles are ink, not brand: colouring every heading was most of why the old
 * dashboard read as monotone green, and it left the accent with nothing to
 * distinguish.
 */
export function SectionCard({
  title,
  subtitle,
  action,
  className,
  bodyClassName,
  children,
}: SectionCardProps) {
  return (
    <section className={cn('card', className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border px-4 py-3">
        <h2 className="text-[13.5px] font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

interface KpiTileProps {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * Icon tile left, label + figure right.
 *
 * Retained for call sites not yet ported; new work should use `Tile`/`TileRow`
 * from `Meter.tsx`, which set the figure in tabular mono and butt the tiles
 * together against a hairline grid instead of floating them as separate cards.
 */
export function KpiTile({ label, value, sublabel, icon, className }: KpiTileProps) {
  return (
    <div className={cn('card flex items-center gap-3 p-3.5', className)}>
      {icon && (
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded bg-brand-50 text-brand-500">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="mono truncate text-[9.5px] uppercase tracking-[0.11em] text-muted-foreground">
          {label}
        </p>
        <p className="mono text-2xl font-semibold leading-tight tracking-tight text-foreground">
          {value}
        </p>
        {sublabel && <p className="truncate text-xs text-muted-foreground">{sublabel}</p>}
      </div>
    </div>
  );
}
