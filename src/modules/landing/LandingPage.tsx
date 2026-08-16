import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  Compass,
  FileText,
  Home,
  Map,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import { NAV_ITEMS } from '@/app/navigation';
import { BAND_ACTION, BAND_CLASSES, BAND_LABEL, BAND_TIMELINE } from '@/lib/bands';
import { COVERAGE, PROGRAMME, VALIDATION_TARGETS } from '@/lib/constants';
import type { Band } from '@/lib/types';

/**
 * Landing page — the front door, at `/`.
 *
 * Sits *outside* the AppShell: no navigation rail, no filters, no data fetch.
 * Everything on it comes from `constants.ts`, so it paints immediately while
 * DataProvider warms the datasets in the background for the dashboard the
 * reader is about to open.
 *
 * The signature mark is the hundred-tile waffle in the hero. It is the same
 * three-band vocabulary the rest of the app uses — the same colours, the same
 * textures from `bands.ts` — rendered at the one scale where a reader can see
 * the *shape* of the national result before reading a single number: two rows
 * of ready, six and a half rows of moderate, a corner of not ready. It is a
 * real proportion, not decoration; the caption says exactly what one tile is.
 *
 * The waffle sits on a `bg-surface` plate rather than directly on the dark
 * ground. The band colours are tuned for contrast against app surfaces, and
 * `--ready` at 28% lightness on a 12% forest ground is a green smudge.
 */

const ICONS: Record<string, LucideIcon> = {
  Home,
  Map,
  BarChart3,
  ClipboardList,
  Compass,
  FileText,
};

/** Best case first — the waffle reads top-left to bottom-right. */
const BAND_ORDER: readonly Band[] = ['ready', 'moderately_ready', 'not_ready'] as const;

const ARCHETYPES = VALIDATION_TARGETS.archetypeCounts;
const SCORED_TOTAL = ARCHETYPES.ready + ARCHETYPES.moderately_ready + ARCHETYPES.not_ready;

/**
 * Hundred tiles apportioned by largest remainder.
 *
 * Rounding each share independently would give 19 + 66 + 15 here but is not
 * guaranteed to — three roundings that each go the same way leave a hole or an
 * extra tile in the grid, and a waffle that is not exactly a hundred squares
 * silently stops meaning "one tile is one per cent".
 */
function waffleTiles(): Band[] {
  const parts = BAND_ORDER.map((band) => {
    const exact = (ARCHETYPES[band] / SCORED_TOTAL) * 100;
    return { band, exact, tiles: Math.floor(exact) };
  });

  let remainder = 100 - parts.reduce((sum, p) => sum + p.tiles, 0);
  [...parts]
    .sort((a, b) => b.exact - b.tiles - (a.exact - a.tiles))
    .forEach((p) => {
      if (remainder > 0) {
        p.tiles += 1;
        remainder -= 1;
      }
    });

  return parts.flatMap((p) => Array.from({ length: p.tiles }, () => p.band));
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-bold tracking-tight text-sidebar-foreground sm:text-3xl">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-sidebar-foreground/60">{label}</p>
    </div>
  );
}

