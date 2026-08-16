import { ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { nextModule } from '@/app/navigation';
import { cn } from '@/lib/cn';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Filter controls, rendered directly beneath the title. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Page title, optional filter row, and the circular next-module arrow.
 *
 * The arrow gives a linear walkthrough alongside sidebar navigation — these
 * stakeholders present from this dashboard, and a predictable "next" is worth
 * keeping from the prototype.
 */
export function PageHeader({ title, subtitle, children, className }: PageHeaderProps) {
  const { pathname } = useLocation();
  const next = nextModule(pathname);

  return (
    <header className={cn('px-4 pb-4 pt-6 sm:px-6 lg:px-8 lg:pt-8', className)}>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          {/* The uppercase display size is from the Figma, which has no mobile
              design at all. At 375px "DRILL-DOWN EXPLORER" at 3xl wraps to
              three lines and pushes the controls below the fold, so the step
              down is a real one rather than a token. */}
          <h1 className="text-xl font-bold uppercase tracking-tight text-brand-700 sm:text-2xl lg:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>

        {next && (
          // Hidden on small screens: it is a convenience for presenting from
          // the dashboard in sequence, and on a phone it competes for the top
          // corner with the navigation button that is not optional.
          <Link
            to={next}
            aria-label="Next module"
            className="hidden h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-surface text-brand-600 transition-colors hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:grid"
          >
            <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        )}
      </div>

      {children && (
        <div className="mt-5 flex flex-wrap items-end gap-3 sm:mt-6 sm:gap-4">{children}</div>
      )}
    </header>
  );
}
