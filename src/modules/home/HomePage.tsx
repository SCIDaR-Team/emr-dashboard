import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, ClipboardList, Compass, FileText, Map } from 'lucide-react';
import { NAV_ITEMS } from '@/app/navigation';
import { COVERAGE, PROGRAMME } from '@/lib/constants';

const ICONS: Record<string, typeof Map> = { Map, BarChart3, ClipboardList, Compass, FileText };

export default function HomePage() {
  const modules = NAV_ITEMS.filter((n) => n.showOnHome);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Masthead */}
      <div className="rounded-card bg-sidebar px-5 py-6 text-sidebar-foreground sm:px-8 sm:py-7">
        <h1 className="text-2xl font-bold uppercase tracking-tight sm:text-3xl lg:text-4xl">
          {PROGRAMME.title}
        </h1>
        <p className="mt-1 text-sidebar-foreground/75">{PROGRAMME.subtitle}</p>
        {/* TODO: partner logos (NPHCDA · NTBLCP · Global Fund · Solina) —
            awaiting brand assets. */}
      </div>

      <section className="card mt-6 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-brand-700">Dashboard overview</h2>
        {/* No measure cap: inside a full-width card a 4xl clamp leaves a third
            of the card empty and the paragraph reads as a stray column. */}
        <p className="mt-3 leading-relaxed text-foreground/80">
          This dashboard presents findings from the EMR Readiness Assessment and
          provides a consolidated view of readiness levels, assessment coverage and
          facility-level gaps. The assessment combined primary data collection in{' '}
          <strong>{COVERAGE.statesPrimary} physically visited states</strong> with
          secondary data review for the remaining {COVERAGE.statesSecondary} states and
          the FCT. Use the modules below to explore state-level findings, assessment
          status and facility readiness requirements for EMR rollout.
        </p>
      </section>

      <h2 className="mt-8 text-lg font-semibold text-brand-700">Dashboard modules</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {modules.map((mod) => {
          const Icon = ICONS[mod.icon] ?? Map;
          return (
            <Link
              key={mod.path}
              to={mod.path}
              className="card group flex flex-col p-6 transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <Icon className="h-7 w-7" aria-hidden />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-brand-700">{mod.label}</h3>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">
                {mod.description}
              </p>
              <ArrowRight
                className="mt-4 h-5 w-5 self-end text-brand-600 transition-transform group-hover:translate-x-1"
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