export default function LandingPage() {
  const tiles = useMemo(waffleTiles, []);
  // Every rail destination, Home included — `showOnHome` is what the dashboard's
  // own launcher filters on, and it excludes Home precisely because that page
  // *is* Home. From out here Home is a destination like any other.
  const modules = NAV_ITEMS;

  return (
    <div className="min-h-screen bg-page">
      {/*
        Hero ground and lattice.
        Scoped <style> rather than Tailwind arbitrary values: this is three
        layered backgrounds and a keyframe that exist on exactly one screen,
        and inlining them here keeps the page self-contained. The lattice is a
        1px grid — a nod to the facility table underneath everything — where
        srh-dashboard's front door uses a dot field; they should not be
        mistaken for each other.
      */}
      <style>{`
        .emr-hero {
          position: relative;
          overflow: hidden;
          background-color: hsl(var(--sidebar));
          background-image:
            radial-gradient(ellipse 70% 55% at 12% -10%, hsl(var(--ready) / 0.30) 0%, transparent 68%),
            radial-gradient(ellipse 55% 50% at 95% 108%, hsl(var(--brand-500) / 0.22) 0%, transparent 62%);
        }
        .emr-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(hsl(var(--sidebar-foreground) / 0.05) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--sidebar-foreground) / 0.05) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(ellipse 90% 80% at 50% 30%, #000 20%, transparent 78%);
          pointer-events: none;
        }
        .emr-tile {
          animation: emr-tile-in 260ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
        }
        @keyframes emr-tile-in {
          from { opacity: 0; transform: scale(0.55); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>

      {/* Top bar. Stays dark over the light sections below so the landing keeps
          one identity end to end, and so "Enter dashboard" is always one click
          away however far the reader has scrolled. */}
      <header className="sticky top-0 z-40 border-b border-sidebar-foreground/10 bg-sidebar/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 text-sidebar-foreground">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sidebar-foreground/10">
              <Stethoscope className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-sm font-semibold leading-tight">
              EMR Readiness
              <span className="hidden sm:inline"> Assessment</span>
            </span>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-sidebar-foreground px-3.5 py-2 text-sm font-semibold text-sidebar transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground/60"
          >
            Enter dashboard
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="emr-hero">
        {/* The plate is the narrower column on purpose. At equal widths the
            waffle's tiles grow past 40px, the dot and stripe textures start to
            read as pattern rather than as a carrier, and the hero stops fitting
            above the fold on a laptop. */}
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-14 lg:px-8 lg:py-20">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/55">
              NPHCDA · National assessment
            </p>
            <h1 className="mt-4 text-4xl font-bold uppercase leading-[1.05] tracking-tight text-sidebar-foreground sm:text-5xl lg:text-6xl">
              {PROGRAMME.title}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-sidebar-foreground/75 sm:text-lg">
              What it takes to put an electronic medical record into every primary
              healthcare facility in Nigeria — measured facility by facility, scored on
              one three-band scale, and mapped from the national picture down to a
              single consulting room.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-sidebar-foreground px-5 py-3 text-sm font-semibold text-sidebar shadow-pop transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground/60"
              >
                Enter the dashboard
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                to="/explore"
                className="inline-flex items-center gap-2 rounded-xl border border-sidebar-foreground/25 px-5 py-3 text-sm font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-foreground/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground/60"
              >
                <Compass className="h-4 w-4" aria-hidden />
                Go straight to the explorer
              </Link>
            </div>

            <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-sidebar-foreground/15 pt-8 sm:grid-cols-4">
              <Figure value={String(COVERAGE.statesTotal)} label="States and the FCT" />
              <Figure value={String(COVERAGE.lgas)} label="LGAs covered" />
              <Figure
                value={COVERAGE.facilitiesSampled.toLocaleString('en-NG')}
                label="Facilities sampled"
              />
              <Figure value={String(COVERAGE.statesPrimary)} label="States visited" />
            </dl>
          </div>

          {/* The waffle plate. */}
          <div className="rounded-card border border-border bg-surface p-5 shadow-pop sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              National readiness
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">
              Every scored facility, as a hundred tiles. One tile is one per cent of the{' '}
              {COVERAGE.facilitiesScored.toLocaleString('en-NG')} facilities with a
              computed readiness band.
            </p>

            <div
              className="mt-5 grid grid-cols-10 gap-1"
              role="img"
              aria-label={BAND_ORDER.map(
                (band) =>
                  `${BAND_LABEL[band]}: ${Math.round((ARCHETYPES[band] / SCORED_TOTAL) * 100)} per cent`,
              ).join('; ')}
            >
              {tiles.map((band, i) => (
                <span
                  key={i}
                  className={`emr-tile aspect-square rounded-[3px] ${BAND_CLASSES[band].bg} ${BAND_CLASSES[band].texture}`}
                  style={{ animationDelay: `${i * 7}ms` }}
                  aria-hidden
                />
              ))}
            </div>

            <ul className="mt-5 space-y-2.5 border-t border-border pt-4">
              {BAND_ORDER.map((band) => (
                <li key={band} className="flex items-baseline gap-2.5">
                  <span
                    className={`mt-1 h-3 w-3 shrink-0 rounded-[3px] ${BAND_CLASSES[band].bg} ${BAND_CLASSES[band].texture}`}
                    aria-hidden
                  />
                  <span className="flex-1 text-sm font-medium text-foreground">
                    {BAND_LABEL[band]}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {ARCHETYPES[band].toLocaleString('en-NG')}
                  </span>
                  <span className="w-12 text-right text-sm font-semibold tabular-nums text-foreground">
                    {((ARCHETYPES[band] / SCORED_TOTAL) * 100).toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* What each band means                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <h2 className="text-2xl font-bold uppercase tracking-tight text-brand-700 sm:text-3xl">
          Three bands, three different jobs
        </h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-foreground/80">
          A facility is scored across technology and infrastructure, workforce,
          workflow and knowledge, and data use, then placed in one of three bands.
          The band is not a grade — it is a decision about what has to happen next,
          and when.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {BAND_ORDER.map((band) => (
            <div key={band} className="card flex flex-col p-6">
              <div className="flex items-center gap-3">
                <span
                  className={`h-8 w-8 shrink-0 rounded-lg ${BAND_CLASSES[band].bg} ${BAND_CLASSES[band].texture}`}
                  aria-hidden
                />
                <h3 className="text-lg font-semibold text-brand-700">{BAND_LABEL[band]}</h3>
              </div>
              <p className="mt-4 text-3xl font-bold tracking-tight text-foreground">
                {ARCHETYPES[band].toLocaleString('en-NG')}
                <span className="ml-2 text-base font-medium text-muted-foreground">
                  facilities
                </span>
              </p>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-foreground/80">
                {BAND_ACTION[band]}
              </p>
              <p className="mt-4 border-t border-border pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Timeline · {BAND_TIMELINE[band]}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Modules                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <h2 className="text-2xl font-bold uppercase tracking-tight text-brand-700 sm:text-3xl">
            Where to start
          </h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-foreground/80">
            Six destinations, each answering a different question. Open any of them
            directly — the dashboard keeps the navigation rail alongside, and this page
            is always one click back.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((mod) => {
              const Icon = ICONS[mod.icon] ?? Map;
              return (
                <Link
                  key={mod.path}
                  to={mod.path}
                  className="card group flex flex-col p-6 transition-all hover:-translate-y-0.5 hover:shadow-pop focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <Icon className="h-6 w-6" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-brand-700">
                    {/* "Home" is the rail's word for it, and out here it would
                        compete with the page the reader is standing on. */}
                    {mod.path === '/dashboard' ? 'Dashboard home' : mod.label}
                  </h3>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
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
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                              */}
      {/* ------------------------------------------------------------------ */}
      <footer className="emr-hero">
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-2xl font-bold uppercase tracking-tight text-sidebar-foreground sm:text-3xl">
                {PROGRAMME.title}
              </p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-sidebar-foreground/70">
                {PROGRAMME.subtitle}
              </p>
            </div>
            <Link
              to="/dashboard"
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-sidebar-foreground px-5 py-3 text-sm font-semibold text-sidebar transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground/60 lg:self-auto"
            >
              Enter the dashboard
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-sidebar-foreground/15 pt-6">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/45">
              Delivered with
            </span>
            {PROGRAMME.partners.map((partner) => (
              <span key={partner} className="text-sm font-medium text-sidebar-foreground/80">
                {partner}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
