import { useCallback, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  ClipboardList,
  Compass,
  FileText,
  Home,
  Map,
  Menu,
  PanelLeft,
  Stethoscope,
  X,
  type LucideIcon,
} from 'lucide-react';
import { NAV_ITEMS } from '@/app/navigation';
import { cn } from '@/lib/cn';
import { useDismissable, useScrollLock } from '@/hooks/useDismissable';
import { useSidebarStore } from '@/store/sidebarStore';
import { ThemeToggle } from './ThemeToggle';

const ICONS: Record<string, LucideIcon> = {
  Home,
  Map,
  BarChart3,
  ClipboardList,
  Compass,
  FileText,
};

/**
 * The wordmark card, and the way back out to the landing page.
 *
 * Raised onto its own card rather than sitting flat against the rail: it is not
 * a section heading for the links below it, it is a separate destination, and
 * the card is what says so without a second line of explanatory text.
 *
 * Collapsed, the card keeps its footprint and drops to the mark alone — the
 * `title` carries the name, the way the nav links below do.
 */
function BrandBlock({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to="/"
      onClick={onNavigate}
      title="EMR Readiness Assessment — landing page"
      className={cn(
        'flex items-center gap-2.5 rounded-xl border border-sidebar-foreground/15 bg-sidebar-foreground/10 transition-colors',
        'hover:border-sidebar-foreground/30 hover:bg-sidebar-foreground/15',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground/60',
        collapsed ? 'justify-center p-2.5' : 'p-3',
      )}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sidebar-foreground/15 text-sidebar-foreground">
        <Stethoscope className="h-4 w-4" aria-hidden />
      </span>
      {collapsed ? (
        <span className="sr-only">EMR Readiness Assessment</span>
      ) : (
        <span className="text-sm font-semibold leading-snug text-sidebar-foreground">
          EMR Readiness
          <br />
          Assessment
        </span>
      )}
    </Link>
  );
}

/**
 * The rail's contents, shared by the fixed desktop rail and the mobile panel.
 *
 * `footer` lands directly above the colour-scheme switch, at the bottom of the
 * rail. It is a slot rather than a flag because only the desktop rail has
 * anything to put there — the mobile panel does not collapse.
 */
function NavContents({
  collapsed = false,
  footer,
  onNavigate,
}: {
  collapsed?: boolean;
  footer?: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <>
      <ul className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon] ?? Home;
          return (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/dashboard'}
                onClick={onNavigate}
                // Collapsed, the icon is the only label there is, so the native
                // tooltip carries the name rather than leaving five unmarked
                // glyphs. The `sr-only` span keeps the accessible name intact
                // either way — `title` alone is not a reliable one.
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg py-2.5 text-sm transition-colors',
                    'hover:bg-sidebar-foreground/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground/60',
                    collapsed ? 'justify-center px-2.5' : 'px-3',
                    isActive && 'bg-sidebar-foreground/15 font-semibold text-sidebar-foreground',
                  )
                }
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>

      {footer}

      {/* The footer brings its own top margin; without one the switch keeps the
          full gap that used to separate it from the nav list. */}
      <div className={cn('px-3', footer ? 'mt-3' : 'mt-6')}>
        <ThemeToggle vertical={collapsed} />
      </div>
    </>
  );
}

/**
 * The fixed navigation rail.
 *
 * Desktop only. At 375px it was 68% of the viewport, so below `lg` navigation
 * moves into `MobileNavBar` below — the rail is not narrowed *there*, because a
 * five-item icon strip and a five-item labelled list are different components
 * pretending to be one, and on a phone the labels are what make this navigable
 * to someone who has not used the dashboard before.
 *
 * On desktop the icon strip is a deliberate choice rather than a fallback: the
 * reader has asked for it, the labels are one click away, and the map and the
 * 15-column ranked table both get 192px back.
 */
export function Sidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);

  return (
    <nav
      aria-label="Main"
      className={cn(
        'hidden shrink-0 flex-col bg-sidebar py-5 text-sidebar-foreground/90 lg:flex',
        // Width only — animating anything else here would drag the map and the
        // charts through a resize on every frame of the transition.
        'transition-[width] duration-200 ease-out',
        collapsed ? 'w-[76px]' : 'w-64',
      )}
    >
      {/* The wordmark has the header row to itself, at the rail's full width. */}
      <div className="px-3 pb-6">
        <BrandBlock collapsed={collapsed} />
      </div>

      {/* The toggle lives at the foot of the rail with the other chrome, above
          the colour-scheme switch. It is a workspace control, not a
          destination, and at the top it gave a single button the most prominent
          row on the page. */}
      <NavContents
        collapsed={collapsed}
        footer={
          <div className={cn('mt-6 flex px-3', collapsed ? 'justify-center' : 'justify-end')}>
            <button
              type="button"
              onClick={toggle}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              className="shrink-0 rounded-lg p-2 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground/60"
            >
              <PanelLeft className="h-5 w-5" aria-hidden />
            </button>
          </div>
        }
      />
    </nav>
  );
}

/**
 * Navigation below `lg`: a top bar with the app name and a slide-over panel.
 *
 * Written here rather than through the shared `Drawer` because the rail is the
 * one surface in the app that stays dark in both colour schemes (see the
 * `--sidebar` tokens in globals.css), and `Drawer` is a `bg-surface` panel —
 * putting the navigation inside one would have given it a white background in
 * light mode and lost the only piece of the Figma's chrome that survives on a
 * phone. It reuses the same dismiss and scroll-lock hooks every other overlay
 * does, and the same `slide-in-left` keyframe the reduced-motion rule already
 * neutralises.
 */
export function MobileNavBar() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { pathname } = useLocation();

  useDismissable(open, close);
  useScrollLock(open);

  const current = NAV_ITEMS.find((item) => pathname.startsWith(item.path));

  return (
    <>
      <div className="flex shrink-0 items-center gap-3 bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-label="Open navigation"
          className="-ml-1 rounded-lg p-1.5 transition-colors hover:bg-sidebar-foreground/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground/60"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">
            {current?.label ?? 'EMR Readiness Assessment'}
          </p>
          <p className="truncate text-[11px] leading-tight text-sidebar-foreground/60">
            EMR Readiness Assessment
          </p>
        </div>
      </div>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-[2px] animate-fade-in lg:hidden"
            onClick={close}
            aria-hidden
          />
          <nav
            aria-label="Main"
            className="fixed bottom-0 left-0 top-0 z-[95] flex w-64 max-w-[85vw] flex-col bg-sidebar py-6 text-sidebar-foreground/90 shadow-pop animate-slide-in-left lg:hidden"
          >
            <div className="flex items-start gap-2 px-3 pb-6">
              <div className="min-w-0 flex-1">
                <BrandBlock onNavigate={close} />
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close navigation"
                autoFocus
                className="rounded-lg p-1.5 transition-colors hover:bg-sidebar-foreground/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground/60"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {/* Closing on navigate: the panel covers the content it just
                navigated to, and a reader who taps a link has finished with it. */}
            <NavContents onNavigate={close} />
          </nav>
        </>
      )}
    </>
  );
}
