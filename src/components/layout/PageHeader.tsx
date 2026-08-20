import { ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { nextModule } from '@/app/navigation';
import { cn } from '@/lib/cn';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Filter controls. Rendered as their own hairline-separated row beneath the
   *  title bar, so the title row keeps a fixed height on every page. */
  children?: React.ReactNode;
  /** Actions that sit at the right of the title row — export menus, mode
   *  toggles. The next-module arrow is appended after them. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The page's title bar and filter row.
 *
 * One line, ~52px, sentence case. The previous header set the title in
 * uppercase at `text-3xl` over a subtitle and a filter block, which spent about
 * 180px of a 900px viewport before any data appeared — and shouted, on a page
 * whose job is to be read. The title and its one-line description now share a
 * single baseline row, and filters get their own band below.
 */
export function PageHeader({
  title,
  subtitle,
  children,
  actions,
  className,
}: PageHeaderProps) {
  const { pathname } = useLocation();
  const next = nextModule(pathname);

  return (
    // Sticky, not fixed: `main` in AppShell is the scroll container, so the
    // header pins to the top of the content column and keeps the rail's own
    // scroll behaviour untouched. z-30 clears the panels and tables that scroll
    // beneath it but stays under the drawer/toast layer at z-90+.
    <header className={cn('sticky top-0 z-30 shrink-0', className)}>
      <div className="flex min-h-[52px] items-center gap-4 border-b border-border bg-surface px-4 sm:px-5">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="shrink-0 text-base font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="min-w-0 truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {actions}
          {next && (
            // A predictable "next" is worth keeping from the prototype — these
            // stakeholders present from the dashboard in sequence. Hidden on
            // small screens, where the top corner is already spoken for by the
            // navigation button.
            <Link
              to={next}
              aria-label="Next module"
              className="hidden h-8 w-8 place-items-center rounded border border-input text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:grid"
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
      </div>

      {children && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2 sm:px-5">
          {children}
        </div>
      )}
    </header>
  );
}

/** The label + control pairing used inside the filter row. */
export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="mono shrink-0 text-[9.5px] uppercase tracking-[0.11em] text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}
