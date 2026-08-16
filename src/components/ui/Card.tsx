import { cn } from '@/lib/cn';

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card p-5', className)} {...rest}>
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
      <div className="flex items-start justify-between gap-4 px-5 pt-5">
        <div>
          <h2 className="text-base font-semibold text-brand-700">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className={cn('p-5', bodyClassName)}>{children}</div>
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

/** Icon tile left, label + figure right — the prototype's KPI pattern. */
export function KpiTile({ label, value, sublabel, icon, className }: KpiTileProps) {
  return (
    <div className={cn('card flex items-center gap-4 p-4', className)}>
      {icon && (
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold leading-tight text-brand-700">{value}</p>
        {sublabel && (
          <p className="truncate text-xs text-muted-foreground">{sublabel}</p>
        )}
      </div>
    </div>
  );
}
